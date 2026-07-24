import { useEffect, useRef, useState } from 'react'
import { Bot, FileUp, Loader2, MessageSquare, Save, Search, Send, ShieldCheck, Sparkles, Wand2 } from 'lucide-react'
import { apiBase } from '../lib/api'
import { aiPrompts } from '../lib/aiPrompts'
import MarkdownRenderer from "./MarkdownRenderer";

/** 内容类型：文章或项目 */
type ContentType = 'article' | 'project'
/** 内容项基本信息 */
type ContentItem = { id: string; type: ContentType; title: string; summary?: string; body?: string; status?: string }
/** AI 配置信息 */
type AiConfig = { configured: boolean; model: string; maxContextChars: number; visitorRateLimit: number; adminRateLimit: number }
/** 聊天消息类型 */
type ChatMessage = { id: string; sender: 'user' | 'assistant'; body: string }
/** 上传文件信息 */
type UploadedFile = { id: string; originalName: string; fileSize: number; parsedText: string }
/** 生成的草稿数据 */
type Draft = { title: string; summary: string; body: string; stack?: string | null; coverUrl?: string | null; tags: string[] }
/** AI 生成结果 */
type GenerationResult = { generation: { id: string }; draft: Draft }
/** 忙碌状态键值 */
type BusyKey = '' | 'chat' | 'upload' | 'file-analysis' | 'generate' | 'analyze' | 'save-draft' | 'save-published'

/**
 * 获取管理员登录令牌
 * @returns JWT token 字符串
 */
function token() {
  return localStorage.getItem('personal-planet-admin-token') ?? ''
}

/**
 * 获取认证请求头
 * @returns 包含 Authorization 的请求头对象
 */
function authHeaders() {
  return { Authorization: `Bearer ${token()}` }
}

/**
 * 发送 JSON 请求并处理响应
 * @param path - API 路径
 * @param init - 请求配置
 * @returns 解析后的 JSON 数据
 */
async function requestJson<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(apiBase + path, init)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(data.message ?? '请求失败，请稍后重试。'))
  return data as T
}

/**
 * 读取文本文件内容
 * @param file - 文件对象
 * @returns 文件内容字符串
 */
function readTextFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('文件读取失败。'))
    reader.readAsText(file, 'utf-8')
  })
}

/**
 * 加载状态组件
 * @param label - 加载提示文字
 */
function LoadingLine({ label }: { label: string }) {
  return <div className="admin-ai-loading"><Loader2 className="admin-ai-spin" size={18} /><span>{label}</span><i /></div>
}

/**
 * AI 助手套件组件（V3版本）
 * 集成后台问答、文件解析、内容生成、内容分析四大功能模块
 */
