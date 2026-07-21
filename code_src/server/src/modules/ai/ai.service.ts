import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { AiMessageSender, AiRoleScope, ContentType } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.module'

type DeepSeekMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type DeepSeekChatOptions = {
  temperature?: number
  maxTokens?: number
}

type DeepSeekConfig = {
  apiKey: string
  baseUrl: string
  model: string
  maxContextChars: number
  visitorRateLimit: number
  adminRateLimit: number
}

type DeepSeekChatResponse = {
  choices?: Array<{ message?: { content?: string } }>
  usage?: { total_tokens?: number }
}

function nowIso() {
  return new Date().toISOString()
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)
  private readonly config: DeepSeekConfig

  constructor(private readonly prisma: PrismaService) {
    this.config = this.readConfig()
  }

  getStatus() {
    return {
      configured: Boolean(this.config.apiKey),
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      maxContextChars: this.config.maxContextChars,
      visitorRateLimit: this.config.visitorRateLimit,
      adminRateLimit: this.config.adminRateLimit,
    }
  }

  assertReady() {
    this.assertConfigured()
  }

  async createConversation(input: {
    roleScope: AiRoleScope
    contentId?: string
    contentType?: ContentType
    title?: string
  }) {
    return this.prisma.aiConversation.create({
      data: {
        roleScope: input.roleScope,
        contentId: input.contentId ?? null,
        contentType: input.contentType ?? null,
        title: input.title?.trim() || null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    })
  }

  async getAdminConversation(id: string) {
    return this.prisma.aiConversation.findFirst({
      where: { id, roleScope: AiRoleScope.admin },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
    })
  }

  async addMessage(input: {
    conversationId: string
    sender: AiMessageSender
    body: string
    tokenUsage?: number
  }) {
    return this.prisma.aiMessage.create({
      data: {
        conversationId: input.conversationId,
        sender: input.sender,
        body: input.body,
        tokenUsage: input.tokenUsage ?? null,
        createdAt: nowIso(),
      },
    })
  }

  async chat(messages: DeepSeekMessage[], options: DeepSeekChatOptions = {}) {
    this.assertConfigured()
    const response = await fetch(this.deepSeekUrl('/chat/completions'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      this.logger.warn(`DeepSeek request failed: ${response.status} ${body.slice(0, 300)}`)
      throw new ServiceUnavailableException('DeepSeek 调用失败，请稍后重试。')
    }

    return response.json() as Promise<DeepSeekChatResponse>
  }

  getAssistantContent(response: DeepSeekChatResponse) {
    const content = response.choices?.[0]?.message?.content?.trim()
    if (!content) throw new ServiceUnavailableException('DeepSeek 没有返回有效内容。')
    return content
  }

  getTokenUsage(response: DeepSeekChatResponse) {
    return response.usage?.total_tokens
  }

  toDeepSeekMessages(messages: Array<{ sender: AiMessageSender; body: string }>): DeepSeekMessage[] {
    return messages
      .filter((message) => message.sender === AiMessageSender.user || message.sender === AiMessageSender.assistant)
      .map((message) => ({ role: message.sender, content: this.clampContext(message.body) }))
  }

  clampContext(value: string) {
    if (value.length <= this.config.maxContextChars) return value
    return value.slice(0, this.config.maxContextChars)
  }

  private assertConfigured() {
    if (!this.config.apiKey) {
      throw new ServiceUnavailableException('DeepSeek API Key 尚未配置。')
    }
  }

  private deepSeekUrl(path: string) {
    return `${this.config.baseUrl.replace(/\/$/, '')}${path}`
  }

  private readConfig(): DeepSeekConfig {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY ?? '',
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
      model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
      maxContextChars: this.readPositiveInt('AI_MAX_CONTEXT_CHARS', 12000),
      visitorRateLimit: this.readPositiveInt('AI_VISITOR_RATE_LIMIT', 20),
      adminRateLimit: this.readPositiveInt('AI_ADMIN_RATE_LIMIT', 100),
    }
  }

  private readPositiveInt(key: string, fallback: number) {
    const value = Number(process.env[key])
    return Number.isInteger(value) && value > 0 ? value : fallback
  }
}
