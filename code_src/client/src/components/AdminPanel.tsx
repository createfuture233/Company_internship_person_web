import { useEffect, useState } from 'react'
import { ExternalLink, Eye, Image, Plus, Save, ShieldAlert, Tag, Trash2 } from 'lucide-react'
import { apiBase } from '../lib/api'

type ContentType = 'article' | 'project'
type ContentStatus = 'draft' | 'published' | 'archived'
type ContentTag = { id: number; name: string }
type ContentItem = {
  id: string
  type: ContentType
  slug: string
  title: string
  summary: string
  body: string
  coverUrl: string | null
  stack: string | null
  status: ContentStatus
  tags: ContentTag[]
}
type ContentForm = Omit<ContentItem, 'tags'> & { tagsText: string }

const blankContent = (type: ContentType): ContentForm => ({
  id: '', slug: '', type,
  title: type === 'article' ? '未命名文章' : '未命名作品',
  summary: '在这里填写内容摘要。',
  body: '在这里填写详情正文。',
  coverUrl: '',
  stack: type === 'project' ? 'Astro · React · NestJS' : '',
  status: 'published',
  tagsText: '',
})

function toForm(item: ContentItem): ContentForm {
  return { ...item, coverUrl: item.coverUrl ?? '', stack: item.stack ?? '', tagsText: item.tags.map((tag) => tag.name).join(', ') }
}

function publicHref(item: Pick<ContentItem, 'type' | 'id' | 'slug'>) {
  return item.type === 'article' ? `/articles/${item.id}` : `/projects/${item.slug}`
}

