/**
 * AI控制器
 * 提供AI相关的REST API接口，包括管理员AI聊天、访客AI聊天、文件分析、内容生成等功能
 */
import { BadRequestException, Body, Controller, Get, Headers, NotFoundException, Param, Post } from '@nestjs/common'
import { AiGenerationStatus, AiGenerationType, AiMessageSender, AiRoleScope, ContentStatus, ContentType } from '@prisma/client'
import { IsIn, IsNotEmpty, IsOptional, MaxLength } from 'class-validator'
import { randomBytes } from 'node:crypto'
import { PrismaService } from '../../prisma/prisma.module'
import { AdminService } from '../admin/admin.service'
import { AiService, DeepSeekMessage } from './ai.service'

/**
 * 管理员AI聊天请求DTO
 */
class AdminAiChatDto {
  @IsNotEmpty() @MaxLength(4000) message!: string              // 用户消息内容
  @IsOptional() @MaxLength(100) conversationId?: string        // 可选的会话ID，用于继续对话
  @IsOptional() @IsIn(['article', 'project']) contentType?: ContentType  // 关联内容类型
  @IsOptional() @MaxLength(100) contentId?: string             // 关联内容ID
}

/**
 * 访客AI聊天请求DTO（继承自管理员DTO）
 */
class VisitorAiChatDto extends AdminAiChatDto {}

/**
 * AI文件上传请求DTO
 */
class AiFileDto {
  @IsNotEmpty() @MaxLength(240) originalName!: string          // 原始文件名
  @IsOptional() @MaxLength(120) mimeType?: string              // 文件MIME类型
  @IsNotEmpty() @MaxLength(120000) text!: string               // 文件文本内容
}

/**
 * AI内容生成请求DTO
 */
class AiGenerateDto {
  @IsIn(['article', 'project']) generationType!: AiGenerationType  // 生成类型（文章/作品）
  @IsNotEmpty() @MaxLength(2000) prompt!: string               // 生成提示词
  @IsOptional() @MaxLength(100) fileId?: string                // 参考上传文件ID
  @IsOptional() @MaxLength(100) sourceContentId?: string       // 参考现有内容ID
}

/**
 * AI内容分析请求DTO
 */
class AiAnalyzeDto {
  @IsNotEmpty() @MaxLength(100) contentId!: string             // 要分析的内容ID
  @IsOptional() @MaxLength(1000) prompt?: string               // 自定义分析提示
}

/**
 * AI生成结果保存请求DTO
 */
class AiSaveGenerationDto {
  @IsOptional() @IsIn(['draft', 'published']) status?: ContentStatus  // 保存状态（草稿/发布）
}

/**
 * 获取当前时间的ISO字符串
 * @returns ISO格式时间字符串
 */
function nowIso() {
  return new Date().toISOString()
}

/**
 * 生成内容slug
 * @param type - 内容类型
 * @returns 唯一slug标识
 */
function newSlug(type: ContentType) {
  return type + '-' + Date.now() + '-' + randomBytes(3).toString('hex')
}

/**
 * 获取访客标识键
 * @param authorization - 访客授权标识
 * @returns 访客唯一标识
 */
function visitorKey(authorization?: string) {
  return authorization?.trim() || 'anonymous'
}

