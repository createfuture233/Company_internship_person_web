import { apiBase } from '../lib/api'
import { useEffect, useState } from 'react'
import { Eye, Plus, Save, ShieldAlert } from 'lucide-react'

type ContentType = 'article' | 'project'
type ContentItem = { id: string; type: ContentType; title: string; summary: string; body: string }


const blankContent = (type: ContentType): ContentItem => ({
  id: '',
  type,
  title: type === 'article' ? '未命名文章' : '未命名作品',
  summary: '在这里填写内容摘要。',
  body: '在这里填写详情正文。',
})

export default function AdminPanel({ contentType }: { contentType?: ContentType }) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [form, setForm] = useState<ContentItem | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [status, setStatus] = useState('正在验证管理员权限…')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('personal-planet-admin-token')
    if (!token) {
      setStatus('请返回首页并点击右侧星球插画登录。')
      return
    }
    fetch(apiBase + '/admin/content', { headers: { Authorization: 'Bearer ' + token } })
      .then(async (response) => {
        if (!response.ok) throw new Error('unauthorized')
        return response.json() as Promise<ContentItem[]>
      })
      .then((data) => {
        const scoped = contentType ? data.filter((item) => item.type === contentType) : data
        setItems(scoped)
        const search = new URLSearchParams(window.location.search)
        const requestedKey = search.get('type') + ':' + search.get('id')
        const preferred = scoped.find((item) => item.type + ':' + item.id === requestedKey) ?? data[0]
        if (preferred) {
          setSelectedKey(preferred.type + ':' + preferred.id)
          setForm({ ...preferred })
        }
        setStatus('')
      })
      .catch(() => {
        localStorage.removeItem('personal-planet-admin-token')
        setStatus('登录状态已失效，请返回首页重新登录。')
      })
  }, [contentType])

  function chooseItem(key: string) {
    const next = items.find((item) => item.type + ':' + item.id === key)
    setSelectedKey(key)
    setIsNew(false)
    if (next) setForm({ ...next })
    setStatus('')
  }

  function createNew(type: ContentType) {
    setIsNew(true)
    setSelectedKey('')
    setForm(blankContent(type))
    setStatus('正在创建新的' + (type === 'article' ? '文章' : '作品') + '，填写后点击保存。')
  }

  async function save(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (!form) return
    const token = localStorage.getItem('personal-planet-admin-token')
    if (!token) {
      setStatus('登录状态已失效，请重新登录。')
      return
    }
    setSaving(true)
    setStatus('')
    try {
      const endpoint = isNew ? '/admin/content' : '/admin/content/' + form.type + '/' + form.id
      const response = await fetch(apiBase + endpoint, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(isNew
          ? { type: form.type, title: form.title, summary: form.summary, body: form.body }
          : { title: form.title, summary: form.summary, body: form.body }),
      })
      if (!response.ok) throw new Error('save failed')
      const updated = await response.json() as ContentItem
      setItems((current) => isNew ? [updated, ...current] : current.map((item) => item.type === updated.type && item.id === updated.id ? updated : item))
      setSelectedKey(updated.type + ':' + updated.id)
      setForm(updated)
      setIsNew(false)
      setStatus(isNew ? '已新增并保存。可继续编辑，或前往对应详情查看。' : '已保存，详情页刷新后会同步本次修改。')
    } catch {
      setStatus('保存失败，请确认后端服务正在运行且管理员状态有效。')
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <section className="admin-panel"><ShieldAlert size={28} /><p>{status}</p></section>

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><p className="eyebrow">ADMIN CONSOLE</p><h1>后台</h1><p>内容管理：左侧编辑，右侧会即时模拟文章或作品详情页的展示结果。</p></div>
      <label className="admin-content-select">编辑对象
        <select value={selectedKey} onChange={(event) => chooseItem(event.target.value)}>
          {!selectedKey && <option value="">新建内容（未保存）</option>}
          {items.map((item) => <option key={item.type + item.id} value={item.type + ':' + item.id}>{item.type === 'article' ? '文章' : '作品'} · {item.title}</option>)}
        </select>
      </label>
    </div>

    <div className="admin-create-actions">
      <button type="button" onClick={() => createNew('article')}><Plus size={16} />新增文章</button>
      <button type="button" onClick={() => createNew('project')}><Plus size={16} />新增作品</button>
    </div>

    <div className="admin-workbench">
      <form className="admin-editor" onSubmit={save}>
        <label>标题<input value={form.title} maxLength={120} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>摘要<input value={form.summary} maxLength={500} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
        <label>详情正文<textarea value={form.body} maxLength={5000} rows={12} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
        <div className="admin-save-row"><span aria-live="polite">{status}</span><button className="comment-submit" type="submit" disabled={saving}><Save size={16} />{saving ? '保存中…' : isNew ? '发布新内容' : '保存更改'}</button></div>
      </form>

      <aside className="admin-preview" aria-label="详情页实时预览">
        <div className="admin-preview-label"><Eye size={16} /> 实时预览</div>
        <article className="admin-preview-detail">
          <a className="back-link" href={'/' + (form.type === 'article' ? 'articles' : 'projects')}>← 返回{form.type === 'article' ? '文章' : '作品'}列表</a>
          <p className="eyebrow">{form.type === 'article' ? 'ARTICLE DETAIL' : 'PROJECT DETAIL'}</p>
          <h1>{form.title || '未命名内容'}</h1>
          <p className="detail-lead">{form.summary || '这里将显示摘要。'}</p>
          <div className="detail-body"><h2>{form.type === 'article' ? '正文内容' : '项目说明'}</h2><p>{form.body || '这里将显示详情正文。'}</p></div>
        </article>
      </aside>
    </div>
  </section>
}