export default function AdminAiSuiteV3() {
  // ========== 基础状态 ==========
  const [config, setConfig] = useState<AiConfig | null>(null)            // AI 配置信息
  const [contents, setContents] = useState<ContentItem[]>([])            // 内容列表
  const [active, setActive] = useState<'chat' | 'upload' | 'generate' | 'analyze'>('chat') // 当前激活的标签页
  const [notice, setNotice] = useState('')                               // 通知消息
  const [busy, setBusy] = useState<BusyKey>('')                          // 忙碌状态

  // ========== 聊天模块状态 ==========
  const [messages, setMessages] = useState<ChatMessage[]>([])            // 聊天消息列表
  const [conversationId, setConversationId] = useState('')               // 当前会话 ID
  const [chatInput, setChatInput] = useState('')                         // 聊天输入框内容
  const bottomRef = useRef<HTMLDivElement | null>(null)                  // 消息列表底部引用

  // ========== 文件解析模块状态 ==========
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null)    // 已上传的文件
  const [selectedFileName, setSelectedFileName] = useState('')           // 选中的文件名
  const [fileAnalysis, setFileAnalysis] = useState('')                   // 文件分析结果

  // ========== 内容生成模块状态 ==========
  const [generateType, setGenerateType] = useState<ContentType>('article') // 生成类型
  const [generatePrompt, setGeneratePrompt] = useState(aiPrompts.admin.defaultGenerate) // 生成提示词
  const [sourceContentId, setSourceContentId] = useState('')             // 参考内容 ID
  const [generation, setGeneration] = useState<GenerationResult | null>(null) // 生成结果
  const [savedGenerationId, setSavedGenerationId] = useState('')         // 已保存的生成结果 ID

  // ========== 内容分析模块状态 ==========
  const [analysisContentId, setAnalysisContentId] = useState('')         // 待分析内容 ID
  const [analysisPrompt, setAnalysisPrompt] = useState(aiPrompts.admin.defaultAnalyze) // 分析提示词
  const [analysis, setAnalysis] = useState('')                           // 分析结果

  // ========== 生命周期钩子 ==========

  /**
   * 组件挂载时初始化数据
   * 1. 获取 AI 配置
   * 2. 获取内容列表
   * 3. 默认选中第一个内容进行分析
   */
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

  /**
   * 消息更新时自动滚动到底部
   */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  // ========== 聊天模块方法 ==========

  /**
   * 提交聊天消息
   * @param event - 表单提交事件
   */
  async function submitChat(event: { preventDefault: () => void }) {
    event.preventDefault()
    const message = chatInput.trim()
    if (!message || busy) return

    // 立即显示用户消息
    setMessages((current) => [...current, { id: `local-${Date.now()}`, sender: 'user', body: message }])
    setChatInput('')
    setNotice('')
    setBusy('chat')

    try {
      // 发送请求到后端
      const data = await requestJson<{ conversationId: string; message: { id: string; body: string } }>('/admin/ai/chat', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationId: conversationId || undefined }),
      })
      // 更新会话 ID 和消息列表
      setConversationId(data.conversationId)
      setMessages((current) => [...current, { id: data.message.id, sender: 'assistant', body: data.message.body }])
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'AI 对话失败。')
    } finally {
      setBusy('')
    }
  }

  // ========== 文件解析模块方法 ==========

  /**
   * 分析已上传的文件
   * @param fileId - 文件 ID
   */
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

  /**
   * 上传并解析文件
   * @param file - 文件对象
   */
  async function uploadFile(file?: File) {
    if (!file || busy) return

    // 重置相关状态
    setNotice('')
    setUploaded(null)
    setFileAnalysis('')
    setGeneration(null)
    setSavedGenerationId('')
    setSelectedFileName(file.name)
    setBusy('upload')

    try {
      // 读取文件内容
      const text = await readTextFile(file)
      // 上传到后端
      const data = await requestJson<UploadedFile>('/admin/ai/files', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalName: file.name, mimeType: file.type || 'text/plain', text }),
      })
      setUploaded(data)
      setNotice(`已解析文件：${data.originalName}，正在生成 AI 分析...`)
      // 自动进行文件分析
      await analyzeFile(data.id)
    } catch (error) {
      setBusy('')
      setNotice(error instanceof Error ? error.message : '文件解析失败。')
    }
  }

  // ========== 内容生成模块方法 ==========

  /**
   * 生成内容草稿
   * @param type - 生成类型（文章或项目）
   * @param prompt - 生成提示词
   */
  async function generateDraft(type = generateType, prompt = generatePrompt) {
    if (busy || !prompt.trim()) return

    // 重置相关状态
    setNotice('')
    setGeneration(null)
    setSavedGenerationId('')
    setGenerateType(type)
    setBusy('generate')

    try {
      const data = await requestJson<GenerationResult>('/admin/ai/generate', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          generationType: type, 
          prompt, 
          fileId: uploaded?.id,           // 可选：参考已上传文件
          sourceContentId: sourceContentId || undefined, // 可选：参考现有内容
        }),
      })
      setGeneration(data)
      setNotice('AI 草稿已生成，可以检查后保存到内容库。')
      setActive('generate') // 自动切换到生成标签页
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '生成失败。')
    } finally {
      setBusy('')
    }
  }

  /**
   * 保存生成的草稿
   * @param status - 保存状态（草稿或发布）
   */
  async function saveDraft(status: 'draft' | 'published') {
    if (!generation || savedGenerationId || busy) return

    const label = status === 'published' ? '直接发布' : '保存为草稿'
    // 确认保存操作
    if (!window.confirm(`确定要${label}《${generation.draft.title}》吗？`)) return

    setBusy(status === 'published' ? 'save-published' : 'save-draft')

    try {
      const data = await requestJson<{ content: { id: string; type: ContentType; slug: string; title: string } }>(
        `/admin/ai/generations/${generation.generation.id}/save`, 
        {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      )
      // 标记为已保存，避免重复保存
      setSavedGenerationId(generation.generation.id)
      setNotice(`已${label}：${data.content.title}`)
      // 更新内容列表
      setContents((current) => [{ id: data.content.id, type: data.content.type, title: data.content.title, status }, ...current])
      window.alert(`保存成功：${data.content.title}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存失败。')
    } finally {
      setBusy('')
    }
  }

  // ========== 内容分析模块方法 ==========

  /**
   * 分析选中的内容
   */
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
        {messages.map((message) => <article className={`admin-ai-message ${message.sender}`} key={message.id}><span>{message.sender === 'user' ? '管理员' : 'AI 助手'}</span><MarkdownRenderer content={message.body} /></article>)}
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
      <label className={`admin-ai-file-picker ${Boolean(busy) ? 'disabled' : ''}`}>
        <span className="admin-ai-file-picker-btn"><FileUp size={17} />选择文件</span>
        <span className="admin-ai-file-picker-name">{selectedFileName || '未选择文件'}</span>
        <input type="file" accept=".txt,.md,.csv,.json,.log,text/*,application/json" disabled={Boolean(busy)} onChange={(event) => uploadFile(event.target.files?.[0])} />
      </label>
      {busy === 'upload' && <LoadingLine label="正在读取并上传文件..." />}
      {uploaded && <div className="admin-ai-preview"><strong>{uploaded.originalName}</strong><span>{uploaded.fileSize} bytes</span><p>{uploaded.parsedText.slice(0, 1200)}</p></div>}
      {busy === 'file-analysis' && <LoadingLine label="AI 正在分析这个文件，请稍等..." />}
      {fileAnalysis && <article className="admin-ai-analysis"><h3>AI 文件分析</h3> <MarkdownRenderer content={fileAnalysis} /></article>}
      {uploaded && <div className="admin-ai-oneclick">
        <button type="button" disabled={Boolean(busy)} onClick={() => generateDraft('article', aiPrompts.admin.buildOneClickPrompt('article', fileAnalysis))}><Sparkles size={17} />一键生成文章</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => generateDraft('project', aiPrompts.admin.buildOneClickPrompt('project', fileAnalysis))}><Sparkles size={17} />一键生成作品</button>
        {busy === 'generate' && <LoadingLine label="AI 正在生成内容，可能需要几十秒..." />}
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
        <MarkdownRenderer content={generation.draft.body} />
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
      {analysis && <article className="admin-ai-analysis"><MarkdownRenderer content={analysis} /></article>}
    </div>}
  </section>
}