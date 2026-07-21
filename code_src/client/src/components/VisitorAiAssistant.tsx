import { useEffect, useState } from 'react'
import { Bot, Loader2, MessageCircle, Send, X } from 'lucide-react'
import { apiBase } from '../lib/api'

type ChatMessage = { id: string; sender: 'user' | 'assistant'; body: string }

function visitorKey() {
  const key = localStorage.getItem('personal-planet-visitor-key') || crypto.randomUUID()
  localStorage.setItem('personal-planet-visitor-key', key)
  return key
}

export default function VisitorAiAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [pageContext, setPageContext] = useState<{ contentType?: 'article' | 'project'; contentId?: string }>({})

  useEffect(() => {
    const detail = document.querySelector<HTMLElement>('[data-content-type][data-content-id]')
    if (detail) {
      setPageContext({
        contentType: detail.dataset.contentType as 'article' | 'project',
        contentId: detail.dataset.contentId,
      })
    }
  }, [])

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault()
    const message = input.trim()
    if (!message || loading) return
    setMessages((current) => [...current, { id: `local-${Date.now()}`, sender: 'user', body: message }])
    setInput('')
    setNotice('')
    setLoading(true)
    try {
      const response = await fetch(`${apiBase}/ai/visitor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Visitor-Key': visitorKey() },
        body: JSON.stringify({ message, conversationId: conversationId || undefined, ...pageContext }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(String(data.message ?? 'AI 暂时不可用。'))
      setConversationId(data.conversationId)
      setMessages((current) => [...current, { id: data.message.id, sender: 'assistant', body: data.message.body }])
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'AI 暂时不可用。')
    } finally {
      setLoading(false)
    }
  }

  return <div className={`visitor-ai ${open ? 'open' : ''}`}>
    {open && <section className="visitor-ai-panel">
      <div className="visitor-ai-head"><span><Bot size={18} />AI 导览</span><button type="button" onClick={() => setOpen(false)}><X size={16} /></button></div>
      <div className="visitor-ai-body">
        {!messages.length && <p className="visitor-ai-empty">可以问我：这个网站有哪些作品？这篇文章讲了什么？作者在探索什么方向？</p>}
        {messages.map((message) => <article key={message.id} className={message.sender}><span>{message.sender === 'user' ? '你' : 'AI'}</span><p>{message.body}</p></article>)}
        {loading && <article className="assistant"><span>AI</span><p><Loader2 className="admin-ai-spin" size={14} /> 正在整理回答...</p></article>}
      </div>
      {notice && <p className="visitor-ai-notice">{notice}</p>}
      <form onSubmit={submit}>
        <input value={input} maxLength={800} placeholder="问问这个星球..." onChange={(event) => setInput(event.target.value)} />
        <button type="submit" disabled={loading || !input.trim()}><Send size={15} /></button>
      </form>
    </section>}
    <button className="visitor-ai-toggle" type="button" aria-label="打开 AI 助手" onClick={() => setOpen((value) => !value)}>
      <MessageCircle size={22} /><i></i>
    </button>
  </div>
}
