import { useEffect, useState } from 'react'
import { Heart, MessageCircle, Send } from 'lucide-react'

type ContentType = 'article' | 'project'
type CommentSort = 'latest' | 'likes'

type CommentItem = {
  id: string
  name: string
  avatar: string
  content: string
  likes: number
  createdAt: string
}

type CommentsProps = {
  contentType: ContentType
  contentId: string
}

const apiBase = import.meta.env.PUBLIC_API_BASE ?? 'http://localhost:3000/api'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function Comments({ contentType, contentId }: CommentsProps) {
  const [sort, setSort] = useState<CommentSort>('latest')
  const [comments, setComments] = useState<CommentItem[]>([])
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const controller = new AbortController()

    async function loadComments() {
      setLoading(true)
      setMessage('')
      try {
        const params = new URLSearchParams({ contentType, contentId, sort })
        const response = await fetch(apiBase + '/comments?' + params.toString(), { signal: controller.signal })
        if (!response.ok) throw new Error('load failed')
        const data = await response.json() as { items: CommentItem[] }
        setComments(data.items)
      } catch (error) {
        if (!controller.signal.aborted) setMessage('评论暂时无法加载，请确认后端服务已启动。')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadComments()
    return () => controller.abort()
  }, [contentId, contentType, sort])

  async function submitComment(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (!name.trim() || !content.trim()) {
      setMessage('请填写昵称和评论内容。')
      return
    }

    setSending(true)
    setMessage('')
    try {
      const response = await fetch(apiBase + '/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType, contentId, name, content }),
      })
      if (!response.ok) throw new Error('submit failed')
      const created = await response.json() as CommentItem
      setComments((current) => sort === 'latest' ? [created, ...current] : [...current, created].sort((a, b) => b.likes - a.likes))
      setName('')
      setContent('')
      setMessage('评论已发布。')
    } catch {
      setMessage('发布失败，请确认后端服务正在运行。')
    } finally {
      setSending(false)
    }
  }

  async function likeComment(id: string) {
    if (likedIds.has(id)) return

    try {
      const response = await fetch(apiBase + '/comments/' + id + '/like', { method: 'POST' })
      if (!response.ok) throw new Error('like failed')
      const updated = await response.json() as CommentItem
      setComments((current) => current
        .map((item) => item.id === id ? { ...item, likes: updated.likes } : item)
        .sort((a, b) => sort === 'likes' ? b.likes - a.likes : 0))
      setLikedIds((current) => new Set([...current, id]))
    } catch {
      setMessage('点赞失败，请稍后再试。')
    }
  }

  return (
    <section className="comments-section" aria-labelledby="comments-title">
      <div className="comments-header">
        <div>
          <p className="eyebrow">SIGNAL BOARD</p>
          <h2 id="comments-title">评论与交流</h2>
          <p>留下你的想法，让这次阅读或创作继续延伸。</p>
        </div>
        <div className="comment-sort" aria-label="评论排序">
          <button className={sort === 'latest' ? 'active' : ''} type="button" onClick={() => setSort('latest')}>最新</button>
          <button className={sort === 'likes' ? 'active' : ''} type="button" onClick={() => setSort('likes')}>点赞最多</button>
        </div>
      </div>

      <form className="comment-form" onSubmit={submitComment}>
        <label>
          <span>昵称</span>
          <input value={name} maxLength={30} onChange={(event) => setName(event.target.value)} placeholder="怎么称呼你？" />
        </label>
        <label>
          <span>评论内容</span>
          <textarea value={content} maxLength={600} onChange={(event) => setContent(event.target.value)} placeholder="写下此刻的想法…" rows={4} />
        </label>
        <div className="comment-form-actions">
          <span aria-live="polite">{message}</span>
          <button className="comment-submit" type="submit" disabled={sending}>
            <Send size={16} /> {sending ? '发布中…' : '发布评论'}
          </button>
        </div>
      </form>

      <div className="comment-list" aria-live="polite">
        {loading && <p className="comment-empty">正在接收评论信号…</p>}
        {!loading && !comments.length && !message && <p className="comment-empty">还没有评论，成为第一位留下信号的人。</p>}
        {!loading && comments.map((comment) => (
          <article className="comment-item" key={comment.id}>
            <span className="comment-avatar" aria-hidden="true">{comment.avatar}</span>
            <div className="comment-copy">
              <div className="comment-meta">
                <strong>{comment.name}</strong>
                <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
              </div>
              <p>{comment.content}</p>
              <button
                className={'comment-like' + (likedIds.has(comment.id) ? ' liked' : '')}
                type="button"
                onClick={() => void likeComment(comment.id)}
                aria-label={'给 ' + comment.name + ' 的评论点赞'}
              >
                <Heart size={16} fill={likedIds.has(comment.id) ? 'currentColor' : 'none'} />
                <span>{comment.likes}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
      <p className="comment-note"><MessageCircle size={15} /> 点赞在当前浏览器会话中每条评论只能操作一次。</p>
    </section>
  )
}