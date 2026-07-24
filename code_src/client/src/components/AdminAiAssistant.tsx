import { useEffect, useRef, useState } from 'react'
import { Bot, Cpu, Loader2, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { apiBase } from '../lib/api'
import MarkdownRenderer from "./MarkdownRenderer";

/**
 * AI 配置数据结构
 */
type AiConfig = {
  configured: boolean           // 是否已配置
  baseUrl: string               // API 基础 URL
  model: string                 // 使用的模型名称
  maxContextChars: number       // 最大上下文字符数
  visitorRateLimit: number      // 访客调用频率限制
  adminRateLimit: number        // 管理员调用频率限制
}

/**
 * 聊天消息数据结构
 */
type ChatMessage = {
  id: string                    // 消息ID
  sender: 'user' | 'assistant'  // 发送者（用户或助手）
  body: string                  // 消息内容
}

/**
 * 获取管理员认证令牌
 * @returns 令牌字符串（如果不存在则返回空字符串）
 */
function token() {
  return localStorage.getItem('personal-planet-admin-token') ?? ''
}

/**
 * 获取请求头（包含认证令牌）
 * @returns 请求头对象
 */
function headers() {
  return { Authorization: `Bearer ${token()}` }
}

/**
 * 解析错误信息
 * @param value - 错误对象或其他值
 * @returns 格式化的错误消息
 */
function errorText(value: unknown) {
  if (value && typeof value === 'object' && 'message' in value) 
    return String((value as { message: unknown }).message)
  return 'AI 助手暂时不可用，请稍后重试。'
}

/**
 * 管理员 AI 助手组件
 * 为管理员提供 AI 辅助功能，包括内容分析、文章构思、作品分析等
 */
export default function AdminAiAssistant() {
  // ========== 状态管理 ==========
  const [config, setConfig] = useState<AiConfig | null>(null)       // AI 配置信息
  const [messages, setMessages] = useState<ChatMessage[]>([])       // 聊天消息列表
  const [conversationId, setConversationId] = useState('')          // 当前会话 ID
  const [input, setInput] = useState('')                            // 用户输入内容
  const [notice, setNotice] = useState('')                          // 提示消息
  const [loading, setLoading] = useState(false)                      // 加载状态
  const bottomRef = useRef<HTMLDivElement | null>(null)              // 消息列表底部引用（用于自动滚动）

  // ========== 生命周期钩子 ==========

  /**
   * 组件挂载时加载 AI 配置
   */
  useEffect(() => {
    fetch(`${apiBase}/admin/ai/config`, { headers: headers() })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setConfig)
      .catch(() => setNotice('无法读取 AI 配置，请确认管理员登录状态。'))
  }, [])

  /**
   * 消息列表更新时自动滚动到底部
   */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  // ========== 核心方法 ==========

  /**
   * 提交聊天消息
   * @param event - 表单提交事件
   */
  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault()
    const message = input.trim()
    
    // 验证输入
    if (!message || loading) return

    // 添加本地消息（立即显示）
    const localId = `local-${Date.now()}`
    setMessages((current) => [...current, { id: localId, sender: 'user', body: message }])
    
    // 重置状态
    setInput('')
    setNotice('')
    setLoading(true)

    try {
      // 发送请求到后端
      const response = await fetch(`${apiBase}/admin/ai/chat`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationId: conversationId || undefined }),
      })

      const data = await response.json().catch(() => ({}))
      
      // 处理响应错误
      if (!response.ok) throw data

      // 更新会话 ID 和消息列表
      setConversationId(data.conversationId)
      setMessages((current) => [...current, { id: data.message.id, sender: 'assistant', body: data.message.body }])
    } catch (error) {
      // 显示错误消息
      setNotice(errorText(error))
    } finally {
      setLoading(false)
    }
  }

  /**
   * 快捷提问建议列表
   */
  const suggestions = ['分析最近内容还缺什么', '帮我规划下一篇文章', '总结作品页面可以优化的地方']

  return <section className="admin-module admin-ai-module">
    <div className="admin-ai-head">
      <div>
        <p className="eyebrow">AI ASSISTANT</p>
        <h1>AI 助手</h1>
        <p className="admin-intro">使用 DeepSeek 辅助内容管理、文章构思、作品分析和后台运营判断。</p>
      </div>
      <div className={config?.configured ? 'admin-ai-status ready' : 'admin-ai-status'}>
        <ShieldCheck size={18} />
        <span>{config?.configured ? 'DeepSeek 已配置' : '等待配置 API Key'}</span>
      </div>
    </div>

    <div className="admin-ai-grid">
      <aside className="admin-ai-info">
        <div><Cpu size={18} /><strong>模型</strong><span>{config?.model ?? '读取中'}</span></div>
        <div><Sparkles size={18} /><strong>上下文长度</strong><span>{config?.maxContextChars ?? '-'} 字符</span></div>
        <div><Bot size={18} /><strong>当前会话</strong><span>{conversationId || '尚未开始'}</span></div>
        {!config?.configured && <p>在 `code_src/server/.env` 中配置 `DEEPSEEK_API_KEY` 后重启后端，即可真正调用模型。</p>}
      </aside>

      <div className="admin-ai-chat">
        <div className="admin-ai-messages">
          {!messages.length && <div className="admin-ai-empty"><Bot size={34} /><strong>先问我一个后台问题</strong><span>比如让 AI 分析内容结构、给文章选题，或者帮作品详情补充表达。</span></div>}
          {messages.map((message) => <article className={`admin-ai-message ${message.sender}`} key={message.id}>
            <span>{message.sender === 'user' ? '管理员' : 'AI 助手'}</span>
            <MarkdownRenderer content={message.body} />
          </article>)}
          {loading && <article className="admin-ai-message assistant"><span>AI 助手</span><p><Loader2 className="admin-ai-spin" size={16} /> 正在思考…</p></article>}
          <div ref={bottomRef} />
        </div>

        <div className="admin-ai-suggestions">
          {suggestions.map((item) => <button type="button" key={item} onClick={() => setInput(item)}>{item}</button>)}
        </div>

        {notice && <p className="admin-notice admin-ai-notice">{notice}</p>}
        <form className="admin-ai-form" onSubmit={submit}>
          <textarea value={input} maxLength={4000} rows={3} placeholder="向 AI 助手提问，例如：帮我分析作品详情页还缺什么内容…" onChange={(event) => setInput(event.target.value)} />
          <button type="submit" disabled={loading || !input.trim()}><Send size={17} />发送</button>
        </form>
      </div>
    </div>
  </section>
}