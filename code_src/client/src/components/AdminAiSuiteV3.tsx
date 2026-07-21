import { useEffect, useRef, useState } from 'react'
import { Bot, FileUp, Loader2, MessageSquare, Save, Search, Send, ShieldCheck, Sparkles, Wand2 } from 'lucide-react'
import { apiBase } from '../lib/api'
import { aiPrompts } from '../lib/aiPrompts'

type ContentType = 'article' | 'project'
type ContentItem = { id: string; type: ContentType; title: string; summary?: string; body?: string; status?: string }
type AiConfig = { configured: boolean; model: string; maxContextChars: number; visitorRateLimit: number; adminRateLimit: number }
type ChatMessage = { id: string; sender: 'user' | 'assistant'; body: string }
type UploadedFile = { id: string; originalName: string; fileSize: number; parsedText: string }
type Draft = { title: string; summary: string; body: string; stack?: string | null; coverUrl?: string | null; tags: string[] }
type GenerationResult = { generation: { id: string }; draft: Draft }
type BusyKey = '' | 'chat' | 'upload' | 'file-analysis' | 'generate' | 'analyze' | 'save-draft' | 'save-published'

function token() {
  return localStorage.getItem('personal-planet-admin-token') ?? ''
}

function authHeaders() {
  return { Authorization: `Bearer ${token()}` }
}

async function requestJson<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(apiBase + path, init)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(data.message ?? '请求失败，请稍后重试。'))
  return data as T
}

function readTextFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('文件读取失败。'))
    reader.readAsText(file, 'utf-8')
  })
}

function LoadingLine({ label }: { label: string }) {
  return <div className="admin-ai-loading"><Loader2 className="admin-ai-spin" size={18} /><span>{label}</span><i /></div>
}