export default function AdminPanel({ contentType }: { contentType: ContentType }) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [form, setForm] = useState<ContentForm | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [message, setMessage] = useState('正在验证管理员权限…')
  const [saving, setSaving] = useState(false)
  const typeName = contentType === 'article' ? '文章' : '作品'

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('personal-planet-admin-token')}` })
  const load = async () => {
    const response = await fetch(`${apiBase}/admin/content`, { headers: headers() })
    if (!response.ok) throw new Error('unauthorized')
    const data = await response.json() as ContentItem[]
    const scoped = data.filter((item) => item.type === contentType)
    setItems(scoped)
    return scoped
  }

  useEffect(() => {
    if (!localStorage.getItem('personal-planet-admin-token')) { setMessage('请返回首页并点击右侧星球插画登录。'); return }
    load().then((scoped) => {
      const requestedId = new URLSearchParams(window.location.search).get('id')
      const preferred = scoped.find((item) => item.id === requestedId) ?? scoped[0]
      if (preferred) { setSelectedKey(preferred.id); setForm(toForm(preferred)) }
      else createNew()
      setMessage('')
    }).catch(() => { localStorage.removeItem('personal-planet-admin-token'); setMessage('登录状态已失效，请返回首页重新登录。') })
  }, [contentType])

  function chooseItem(id: string) {
    const next = items.find((item) => item.id === id)
    if (!next) return
    setSelectedKey(id); setIsNew(false); setForm(toForm(next)); setMessage('')
  }

  function createNew() {
    setIsNew(true); setSelectedKey(''); setForm(blankContent(contentType)); setMessage(`正在创建新的${typeName}，填写后点击保存。`)
  }

  async function save(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (!form) return
    setSaving(true); setMessage('')
    const payload = {
      ...(isNew ? { type: form.type } : {}),
      title: form.title, summary: form.summary, body: form.body,
      coverUrl: form.coverUrl, stack: form.stack, status: form.status,
      tags: form.tagsText.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
    }
    try {
      const endpoint = isNew ? '/admin/content' : `/admin/content/${form.type}/${form.id}`
      const response = await fetch(apiBase + endpoint, { method: isNew ? 'POST' : 'PATCH', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!response.ok) throw new Error('save failed')
      const updated = await response.json() as ContentItem
      const next = toForm(updated)
      setItems((current) => isNew ? [updated, ...current] : current.map((item) => item.id === updated.id ? updated : item))
      setSelectedKey(updated.id); setForm(next); setIsNew(false)
      setMessage(updated.status === 'published' ? '已保存并公开发布，可打开真实页面查看。' : '已保存。当前状态不会出现在公开页面。')
    } catch { setMessage('保存失败，请确认后端服务正在运行且管理员状态有效。') } finally { setSaving(false) }
  }

  async function remove() {
    if (!form || isNew || !confirm(`确定删除“${form.title}”吗？此操作不可恢复。`)) return
    try {
      const response = await fetch(`${apiBase}/admin/content/${form.type}/${form.id}`, { method: 'DELETE', headers: headers() })
      if (!response.ok) throw new Error('delete failed')
      const next = items.filter((item) => item.id !== form.id)
      setItems(next)
      if (next[0]) { setSelectedKey(next[0].id); setForm(toForm(next[0])); setIsNew(false) } else createNew()
      setMessage('内容已删除。')
    } catch { setMessage('删除失败，请稍后重试。') }
  }

  if (!form) return <section className="admin-panel"><ShieldAlert size={28} /><p>{message}</p></section>

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><p className="eyebrow">{contentType === 'article' ? 'ARTICLE MANAGER' : 'PROJECT MANAGER'}</p><h1>{typeName}管理</h1><p>管理正文、封面、状态与标签；右侧实时预览，发布后可直接进入公开详情页。</p></div>
      <label className="admin-content-select">选择{typeName}
        <select value={selectedKey} onChange={(event) => chooseItem(event.target.value)}>
          {!selectedKey && <option value="">新建{typeName}（未保存）</option>}
          {items.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}
        </select>
      </label>
    </div>

    <div className="admin-create-actions">
      <button type="button" onClick={createNew}><Plus size={16} />新增{typeName}</button>
      {!isNew && form.status === 'published' && <a className="admin-open-page" href={publicHref(form)} target="_blank" rel="noreferrer"><ExternalLink size={16} />打开真实页面</a>}
      {!isNew && <button className="admin-danger" type="button" onClick={remove}><Trash2 size={16} />删除{typeName}</button>}
    </div>

    <div className="admin-workbench">
      <form className="admin-editor" onSubmit={save}>
        <label>标题<input value={form.title} maxLength={120} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>摘要<input value={form.summary} maxLength={500} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
        <label>封面图地址（可空）<input type="url" value={form.coverUrl ?? ''} placeholder="https://example.com/cover.jpg" onChange={(event) => setForm({ ...form, coverUrl: event.target.value })} /></label>
        {contentType === 'project' && <label>技术栈（可空）<input value={form.stack ?? ''} placeholder="Astro · React · NestJS" maxLength={500} onChange={(event) => setForm({ ...form, stack: event.target.value })} /></label>}
        <label><Tag size={15} />标签（用逗号分隔）<input value={form.tagsText} placeholder="设计, 前端, 随笔" onChange={(event) => setForm({ ...form, tagsText: event.target.value })} /></label>
        <label>发布状态<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ContentStatus })}><option value="draft">draft · 草稿</option><option value="published">published · 已发布</option><option value="archived">archived · 已归档</option></select></label>
        <label>详情正文<textarea value={form.body} maxLength={5000} rows={12} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
        <div className="admin-save-row"><span aria-live="polite">{message}</span><button className="comment-submit" type="submit" disabled={saving}><Save size={16} />{saving ? '保存中…' : isNew ? `发布${typeName}` : '保存更改'}</button></div>
      </form>

      <aside className="admin-preview" aria-label="详情页实时预览">
        <div className="admin-preview-label"><Eye size={16} /> 详情页实时预览</div>
        <article className="admin-preview-detail">
          {form.coverUrl && <img className="admin-cover-preview" src={form.coverUrl} alt="封面预览" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
          {!form.coverUrl && <div className="admin-cover-placeholder"><Image size={25} />未设置封面图</div>}
          <p className="eyebrow">{contentType === 'article' ? 'ARTICLE DETAIL' : 'PROJECT DETAIL'} · {form.status}</p>
          <h1>{form.title || `未命名${typeName}`}</h1>
          <p className="detail-lead">{form.summary || '这里将显示摘要。'}</p>
          {contentType === 'project' && form.stack && <p className="admin-preview-stack">{form.stack}</p>}
          {form.tagsText && <div className="admin-preview-tags">{form.tagsText.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean).map((tag) => <span key={tag}>#{tag}</span>)}</div>}
          <div className="detail-body"><h2>{contentType === 'article' ? '正文内容' : '项目说明'}</h2><p>{form.body || '这里将显示详情正文。'}</p></div>
        </article>
      </aside>
    </div>
  </section>
}