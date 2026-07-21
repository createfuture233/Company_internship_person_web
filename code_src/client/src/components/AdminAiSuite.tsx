import { useEffect, useRef, useState } from "react";
import {
  Bot,
  FileUp,
  Loader2,
  MessageSquare,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { apiBase } from "../lib/api";

type ContentType = "article" | "project";
type ContentItem = {
  id: string;
  type: ContentType;
  title: string;
  summary: string;
  body: string;
  status: string;
};
type AiConfig = {
  configured: boolean;
  model: string;
  maxContextChars: number;
  visitorRateLimit: number;
  adminRateLimit: number;
};
type ChatMessage = { id: string; sender: "user" | "assistant"; body: string };
type UploadedFile = {
  id: string;
  originalName: string;
  fileSize: number;
  parsedText: string;
};
type Draft = {
  title: string;
  summary: string;
  body: string;
  stack?: string | null;
  coverUrl?: string | null;
  tags: string[];
};
type GenerationResult = { generation: { id: string }; draft: Draft };

function token() {
  return localStorage.getItem("personal-planet-admin-token") ?? "";
}

function authHeaders() {
  return { Authorization: `Bearer ${token()}` };
}

async function requestJson<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(apiBase + path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(String(data.message ?? "请求失败，请稍后重试。"));
  return data as T;
}

function readTextFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("文件读取失败。"));
    reader.readAsText(file, "utf-8");
  });
}

