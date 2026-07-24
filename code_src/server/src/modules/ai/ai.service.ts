/**
 * AI服务
 * 提供与DeepSeek API的交互能力，包括对话管理、内容生成、文件分析等功能
 */
import { HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { AiMessageSender, AiRoleScope, Content, ContentType } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.module'

/** DeepSeek消息类型 */
export type DeepSeekMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** DeepSeek对话选项 */
export type DeepSeekChatOptions = {
  temperature?: number    // 温度参数，控制输出随机性
  maxTokens?: number      // 最大token数
}

/** DeepSeek配置类型 */
type DeepSeekConfig = {
  apiKey: string           // API密钥
  baseUrl: string          // API基础URL
  model: string            // 模型名称
  maxContextChars: number  // 最大上下文字符数
  visitorRateLimit: number // 访客调用频率限制（每小时）
  adminRateLimit: number   // 管理员调用频率限制（每小时）
}

/** DeepSeek响应类型 */
export type DeepSeekChatResponse = {
  choices?: Array<{ message?: { content?: string } }>
  usage?: { total_tokens?: number }
}

/**
 * 获取当前时间的ISO字符串
 */
function nowIso() {
  return new Date().toISOString()
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)           // 日志记录器
  private readonly config: DeepSeekConfig                         // DeepSeek配置
  private readonly visitorBuckets = new Map<string, number[]>()   // 访客限流桶（记录每小时调用次数）
  private readonly adminBuckets = new Map<string, number[]>()     // 管理员限流桶（记录每小时调用次数）

  /**
   * 构造函数
   * @param prisma - Prisma数据库服务
   */
  constructor(private readonly prisma: PrismaService) {
    this.config = this.readConfig()
  }

  /**
   * 获取AI服务状态配置
   * @returns 配置状态对象
   */
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

  /**
   * 断言AI服务已配置就绪
   * @throws ServiceUnavailableException - 当API Key未配置时
   */
  assertReady() {
    this.assertConfigured()
  }

  /**
   * 检查调用频率限制
   * @param scope - 用户角色范围（admin/visitor）
   * @param key - 用户标识
   * @throws HttpException - 超过频率限制时
   */
  assertRateLimit(scope: AiRoleScope, key: string) {
    const limit = scope === AiRoleScope.admin ? this.config.adminRateLimit : this.config.visitorRateLimit
    const bucket = scope === AiRoleScope.admin ? this.adminBuckets : this.visitorBuckets
    const now = Date.now()
    const windowStart = now - 60 * 60 * 1000  // 1小时窗口
    const history = (bucket.get(key) ?? []).filter((time) => time > windowStart)
    if (history.length >= limit) throw new HttpException('AI 使用过于频繁，请稍后再试。', HttpStatus.TOO_MANY_REQUESTS)
    history.push(now)
    bucket.set(key, history)
  }

  /**
   * 创建新的AI对话会话
   * @param input - 会话创建参数
   * @returns 创建的会话对象
   */
  async createConversation(input: {
    roleScope: AiRoleScope     // 用户角色范围
    contentId?: string         // 关联的内容ID
    contentType?: ContentType  // 关联的内容类型
    title?: string             // 会话标题
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

  /**
   * 获取对话会话详情
   * @param id - 会话ID
   * @param roleScope - 用户角色范围
   * @returns 会话对象（包含消息列表）
   */
  async getConversation(id: string, roleScope: AiRoleScope) {
    return this.prisma.aiConversation.findFirst({
      where: { id, roleScope },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 24 } },
    })
  }

  /**
   * 更新会话最后活跃时间
   * @param id - 会话ID
   */
  async touchConversation(id: string) {
    await this.prisma.aiConversation.update({ where: { id }, data: { updatedAt: nowIso() } })
  }

  /**
   * 向会话添加消息
   * @param input - 消息参数
   * @returns 创建的消息对象
   */
  async addMessage(input: {
    conversationId: string   // 会话ID
    sender: AiMessageSender  // 发送者类型
    body: string             // 消息内容
    tokenUsage?: number      // token使用量
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

  /**
   * 调用DeepSeek API进行对话
   * @param messages - 消息列表
   * @param options - 对话选项
   * @returns API响应
   * @throws ServiceUnavailableException - API调用失败时
   */
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

  /**
   * 从API响应中提取助手回复内容
   * @param response - API响应
   * @returns 助手回复内容
   * @throws ServiceUnavailableException - 响应无效时
   */
  getAssistantContent(response: DeepSeekChatResponse) {
    const content = response.choices?.[0]?.message?.content?.trim()
    if (!content) throw new ServiceUnavailableException('DeepSeek 没有返回有效内容。')
    return content
  }

  /**
   * 从API响应中提取token使用量
   * @param response - API响应
   * @returns token使用量
   */
  getTokenUsage(response: DeepSeekChatResponse) {
    return response.usage?.total_tokens
  }

  /**
   * 将消息数组转换为DeepSeek格式
   * @param messages - 消息数组
   * @returns DeepSeek格式消息数组
   */
  toDeepSeekMessages(messages: Array<{ sender: AiMessageSender; body: string }>): DeepSeekMessage[] {
    return messages
      .filter((message) => message.sender === AiMessageSender.user || message.sender === AiMessageSender.assistant)
      .map((message) => ({ role: message.sender, content: this.clampContext(message.body) }))
  }

  /**
   * 截断过长的文本内容
   * @param value - 原始文本
   * @param ratio - 比例系数
   * @returns 截断后的文本
   */
  clampContext(value: string, ratio = 1) {
    const limit = Math.max(500, Math.floor(this.config.maxContextChars * ratio))
    if (value.length <= limit) return value
    return value.slice(0, limit) + '\n\n[内容过长，已截断]'
  }

  /**
   * 构建内容上下文字符串（用于AI理解参考）
   * @param content - 内容对象
   * @returns 格式化的上下文字符串
   */
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

  /**
   * 解析AI生成的JSON内容
   * @param answer - AI返回的原始内容
   * @returns 解析后的内容对象
   * @throws ServiceUnavailableException - 解析失败时
   */
  parseGeneratedJson(answer: string) {
    // 尝试提取markdown代码块中的JSON
    const fenced = answer.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
    const raw = (fenced ?? answer).trim()
    
    // 定位JSON对象的首尾
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end < start) throw new ServiceUnavailableException('AI 没有返回可解析的 JSON 内容。')
    
    // 解析JSON
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      title?: string
      summary?: string
      body?: string
      coverUrl?: string
      stack?: string
      tags?: string[]
    }
    
    // 验证必填字段
    if (!parsed.title || !parsed.summary || !parsed.body) throw new ServiceUnavailableException('AI 返回内容缺少 title、summary 或 body。')
    
    // 安全截断并返回
    return {
      title: String(parsed.title).slice(0, 120),
      summary: String(parsed.summary).slice(0, 500),
      body: String(parsed.body).slice(0, 5000),
      coverUrl: parsed.coverUrl ? String(parsed.coverUrl).slice(0, 2000) : null,
      stack: parsed.stack ? String(parsed.stack).slice(0, 500) : null,
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 10) : [],
    }
  }

  /**
   * 断言API Key已配置
   * @throws ServiceUnavailableException - API Key未配置时
   */
  private assertConfigured() {
    if (!this.config.apiKey) throw new ServiceUnavailableException('DeepSeek API Key 尚未配置。')
  }

  /**
   * 构建DeepSeek API完整URL
   * @param path - API路径
   * @returns 完整URL
   */
  private deepSeekUrl(path: string) {
    return `${this.config.baseUrl.replace(/\/$/, '')}${path}`
  }

  /**
   * 读取环境变量配置
   * @returns 配置对象
   */
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

  /**
   * 安全读取正整数值的环境变量
   * @param key - 环境变量名
   * @param fallback - 默认值
   * @returns 正整数值
   */
  private readPositiveInt(key: string, fallback: number) {
    const value = Number(process.env[key])
    return Number.isInteger(value) && value > 0 ? value : fallback
  }
}