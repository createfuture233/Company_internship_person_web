import { HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { AiMessageSender, AiRoleScope, Content, ContentType } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.module'

export type DeepSeekMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type DeepSeekChatOptions = {
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

export type DeepSeekChatResponse = {
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
  private readonly visitorBuckets = new Map<string, number[]>()
  private readonly adminBuckets = new Map<string, number[]>()

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

  assertRateLimit(scope: AiRoleScope, key: string) {
    const limit = scope === AiRoleScope.admin ? this.config.adminRateLimit : this.config.visitorRateLimit
    const bucket = scope === AiRoleScope.admin ? this.adminBuckets : this.visitorBuckets
    const now = Date.now()
    const windowStart = now - 60 * 60 * 1000
    const history = (bucket.get(key) ?? []).filter((time) => time > windowStart)
    if (history.length >= limit) throw new HttpException('AI 使用过于频繁，请稍后再试。', HttpStatus.TOO_MANY_REQUESTS)
    history.push(now)
    bucket.set(key, history)
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

  async getConversation(id: string, roleScope: AiRoleScope) {
    return this.prisma.aiConversation.findFirst({
      where: { id, roleScope },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 24 } },
    })
  }

  async touchConversation(id: string) {
    await this.prisma.aiConversation.update({ where: { id }, data: { updatedAt: nowIso() } })
  }

  async addMessage(input: {
    conversationId: string
    sender: AiMessageSender
    body: string
    tokenUsage?: number
  }) {
    await this.touchConversation(input.conversationId)
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
      throw new ServiceUnavailableException(`DeepSeek 调用失败（HTTP ${response.status}），请检查模型名、Key 余额或网络。`)
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

  clampContext(value: string, ratio = 1) {
    const limit = Math.max(500, Math.floor(this.config.maxContextChars * ratio))
    if (value.length <= limit) return value
    return value.slice(0, limit) + '\n\n[内容过长，已截断]'
  }

  contentContext(content: Pick<Content, 'type' | 'title' | 'summary' | 'body' | 'stack'> & { tags?: Array<{ name: string }> }) {
    const tags = content.tags?.map((tag) => tag.name).join('、') || '无'
    return [
      `类型：${content.type === ContentType.article ? '文章' : '作品'}`,
      `标题：${content.title}`,
      `摘要：${content.summary}`,
      content.stack ? `技术栈：${content.stack}` : '',
      `标签：${tags}`,
      `正文：${this.clampContext(content.body, 0.55)}`,
    ].filter(Boolean).join('\n')
  }

  parseGeneratedJson(answer: string) {
    const fenced = answer.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
    const raw = (fenced ?? answer).trim()
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end < start) throw new ServiceUnavailableException('AI 没有返回可解析的 JSON 内容。')
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      title?: string
      summary?: string
      body?: string
      coverUrl?: string
      stack?: string
      tags?: string[]
    }
    if (!parsed.title || !parsed.summary || !parsed.body) throw new ServiceUnavailableException('AI 返回内容缺少 title、summary 或 body。')
    return {
      title: String(parsed.title).slice(0, 120),
      summary: String(parsed.summary).slice(0, 500),
      body: String(parsed.body).slice(0, 5000),
      coverUrl: parsed.coverUrl ? String(parsed.coverUrl).slice(0, 2000) : null,
      stack: parsed.stack ? String(parsed.stack).slice(0, 500) : null,
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 10) : [],
    }
  }

  private assertConfigured() {
    if (!this.config.apiKey) throw new ServiceUnavailableException('DeepSeek API Key 尚未配置。')
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
