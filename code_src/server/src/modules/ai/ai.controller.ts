import { BadRequestException, Body, Controller, Get, Headers, NotFoundException, Post } from '@nestjs/common'
import { AiMessageSender, AiRoleScope, ContentType } from '@prisma/client'
import { IsIn, IsNotEmpty, IsOptional, MaxLength } from 'class-validator'
import { AdminService } from '../admin/admin.service'
import { AiService } from './ai.service'

class AdminAiChatDto {
  @IsNotEmpty() @MaxLength(4000) message!: string
  @IsOptional() @MaxLength(100) conversationId?: string
  @IsOptional() @IsIn(['article', 'project']) contentType?: ContentType
  @IsOptional() @MaxLength(100) contentId?: string
}

@Controller('api')
export class AiController {
  constructor(private readonly aiService: AiService, private readonly adminService: AdminService) {}

  @Get('admin/ai/config')
  async adminAiConfig(@Headers('authorization') authorization?: string) {
    await this.adminService.requireAdmin(authorization)
    return this.aiService.getStatus()
  }

  @Post('admin/ai/chat')
  async adminAiChat(@Headers('authorization') authorization: string | undefined, @Body() data: AdminAiChatDto) {
    const admin = await this.adminService.requireAdmin(authorization)
    this.aiService.assertReady()

    const userMessage = data.message.trim()
    if (!userMessage) throw new BadRequestException('消息内容不能为空。')

    let conversationId = data.conversationId?.trim() || ''
    let history: Array<{ sender: AiMessageSender; body: string }> = []

    if (conversationId) {
      const existing = await this.aiService.getAdminConversation(conversationId)
      if (!existing) throw new NotFoundException('AI 会话不存在或无权访问。')
      history = existing.messages
    } else {
      const created = await this.aiService.createConversation({
        roleScope: AiRoleScope.admin,
        contentId: data.contentId?.trim() || undefined,
        contentType: data.contentType,
        title: userMessage.slice(0, 40),
      })
      conversationId = created.id
    }

    const systemPrompt = [
      '你是个人网站“个人星球”的后台 AI 助手。',
      '你只能为已登录管理员提供内容管理、文章/作品分析、后台运营建议和技术解释。',
      '不要声称已经发布、删除或修改数据；涉及写入操作时只给建议，等待管理员确认。',
      '回答要清晰、直接，优先使用中文。',
    ].join('\n')

    const deepSeekMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...this.aiService.toDeepSeekMessages(history),
      { role: 'user' as const, content: this.aiService.clampContext(userMessage) },
    ]

    await this.aiService.addMessage({ conversationId, sender: AiMessageSender.user, body: userMessage })
    const response = await this.aiService.chat(deepSeekMessages, { temperature: 0.6 })
    const answer = this.aiService.getAssistantContent(response)
    const assistantMessage = await this.aiService.addMessage({
      conversationId,
      sender: AiMessageSender.assistant,
      body: answer,
      tokenUsage: this.aiService.getTokenUsage(response),
    })

    await this.adminService.audit(admin.id, 'admin_ai_chat', 'ai_conversation', conversationId, { messageId: assistantMessage.id })
    return { conversationId, message: assistantMessage, usage: { totalTokens: this.aiService.getTokenUsage(response) ?? null } }
  }
}