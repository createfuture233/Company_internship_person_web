import { BadRequestException, Body, Controller, Get, Headers, NotFoundException, Param, Post } from '@nestjs/common'
import { AiGenerationStatus, AiGenerationType, AiMessageSender, AiRoleScope, ContentStatus, ContentType } from '@prisma/client'
import { IsIn, IsNotEmpty, IsOptional, MaxLength } from 'class-validator'
import { randomBytes } from 'node:crypto'
import { PrismaService } from '../../prisma/prisma.module'
import { AdminService } from '../admin/admin.service'
import { AiService, DeepSeekMessage } from './ai.service'

class AdminAiChatDto {
  @IsNotEmpty() @MaxLength(4000) message!: string
  @IsOptional() @MaxLength(100) conversationId?: string
  @IsOptional() @IsIn(['article', 'project']) contentType?: ContentType
  @IsOptional() @MaxLength(100) contentId?: string
}

class VisitorAiChatDto extends AdminAiChatDto {}

class AiFileDto {
  @IsNotEmpty() @MaxLength(240) originalName!: string
  @IsOptional() @MaxLength(120) mimeType?: string
  @IsNotEmpty() @MaxLength(120000) text!: string
}

class AiGenerateDto {
  @IsIn(['article', 'project']) generationType!: AiGenerationType
  @IsNotEmpty() @MaxLength(2000) prompt!: string
  @IsOptional() @MaxLength(100) fileId?: string
  @IsOptional() @MaxLength(100) sourceContentId?: string
}

class AiAnalyzeDto {
  @IsNotEmpty() @MaxLength(100) contentId!: string
  @IsOptional() @MaxLength(1000) prompt?: string
}

class AiSaveGenerationDto {
  @IsOptional() @IsIn(['draft', 'published']) status?: ContentStatus
}

function nowIso() {
  return new Date().toISOString()
}

function newSlug(type: ContentType) {
  return type + '-' + Date.now() + '-' + randomBytes(3).toString('hex')
}

function visitorKey(authorization?: string) {
  return authorization?.trim() || 'anonymous'
}