export default function AdminAiSuiteV3() {
  const [config, setConfig] = useState<AiConfig | null>(null)
  const [contents, setContents] = useState<ContentItem[]>([])
  const [active, setActive] = useState<'chat' | 'upload' | 'generate' | 'analyze'>('chat')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<BusyKey>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState('')
  const [chatInput, setChatInput] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null)
  const [fileAnalysis, setFileAnalysis] = useState('')
  const [generateType, setGenerateType] = useState<ContentType>('article')
  const [generatePrompt, setGeneratePrompt] = useState(aiPrompts.admin.defaultGenerate)
  const [sourceContentId, setSourceContentId] = useState('')
  const [generation, setGeneration] = useState<GenerationResult | null>(null)
  const [savedGenerationId, setSavedGenerationId] = useState('')
  const [analysisContentId, setAnalysisContentId] = useState('')
  const [analysisPrompt, setAnalysisPrompt] = useState(aiPrompts.admin.defaultAnalyze)
  const [analysis, setAnalysis] = useState('')

  useEffect(() => {
    Promise.all([
      requestJson<AiConfig>('/admin/ai/config', { headers: authHeaders() }),
      requestJson<ContentItem[]>('/admin/content', { headers: authHeaders() }),
    ]).then(([aiConfig, contentItems]) => {
      setConfig(aiConfig)
      setContents(contentItems)
      setAnalysisContentId(contentItems[0]?.id ?? '')
    }).catch((error) => setNotice(error.message || '无法读取后台 AI 数据，请重新登录。'))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  async function submitChat(event: { preventDefault: () => void }) {
    event.preventDefault()
    const message = chatInput.trim()
    if (!message || busy) return
    setMessages((current) => [...current, { id: `local-${Date.now()}`, sender: 'user', body: message }])
    setChatInput('')
    setNotice('')
    setBusy('chat')
    try {
      const data = await requestJson<{ conversationId: string; message: { id: string; body: string } }>('/admin/ai/chat', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationId: conversationId || undefined }),
      })
      setConversationId(data.conversationId)
      setMessages((current) => [...current, { id: data.message.id, sender: 'assistant', body: data.message.body }])
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'AI 对话失败。')
    } finally {
      setBusy('')
    }
  }

  async function analyzeFile(fileId: string) {
    setBusy('file-analysis')
    setFileAnalysis('')
    try {
      const data = await requestJson<{ answer: string }>(`/admin/ai/files/${fileId}/analyze`, {
        method: 'POST',
        headers: authHeaders(),
      })
      setFileAnalysis(data.answer)
      setNotice('文件解析与 AI 分析已完成。')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'AI 文件分析失败。')
    } finally {
      setBusy('')
    }
  }

  async function uploadFile(file?: File) {
    if (!file || busy) return
    setNotice('')
    setUploaded(null)
    setFileAnalysis('')
    setGeneration(null)
    setSavedGenerationId('')
    setBusy('upload')
    try {
      const text = await readTextFile(file)
      const data = await requestJson<UploadedFile>('/admin/ai/files', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalName: file.name, mimeType: file.type || 'text/plain', text }),
      })
      setUploaded(data)
      setNotice(`已解析文件：${data.originalName}，正在生成 AI 分析...`)
      await analyzeFile(data.id)
    } catch (error) {
      setBusy('')
      setNotice(error instanceof Error ? error.message : '文件解析失败。')
    }
  }

  async function generateDraft(type = generateType, prompt = generatePrompt) {
    if (busy || !prompt.trim()) return
    setNotice('')
    setGeneration(null)
    setSavedGenerationId('')
    setGenerateType(type)
    setBusy('generate')
    try {
      const data = await requestJson<GenerationResult>('/admin/ai/generate', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationType: type, prompt, fileId: uploaded?.id, sourceContentId: sourceContentId || undefined }),
      })
      setGeneration(data)
      setNotice('AI 草稿已生成，可以检查后保存到内容库。')
      setActive('generate')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '生成失败。')
    } finally {
      setBusy('')
    }
  }

  async function saveDraft(status: 'draft' | 'published') {
    if (!generation || savedGenerationId || busy) return
    const label = status === 'published' ? '直接发布' : '保存为草稿'
    if (!window.confirm(`确定要${label}《${generation.draft.title}》吗？`)) return
    setBusy(status === 'published' ? 'save-published' : 'save-draft')
    try {
      const data = await requestJson<{ content: { id: string; type: ContentType; slug: string; title: string } }>(`/admin/ai/generations/${generation.generation.id}/save`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setSavedGenerationId(generation.generation.id)
      setNotice(`已${label}：${data.content.title}`)
      setContents((current) => [{ id: data.content.id, type: data.content.type, title: data.content.title, status }, ...current])
      window.alert(`保存成功：${data.content.title}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存失败。')
    } finally {
      setBusy('')
    }
  }

  async function analyze() {
    if (!analysisContentId || busy) return
    setNotice('')
    setAnalysis('')
    setBusy('analyze')
    try {
      const data = await requestJson<{ answer: string }>('/admin/ai/analyze', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId: analysisContentId, prompt: analysisPrompt }),
      })
      setAnalysis(data.answer)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '分析失败。')
    } finally {
      setBusy('')
    }
  }

  const tabs = [
    { key: 'chat', label: '后台问答', icon: MessageSquare },
    { key: 'upload', label: '文件解析', icon: FileUp },
    { key: 'generate', label: '生成内容', icon: Wand2 },
    { key: 'analyze', label: '内容分析', icon: Search },
  ] as const
  const savingDisabled = Boolean(!generation || savedGenerationId || busy)

  return <section className="admin-module admin-ai-module admin-ai-safe-zone">
    <div className="admin-ai-head">
      <div>
        <p className="eyebrow">AI ASSISTANT</p>
        <h1>AI 助手</h1>
        <p className="admin-intro">调用 DeepSeek，完成后台问答、文件解析、文章/作品生成、内容分析与保存。</p>
      </div>
      <div className={config?.configured ? 'admin-ai-status ready' : 'admin-ai-status'}>
        <ShieldCheck size={18} />
        <span>{config?.configured ? `已连接 ${config.model}` : '等待配置 API Key'}</span>
      </div>
    </div>

    <div className="admin-ai-tabs">
      {tabs.map(({ key, label, icon: Icon }) => <button key={key} className={active === key ? 'active' : ''} type="button" onClick={() => setActive(key)} disabled={Boolean(busy)}><Icon size={17} />{label}</button>)}
    </div>

    {notice && <p className="admin-notice admin-ai-notice">{notice}</p>}

    {active === 'chat' && <div className="admin-ai-chat">
      <div className="admin-ai-messages">
        {!messages.length && <div className="admin-ai-empty"><Bot size={34} /><strong>{aiPrompts.admin.chatEmptyTitle}</strong><span>{aiPrompts.admin.chatEmptyDescription}</span></div>}
        {messages.map((message) => <article className={`admin-ai-message ${message.sender}`} key={message.id}><span>{message.sender === 'user' ? '管理员' : 'AI 助手'}</span><p>{message.body}</p></article>)}
        {busy === 'chat' && <article className="admin-ai-message assistant"><span>AI 助手</span><p><Loader2 className="admin-ai-spin" size={16} /> 正在思考...</p></article>}
        <div ref={bottomRef} />
      </div>
      <div className="admin-ai-suggestions">{aiPrompts.admin.chatSuggestions.map((item) => <button type="button" key={item} onClick={() => setChatInput(item)} disabled={Boolean(busy)}>{item}</button>)}</div>
      <form className="admin-ai-form" onSubmit={submitChat}>
        <textarea value={chatInput} maxLength={4000} rows={3} placeholder={aiPrompts.admin.chatPlaceholder} onChange={(event) => setChatInput(event.target.value)} />
        <button type="submit" disabled={Boolean(busy) || !chatInput.trim()}><Send size={17} />发送</button>
      </form>
    </div>}

    {active === 'upload' && <div className="admin-ai-card">
      <h2>上传并解析文件</h2>
      <p>支持 .txt、.md、.csv、.json 等文本类文件。上传后会显示解析内容，并自动追加 AI 对文件的分析。</p>
      <input type="file" accept=".txt,.md,.csv,.json,.log,text/*,application/json" disabled={Boolean(busy)} onChange={(event) => uploadFile(event.target.files?.[0])} />
      {busy === 'upload' && <LoadingLine label="正在读取并上传文件..." />}
      {uploaded && <div className="admin-ai-preview"><strong>{uploaded.originalName}</strong><span>{uploaded.fileSize} bytes</span><p>{uploaded.parsedText.slice(0, 1200)}</p></div>}
      {busy === 'file-analysis' && <LoadingLine label="AI 正在分析这个文件，请稍等..." />}
      {fileAnalysis && <article className="admin-ai-analysis"><h3>AI 文件分析</h3><p>{fileAnalysis}</p></article>}
      {uploaded && <div className="admin-ai-oneclick">
        <button type="button" disabled={Boolean(busy)} onClick={() => generateDraft('article', aiPrompts.admin.buildOneClickPrompt('article', fileAnalysis))}><Sparkles size={17} />一键生成文章</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => generateDraft('project', aiPrompts.admin.buildOneClickPrompt('project', fileAnalysis))}><Sparkles size={17} />一键生成作品</button>
      </div>}
    </div>}

    {active === 'generate' && <div className="admin-ai-card admin-ai-generate">
      <h2>生成文章或作品</h2>
      <div className="admin-ai-fields">
        <label>生成类型<select value={generateType} disabled={Boolean(busy)} onChange={(event) => setGenerateType(event.target.value as ContentType)}><option value="article">文章</option><option value="project">作品</option></select></label>
        <label>参考现有内容<select value={sourceContentId} disabled={Boolean(busy)} onChange={(event) => setSourceContentId(event.target.value)}><option value="">不参考</option>{contents.map((item) => <option value={item.id} key={item.id}>{item.type === 'article' ? '文章' : '作品'} · {item.title}</option>)}</select></label>
      </div>
      <textarea rows={5} value={generatePrompt} onChange={(event) => setGeneratePrompt(event.target.value)} />
      <button className="admin-ai-primary" type="button" disabled={Boolean(busy) || !generatePrompt.trim()} onClick={() => generateDraft()}>{busy === 'generate' ? <Loader2 className="admin-ai-spin" size={17} /> : <Sparkles size={17} />}{busy === 'generate' ? '生成中...' : '生成草稿'}</button>
      {busy === 'generate' && <LoadingLine label="AI 正在生成内容，可能需要几十秒..." />}
      {generation && <div className="admin-ai-draft">
        <h3>{generation.draft.title}</h3>
        <p>{generation.draft.summary}</p>
        {generation.draft.stack && <em>{generation.draft.stack}</em>}
        <div>{generation.draft.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        <pre>{generation.draft.body}</pre>
        <div className="admin-ai-actions">
          <button type="button" disabled={savingDisabled} onClick={() => saveDraft('draft')}>{busy === 'save-draft' ? <Loader2 className="admin-ai-spin" size={16} /> : <Save size={16} />}保存为草稿</button>
          <button type="button" disabled={savingDisabled} onClick={() => saveDraft('published')}>{busy === 'save-published' ? <Loader2 className="admin-ai-spin" size={16} /> : <Save size={16} />}保存并发布</button>
        </div>
        {savedGenerationId && <p className="admin-ai-saved-tip">该生成结果已经保存，保存按钮已锁定，避免重复写入。</p>}
      </div>}
    </div>}

    {active === 'analyze' && <div className="admin-ai-card">
      <h2>分析当前文章或作品</h2>
      <div className="admin-ai-fields"><label>选择内容<select value={analysisContentId} disabled={Boolean(busy)} onChange={(event) => setAnalysisContentId(event.target.value)}>{contents.map((item) => <option value={item.id} key={item.id}>{item.type === 'article' ? '文章' : '作品'} · {item.title}</option>)}</select></label></div>
      <textarea rows={4} value={analysisPrompt} onChange={(event) => setAnalysisPrompt(event.target.value)} />
      <button className="admin-ai-primary" type="button" disabled={Boolean(busy) || !analysisContentId} onClick={analyze}>{busy === 'analyze' ? <Loader2 className="admin-ai-spin" size={17} /> : <Search size={17} />}{busy === 'analyze' ? '分析中...' : '开始分析'}</button>
      {busy === 'analyze' && <LoadingLine label="AI 正在分析内容..." />}
      {analysis && <article className="admin-ai-analysis"><p>{analysis}</p></article>}
    </div>}
  </section>
}