@Controller('api')
export class AiController {
  /**
   * 构造函数
   * @param aiService - AI服务
   * @param adminService - 管理员服务
   * @param prisma - Prisma数据库服务
   */
  constructor(
    private readonly aiService: AiService,
    private readonly adminService: AdminService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 获取管理员AI配置状态
   * @param authorization - 管理员令牌
   * @returns AI服务配置状态
   */
  @Get('admin/ai/config')
  async adminAiConfig(@Headers('authorization') authorization?: string) {
    await this.adminService.requireAdmin(authorization)
    return this.aiService.getStatus()
  }

  /**
   * 管理员AI聊天接口
   * @param authorization - 管理员令牌
   * @param data - 聊天请求数据
   * @returns 聊天结果
   */
  @Post('admin/ai/chat')
  async adminAiChat(@Headers('authorization') authorization: string | undefined, @Body() data: AdminAiChatDto) {
    const admin = await this.adminService.requireAdmin(authorization)
    this.aiService.assertRateLimit(AiRoleScope.admin, String(admin.id))
    const result = await this.runChat(AiRoleScope.admin, data, this.adminSystemPrompt(), String(admin.id))
    await this.adminService.audit(admin.id, 'admin_ai_chat', 'ai_conversation', result.conversationId, { messageId: result.message.id })
    return result
  }

  /**
   * 访客AI聊天接口
   * @param key - 访客标识
   * @param data - 聊天请求数据
   * @returns 聊天结果
   */
  @Post('ai/visitor/chat')
  async visitorAiChat(@Headers('x-visitor-key') key: string | undefined, @Body() data: VisitorAiChatDto) {
    this.aiService.assertRateLimit(AiRoleScope.visitor, visitorKey(key))
    return this.runChat(AiRoleScope.visitor, data, this.visitorSystemPrompt(), visitorKey(key))
  }

  /**
   * 上传文本文件供AI分析
   * @param authorization - 管理员令牌
   * @param data - 文件数据
   * @returns 上传的文件记录
   */
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

  /**
   * 分析上传的文件内容
   * @param authorization - 管理员令牌
   * @param id - 文件ID
   * @returns 分析结果
   */
  @Post('admin/ai/files/:id/analyze')
  async analyzeUploadedFile(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const admin = await this.adminService.requireAdmin(authorization)
    this.aiService.assertRateLimit(AiRoleScope.admin, String(admin.id))
    
    const file = await this.prisma.aiUploadedFile.findUnique({ where: { id } })
    if (!file) throw new NotFoundException('上传文件不存在。')

    const response = await this.aiService.chat([
      {
        role: 'system',
        content: [
          '你是个人网站后台的文件分析助手。',
          '请基于上传文件内容，输出简洁清晰的中文分析。',
          '分析必须包含：核心主题、可生成文章方向、可生成作品方向、建议标签、需要管理员补充的信息。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `文件名：${file.originalName}\n\n文件内容：\n${this.aiService.clampContext(file.parsedText, 0.8)}`,
      },
    ], { temperature: 0.55, maxTokens: 1400 })
    
    const answer = this.aiService.getAssistantContent(response)
    const generation = await this.prisma.aiGeneration.create({
      data: {
        generationType: AiGenerationType.analysis,
        sourceFileId: file.id,
        prompt: `分析上传文件：${file.originalName}`,
        resultJson: JSON.stringify({ answer }),
        status: AiGenerationStatus.success,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    })
    
    await this.adminService.audit(admin.id, 'ai_analyze_file', 'ai_generation', generation.id, { fileId: file.id })
    return { generation, answer, usage: { totalTokens: this.aiService.getTokenUsage(response) ?? null } }
  }

  /**
   * AI生成内容（文章/作品）
   * @param authorization - 管理员令牌
   * @param data - 生成请求数据
   * @returns 生成结果和草稿内容
   */
  @Post('admin/ai/generate')
  async generateContent(@Headers('authorization') authorization: string | undefined, @Body() data: AiGenerateDto) {
    const admin = await this.adminService.requireAdmin(authorization)
    this.aiService.assertRateLimit(AiRoleScope.admin, String(admin.id))

    const sourceFile = data.fileId ? await this.prisma.aiUploadedFile.findUnique({ where: { id: data.fileId } }) : null
    const sourceContent = data.sourceContentId ? await this.prisma.content.findUnique({ where: { id: data.sourceContentId }, include: { tags: true } }) : null
    const typeLabel = data.generationType === AiGenerationType.article ? '文章' : '作品'
    
    // 构建系统提示词
    const system: DeepSeekMessage = {
      role: 'system',
      content: [
        `你是个人网站“B-612星球”的内容生成助手。请生成一篇${typeLabel}草稿。`,
        '必须只返回 JSON，不要 Markdown，不要解释。',
        'JSON 字段必须包含：title、summary、body、tags；作品还应包含 stack；coverUrl 可为空字符串。',
        '中文表达要自然，有个人创作感，避免空泛套话。',
      ].join('\n'),
    }
    
    // 构建用户提示词
    const user: DeepSeekMessage = {
      role: 'user',
      content: [
        `生成类型：${typeLabel}`,
        `需求：${data.prompt.trim()}`,
        sourceFile ? `上传文件解析内容：\n${this.aiService.clampContext(sourceFile.parsedText, 0.65)}` : '',
        sourceContent ? `参考当前内容：\n${this.aiService.contentContext(sourceContent)}` : '',
      ].filter(Boolean).join('\n\n'),
    }
    
    // 调用AI生成
    const response = await this.aiService.chat([system, user], { temperature: 0.68, maxTokens: 1800 })
    const answer = this.aiService.getAssistantContent(response)
    const parsed = this.aiService.parseGeneratedJson(answer)
    
    // 保存生成记录
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

  /**
   * AI分析现有内容
   * @param authorization - 管理员令牌
   * @param data - 分析请求数据
   * @returns 分析结果
   */
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

  /**
   * 保存AI生成结果为正式内容
   * @param authorization - 管理员令牌
   * @param id - 生成记录ID
   * @param data - 保存配置
   * @returns 保存的内容和更新后的生成记录
   */
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
    
    // 创建内容
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
    
    // 更新生成记录状态
    const updatedGeneration = await this.prisma.aiGeneration.update({
      where: { id: generation.id },
      data: { targetContentId: content.id, status: AiGenerationStatus.saved, updatedAt: nowIso() },
    })
    
    await this.adminService.audit(admin.id, 'save_ai_generation', 'content', content.id, { generationId: generation.id })
    return { content, generation: updatedGeneration }
  }

  /**
   * 执行AI聊天的核心逻辑
   * @param scope - 用户角色范围
   * @param data - 聊天数据
   * @param systemPrompt - 系统提示词
   * @param actorKey - 用户标识
   * @returns 聊天结果
   */
  private async runChat(scope: AiRoleScope, data: AdminAiChatDto, systemPrompt: string, actorKey: string) {
    this.aiService.assertReady()
    const userMessage = data.message.trim()
    if (!userMessage) throw new BadRequestException('消息内容不能为空。')

    let conversationId = data.conversationId?.trim() || ''
    let history: Array<{ sender: AiMessageSender; body: string }> = []

    // 获取或创建会话
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

    // 获取网站上下文
    const context = await this.publicContext(data.contentType, data.contentId)
    
    // 构建消息列表
    const deepSeekMessages = [
      { role: 'system' as const, content: `${systemPrompt}\n\n可用网站上下文：\n${context}` },
      ...this.aiService.toDeepSeekMessages(history),
      { role: 'user' as const, content: this.aiService.clampContext(userMessage) },
    ]

    // 保存用户消息
    await this.aiService.addMessage({ conversationId, sender: AiMessageSender.user, body: userMessage })
    
    // 调用AI
    const response = await this.aiService.chat(deepSeekMessages, { temperature: scope === AiRoleScope.admin ? 0.6 : 0.72 })
    const answer = this.aiService.getAssistantContent(response)
    
    // 保存AI回复
    const assistantMessage = await this.aiService.addMessage({
      conversationId,
      sender: AiMessageSender.assistant,
      body: answer,
      tokenUsage: this.aiService.getTokenUsage(response),
    })
    
    return { conversationId, actorKey, message: assistantMessage, usage: { totalTokens: this.aiService.getTokenUsage(response) ?? null } }
  }

  /**
   * 获取公开内容上下文（用于AI理解网站内容）
   * @param contentType - 内容类型
   * @param contentId - 内容ID
   * @returns 格式化的上下文字符串
   */
  private async publicContext(contentType?: ContentType, contentId?: string) {
    // 如果指定了具体内容，优先获取该内容
    if (contentType && contentId) {
      const content = await this.prisma.content.findFirst({
        where: { id: contentId, type: contentType, status: ContentStatus.published },
        include: { tags: true },
      })
      if (content) return this.aiService.contentContext(content)
    }
    
    // 否则获取最新的6篇公开内容
    const latest = await this.prisma.content.findMany({
      where: { status: ContentStatus.published },
      include: { tags: true },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    })
    return latest.map((item) => this.aiService.contentContext(item)).join('\n\n---\n\n')
  }

  /**
   * 获取管理员系统提示词
   * @returns 系统提示词字符串
   */
  private adminSystemPrompt() {
    return [
      '你是个人网站“B-612星球”的后台 AI 助手。',
      '你服务已登录管理员，可以帮助规划文章、作品、评论运营、联系信息跟进和网站设置。',
      '你可以给出草稿、分析和修改建议，但不要声称已经直接修改数据库，除非接口明确返回保存结果。',
      '回答要清晰、直接、可执行，优先使用中文。',
    ].join('\n')
  }

  /**
   * 获取访客系统提示词
   * @returns 系统提示词字符串
   */
  private visitorSystemPrompt() {
    return [
      '你是个人网站“B-612星球”的访客 AI 助手。',
      '你只能基于公开文章、作品和当前页面上下文回答访问者问题。',
      '不要泄露后台、管理员、数据库、API Key 或未发布草稿信息。',
      '如果网站内容里没有答案，请坦诚说明，并给出可以继续阅读的方向。',
      '回答要友好、简洁、中文优先。',
    ].join('\n')
  }
}