@Controller('api')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly adminService: AdminService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('admin/ai/config')
  async adminAiConfig(@Headers('authorization') authorization?: string) {
    await this.adminService.requireAdmin(authorization)
    return this.aiService.getStatus()
  }

  @Post('admin/ai/chat')
  async adminAiChat(@Headers('authorization') authorization: string | undefined, @Body() data: AdminAiChatDto) {
    const admin = await this.adminService.requireAdmin(authorization)
    this.aiService.assertRateLimit(AiRoleScope.admin, String(admin.id))
    const result = await this.runChat(AiRoleScope.admin, data, this.adminSystemPrompt(), String(admin.id))
    await this.adminService.audit(admin.id, 'admin_ai_chat', 'ai_conversation', result.conversationId, { messageId: result.message.id })
    return result
  }

  @Post('ai/visitor/chat')
  async visitorAiChat(@Headers('x-visitor-key') key: string | undefined, @Body() data: VisitorAiChatDto) {
    this.aiService.assertRateLimit(AiRoleScope.visitor, visitorKey(key))
    return this.runChat(AiRoleScope.visitor, data, this.visitorSystemPrompt(), visitorKey(key))
  }

  @Post('admin/ai/files')
  async uploadTextFile(@Headers('authorization') authorization: string | undefined, @Body() data: AiFileDto) {
    const admin = await this.adminService.requireAdmin(authorization)
    const text = data.text.trim()
    if (!text) throw new BadRequestException('文件内容为空，无法解析。')
    const file = await this.prisma.aiUploadedFile.create({
      data: {
        originalName: data.originalName.trim(),
        mimeType: data.mimeType?.trim() || 'text/plain',
        fileSize: Buffer.byteLength(text, 'utf8'),
        storagePath: `inline://${Date.now()}-${randomBytes(3).toString('hex')}`,
        parsedText: this.aiService.clampContext(text),
        parseStatus: 'success',
        createdAt: nowIso(),
      },
    })
    await this.adminService.audit(admin.id, 'upload_ai_file', 'ai_file', file.id, { originalName: file.originalName })
    return file
  }

  @Post('admin/ai/generate')
  async generateContent(@Headers('authorization') authorization: string | undefined, @Body() data: AiGenerateDto) {
    const admin = await this.adminService.requireAdmin(authorization)
    this.aiService.assertRateLimit(AiRoleScope.admin, String(admin.id))

    const sourceFile = data.fileId ? await this.prisma.aiUploadedFile.findUnique({ where: { id: data.fileId } }) : null
    const sourceContent = data.sourceContentId ? await this.prisma.content.findUnique({ where: { id: data.sourceContentId }, include: { tags: true } }) : null
    const typeLabel = data.generationType === AiGenerationType.article ? '文章' : '作品'
    const system: DeepSeekMessage = {
      role: 'system',
      content: [
        `你是个人网站“个人星球”的内容生成助手。请生成一篇${typeLabel}草稿。`,
        '必须只返回 JSON，不要 Markdown，不要解释。',
        'JSON 字段必须包含：title、summary、body、tags；作品还应包含 stack；coverUrl 可为空字符串。',
        '中文表达要自然，有个人创作感，避免空泛套话。',
      ].join('\n'),
    }
    const user: DeepSeekMessage = {
      role: 'user',
      content: [
        `生成类型：${typeLabel}`,
        `需求：${data.prompt.trim()}`,
        sourceFile ? `上传文件解析内容：\n${this.aiService.clampContext(sourceFile.parsedText, 0.65)}` : '',
        sourceContent ? `参考当前内容：\n${this.aiService.contentContext(sourceContent)}` : '',
      ].filter(Boolean).join('\n\n'),
    }
    const response = await this.aiService.chat([system, user], { temperature: 0.68, maxTokens: 1800 })
    const answer = this.aiService.getAssistantContent(response)
    const parsed = this.aiService.parseGeneratedJson(answer)
    const generation = await this.prisma.aiGeneration.create({
      data: {
        generationType: data.generationType,
        sourceFileId: sourceFile?.id ?? null,
        sourceContentId: sourceContent?.id ?? null,
        prompt: data.prompt.trim(),
        resultJson: JSON.stringify(parsed),
        status: AiGenerationStatus.success,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    })
    await this.adminService.audit(admin.id, 'ai_generate_content', 'ai_generation', generation.id, { generationType: generation.generationType })
    return { generation, draft: parsed, usage: { totalTokens: this.aiService.getTokenUsage(response) ?? null } }
  }

  @Post('admin/ai/analyze')
  async analyzeContent(@Headers('authorization') authorization: string | undefined, @Body() data: AiAnalyzeDto) {
    const admin = await this.adminService.requireAdmin(authorization)
    this.aiService.assertRateLimit(AiRoleScope.admin, String(admin.id))
    const content = await this.prisma.content.findUnique({ where: { id: data.contentId }, include: { tags: true } })
    if (!content) throw new NotFoundException('内容不存在。')

    const response = await this.aiService.chat([
      { role: 'system', content: '你是个人网站内容分析助手。请从结构、表达、信息完整度、SEO、访问者理解成本五个角度给出具体建议，使用中文。' },
      { role: 'user', content: `${data.prompt?.trim() || '请分析这篇内容并给出改进建议。'}\n\n${this.aiService.contentContext(content)}` },
    ], { temperature: 0.55, maxTokens: 1600 })
    const answer = this.aiService.getAssistantContent(response)
    const generation = await this.prisma.aiGeneration.create({
      data: {
        generationType: AiGenerationType.analysis,
        sourceContentId: content.id,
        prompt: data.prompt?.trim() || '分析当前内容',
        resultJson: JSON.stringify({ answer }),
        status: AiGenerationStatus.success,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    })
    await this.adminService.audit(admin.id, 'ai_analyze_content', 'ai_generation', generation.id, { contentId: content.id })
    return { generation, answer, usage: { totalTokens: this.aiService.getTokenUsage(response) ?? null } }
  }

  @Post('admin/ai/generations/:id/save')
  async saveGeneration(@Headers('authorization') authorization: string | undefined, @Param('id') id: string, @Body() data: AiSaveGenerationDto) {
    const admin = await this.adminService.requireAdmin(authorization)
    const generation = await this.prisma.aiGeneration.findUnique({ where: { id } })
    if (!generation) throw new NotFoundException('AI 生成记录不存在。')
    if (generation.generationType !== AiGenerationType.article && generation.generationType !== AiGenerationType.project) {
      throw new BadRequestException('只有文章或作品生成结果可以保存为内容。')
    }
    const draft = this.aiService.parseGeneratedJson(generation.resultJson)
    const type = generation.generationType === AiGenerationType.article ? ContentType.article : ContentType.project
    const status = data.status === ContentStatus.published ? ContentStatus.published : ContentStatus.draft
    const content = await this.prisma.content.create({
      data: {
        type,
        slug: newSlug(type),
        title: draft.title,
        summary: draft.summary,
        body: draft.body,
        coverUrl: draft.coverUrl || null,
        stack: type === ContentType.project ? draft.stack || null : null,
        status,
        publishedAt: status === ContentStatus.published ? nowIso() : null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        tags: { create: draft.tags.map((name) => ({ name })) },
      },
      include: { tags: true },
    })
    const updatedGeneration = await this.prisma.aiGeneration.update({
      where: { id: generation.id },
      data: { targetContentId: content.id, status: AiGenerationStatus.saved, updatedAt: nowIso() },
    })
    await this.adminService.audit(admin.id, 'save_ai_generation', 'content', content.id, { generationId: generation.id })
    return { content, generation: updatedGeneration }
  }

  private async runChat(scope: AiRoleScope, data: AdminAiChatDto, systemPrompt: string, actorKey: string) {
    this.aiService.assertReady()
    const userMessage = data.message.trim()
    if (!userMessage) throw new BadRequestException('消息内容不能为空。')

    let conversationId = data.conversationId?.trim() || ''
    let history: Array<{ sender: AiMessageSender; body: string }> = []

    if (conversationId) {
      const existing = await this.aiService.getConversation(conversationId, scope)
      if (!existing) throw new NotFoundException('AI 会话不存在或无权访问。')
      history = existing.messages
    } else {
      const created = await this.aiService.createConversation({
        roleScope: scope,
        contentId: data.contentId?.trim() || undefined,
        contentType: data.contentType,
        title: userMessage.slice(0, 40),
      })
      conversationId = created.id
    }

    const context = await this.publicContext(data.contentType, data.contentId)
    const deepSeekMessages = [
      { role: 'system' as const, content: `${systemPrompt}\n\n可用网站上下文：\n${context}` },
      ...this.aiService.toDeepSeekMessages(history),
      { role: 'user' as const, content: this.aiService.clampContext(userMessage) },
    ]

    await this.aiService.addMessage({ conversationId, sender: AiMessageSender.user, body: userMessage })
    const response = await this.aiService.chat(deepSeekMessages, { temperature: scope === AiRoleScope.admin ? 0.6 : 0.72 })
    const answer = this.aiService.getAssistantContent(response)
    const assistantMessage = await this.aiService.addMessage({
      conversationId,
      sender: AiMessageSender.assistant,
      body: answer,
      tokenUsage: this.aiService.getTokenUsage(response),
    })
    return { conversationId, actorKey, message: assistantMessage, usage: { totalTokens: this.aiService.getTokenUsage(response) ?? null } }
  }

  private async publicContext(contentType?: ContentType, contentId?: string) {
    if (contentType && contentId) {
      const content = await this.prisma.content.findFirst({
        where: { id: contentId, type: contentType, status: ContentStatus.published },
        include: { tags: true },
      })
      if (content) return this.aiService.contentContext(content)
    }
    const latest = await this.prisma.content.findMany({
      where: { status: ContentStatus.published },
      include: { tags: true },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    })
    return latest.map((item) => this.aiService.contentContext(item)).join('\n\n---\n\n')
  }

  private adminSystemPrompt() {
    return [
      '你是个人网站“个人星球”的后台 AI 助手。',
      '你服务已登录管理员，可以帮助规划文章、作品、评论运营、联系信息跟进和网站设置。',
      '你可以给出草稿、分析和修改建议，但不要声称已经直接修改数据库，除非接口明确返回保存结果。',
      '回答要清晰、直接、可执行，优先使用中文。',
    ].join('\n')
  }

  private visitorSystemPrompt() {
    return [
      '你是个人网站“个人星球”的访客 AI 助手。',
      '你只能基于公开文章、作品和当前页面上下文回答访问者问题。',
      '不要泄露后台、管理员、数据库、API Key 或未发布草稿信息。',
      '如果网站内容里没有答案，请坦诚说明，并给出可以继续阅读的方向。',
      '回答要友好、简洁、中文优先。',
    ].join('\n')
  }
}