export default function AdminAiSuite() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [active, setActive] = useState<
    "chat" | "upload" | "generate" | "analyze"
  >("chat");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [chatInput, setChatInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [generateType, setGenerateType] = useState<ContentType>("article");
  const [generatePrompt, setGeneratePrompt] = useState(
    "根据我的资料生成一篇适合个人网站发布的内容。",
  );
  const [sourceContentId, setSourceContentId] = useState("");
  const [generation, setGeneration] = useState<GenerationResult | null>(null);
  const [analysisContentId, setAnalysisContentId] = useState("");
  const [analysisPrompt, setAnalysisPrompt] = useState(
    "请分析这篇内容还有哪些可以优化的地方。",
  );
  const [analysis, setAnalysis] = useState("");

  useEffect(() => {
    Promise.all([
      requestJson<AiConfig>("/admin/ai/config", { headers: authHeaders() }),
      requestJson<ContentItem[]>("/admin/content", { headers: authHeaders() }),
    ])
      .then(([aiConfig, contentItems]) => {
        setConfig(aiConfig);
        setContents(contentItems);
        setAnalysisContentId(contentItems[0]?.id ?? "");
        setSourceContentId("");
      })
      .catch((error) =>
        setNotice(error.message || "无法读取后台 AI 数据，请重新登录。"),
      );
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function submitChat(event: { preventDefault: () => void }) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || loading) return;
    setMessages((current) => [
      ...current,
      { id: `local-${Date.now()}`, sender: "user", body: message },
    ]);
    setChatInput("");
    setNotice("");
    setLoading(true);
    try {
      const data = await requestJson<{
        conversationId: string;
        message: { id: string; body: string };
      }>("/admin/ai/chat", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversationId: conversationId || undefined,
        }),
      });
      setConversationId(data.conversationId);
      setMessages((current) => [
        ...current,
        { id: data.message.id, sender: "assistant", body: data.message.body },
      ]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "AI 对话失败。");
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(file?: File) {
    if (!file) return;
    setNotice("");
    setLoading(true);
    try {
      const text = await readTextFile(file);
      const data = await requestJson<UploadedFile>("/admin/ai/files", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          originalName: file.name,
          mimeType: file.type || "text/plain",
          text,
        }),
      });
      setUploaded(data);
      setNotice(`已解析文件：${data.originalName}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "文件解析失败。");
    } finally {
      setLoading(false);
    }
  }

  async function generateDraft() {
    setNotice("");
    setLoading(true);
    try {
      const data = await requestJson<GenerationResult>("/admin/ai/generate", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          generationType: generateType,
          prompt: generatePrompt,
          fileId: uploaded?.id,
          sourceContentId: sourceContentId || undefined,
        }),
      });
      setGeneration(data);
      setNotice("AI 草稿已生成，可以检查后保存到内容库。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "生成失败。");
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft(status: "draft" | "published") {
    if (!generation) return;
    setLoading(true);
    try {
      const data = await requestJson<{
        content: { id: string; type: ContentType; slug: string; title: string };
      }>(`/admin/ai/generations/${generation.generation.id}/save`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setNotice(
        `已保存为${data.content.type === "article" ? "文章" : "作品"}：${data.content.title}`,
      );
      setContents((current) => [
        {
          id: data.content.id,
          type: data.content.type,
          title: data.content.title,
          summary: "",
          body: "",
          status,
        },
        ...current,
      ]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setLoading(false);
    }
  }

  async function analyze() {
    if (!analysisContentId) return;
    setNotice("");
    setAnalysis("");
    setLoading(true);
    try {
      const data = await requestJson<{ answer: string }>("/admin/ai/analyze", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: analysisContentId,
          prompt: analysisPrompt,
        }),
      });
      setAnalysis(data.answer);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "分析失败。");
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { key: "chat", label: "后台问答", icon: MessageSquare },
    { key: "upload", label: "文件解析", icon: FileUp },
    { key: "generate", label: "生成内容", icon: Wand2 },
    { key: "analyze", label: "内容分析", icon: Search },
  ] as const;

  return (
    <section className="admin-module admin-ai-module">
      <div className="admin-ai-head">
        <div>
          <p className="eyebrow">AI ASSISTANT</p>
          <h1>AI 助手</h1>
          <p className="admin-intro">
            调用
            DeepSeek，完成后台问答、文件解析、文章/作品生成、内容分析与保存。
          </p>
        </div>
        <div
          className={
            config?.configured ? "admin-ai-status ready" : "admin-ai-status"
          }
        >
          <ShieldCheck size={18} />
          <span>
            {config?.configured ? `已连接 ${config.model}` : "等待配置 API Key"}
          </span>
        </div>
      </div>

      <div className="admin-ai-tabs">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={active === key ? "active" : ""}
            type="button"
            onClick={() => setActive(key)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>

      {notice && <p className="admin-notice admin-ai-notice">{notice}</p>}

      {active === "chat" && (
        <div className="admin-ai-chat">
          <div className="admin-ai-messages">
            {!messages.length && (
              <div className="admin-ai-empty">
                <Bot size={34} />
                <strong>问我一个后台问题</strong>
                <span>
                  例如：帮我规划下一篇文章、分析作品页、整理评论运营建议。
                </span>
              </div>
            )}
            {messages.map((message) => (
              <article
                className={`admin-ai-message ${message.sender}`}
                key={message.id}
              >
                <span>{message.sender === "user" ? "管理员" : "AI 助手"}</span>
                <p>{message.body}</p>
              </article>
            ))}
            {loading && (
              <article className="admin-ai-message assistant">
                <span>AI 助手</span>
                <p>
                  <Loader2 className="admin-ai-spin" size={16} /> 正在思考...
                </p>
              </article>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="admin-ai-suggestions">
            {[
              "分析最近内容还缺什么",
              "帮我规划下一篇文章",
              "总结作品页面可以优化的地方",
            ].map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setChatInput(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <form className="admin-ai-form" onSubmit={submitChat}>
            <textarea
              value={chatInput}
              maxLength={4000}
              rows={3}
              placeholder="向 AI 助手提问..."
              onChange={(event) => setChatInput(event.target.value)}
            />
            <button type="submit" disabled={loading || !chatInput.trim()}>
              <Send size={17} />
              发送
            </button>
          </form>
        </div>
      )}

      {active === "upload" && (
        <div className="admin-ai-card">
          <h2>上传并解析文件</h2>
          <p>
            支持文本类文件，例如
            .txt、.md、.csv、.json。解析结果会保存到数据库，可用于后续生成文章或作品。
          </p>
          <input
            type="file"
            accept=".txt,.md,.csv,.json,.log,text/*,application/json"
            onChange={(event) => uploadFile(event.target.files?.[0])}
          />
          {uploaded && (
            <div className="admin-ai-preview">
              <strong>{uploaded.originalName}</strong>
              <span>{uploaded.fileSize} bytes</span>
              <p>{uploaded.parsedText.slice(0, 900)}</p>
            </div>
          )}
        </div>
      )}

      {active === "generate" && (
        <div className="admin-ai-card admin-ai-generate">
          <h2>生成文章或作品</h2>
          <div className="admin-ai-fields">
            <label>
              生成类型
              <select
                value={generateType}
                onChange={(event) =>
                  setGenerateType(event.target.value as ContentType)
                }
              >
                <option value="article">文章</option>
                <option value="project">作品</option>
              </select>
            </label>
            <label>
              参考现有内容
              <select
                value={sourceContentId}
                onChange={(event) => setSourceContentId(event.target.value)}
              >
                <option value="">不参考</option>
                {contents.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.type === "article" ? "文章" : "作品"} · {item.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            rows={5}
            value={generatePrompt}
            onChange={(event) => setGeneratePrompt(event.target.value)}
          />
          <button
            className="admin-ai-primary"
            type="button"
            disabled={loading || !generatePrompt.trim()}
            onClick={generateDraft}
          >
            <Sparkles size={17} />
            生成草稿
          </button>
          {generation && (
            <div className="admin-ai-draft">
              <h3>{generation.draft.title}</h3>
              <p>{generation.draft.summary}</p>
              {generation.draft.stack && <em>{generation.draft.stack}</em>}
              <div>
                {generation.draft.tags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
              <pre>{generation.draft.body}</pre>
              <div className="admin-ai-actions">
                <button type="button" onClick={() => saveDraft("draft")}>
                  <Save size={16} />
                  保存为草稿
                </button>
                <button type="button" onClick={() => saveDraft("published")}>
                  <Save size={16} />
                  保存并发布
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {active === "analyze" && (
        <div className="admin-ai-card">
          <h2>分析当前文章或作品</h2>
          <div className="admin-ai-fields">
            <label>
              选择内容
              <select
                value={analysisContentId}
                onChange={(event) => setAnalysisContentId(event.target.value)}
              >
                {contents.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.type === "article" ? "文章" : "作品"} · {item.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            rows={4}
            value={analysisPrompt}
            onChange={(event) => setAnalysisPrompt(event.target.value)}
          />
          <button
            className="admin-ai-primary"
            type="button"
            disabled={loading || !analysisContentId}
            onClick={analyze}
          >
            <Search size={17} />
            开始分析
          </button>
          {analysis && (
            <article className="admin-ai-analysis">
              <p>{analysis}</p>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
