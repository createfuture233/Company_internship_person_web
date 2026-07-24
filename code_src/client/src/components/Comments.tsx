import { apiBase } from "../lib/api";
import { createClientId } from "../lib/clientId";
import { useEffect, useState } from "react";
import { Heart, MessageCircle, Send } from "lucide-react";

/** 内容类型：文章或项目 */
type ContentType = "article" | "project";
/** 评论排序方式：最新或点赞最多 */
type CommentSort = "latest" | "likes";

/** 评论项数据结构 */
type CommentItem = {
  id: string;           // 评论ID
  name: string;         // 评论者昵称
  avatar: string;       // 头像标识
  content: string;      // 评论内容
  likes: number;        // 点赞数
  createdAt: string;    // 创建时间
};

/** 评论组件属性 */
type CommentsProps = {
  contentType: ContentType;  // 内容类型
  contentId: string;         // 内容ID
};

/**
 * 获取访客标识（用于点赞去重）
 * 如果本地不存在则创建新标识
 * @returns 访客唯一标识
 */
function visitorKey() {
  const key = "personal-planet-visitor-key";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = createClientId("visitor");
  localStorage.setItem(key, created);
  return created;
}

/**
 * 格式化日期时间为中文显示格式
 * @param value - ISO日期字符串
 * @returns 格式化后的日期时间字符串
 */
function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * 评论组件
 * 用于展示和管理文章/作品的评论功能
 * @param contentType - 内容类型（文章或项目）
 * @param contentId - 内容ID
 */
export default function Comments({ contentType, contentId }: CommentsProps) {
  // ========== 状态管理 ==========
  const [sort, setSort] = useState<CommentSort>("latest");     // 排序方式
  const [comments, setComments] = useState<CommentItem[]>([]); // 评论列表
  const [name, setName] = useState("");                        // 评论者昵称
  const [content, setContent] = useState("");                  // 评论内容
  const [loading, setLoading] = useState(true);                // 加载状态
  const [sending, setSending] = useState(false);               // 发送状态
  const [message, setMessage] = useState("");                  // 提示消息
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set()); // 已点赞的评论ID

  // ========== 生命周期钩子 ==========

  /**
   * 加载评论列表
   * 使用 AbortController 处理取消请求
   */
  useEffect(() => {
    const controller = new AbortController();

    async function loadComments() {
      setLoading(true);
      setMessage("");
      try {
        const params = new URLSearchParams({ contentType, contentId, sort });
        const response = await fetch(
          apiBase + "/comments?" + params.toString(),
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("load failed");
        const data = (await response.json()) as { items: CommentItem[] };
        setComments(data.items);
      } catch (error) {
        if (!controller.signal.aborted)
          setMessage("评论暂时无法加载，请确认后端服务已启动。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadComments();
    return () => controller.abort(); // 组件卸载时取消请求
  }, [contentId, contentType, sort]);

  // ========== 核心方法 ==========

  /**
   * 提交评论
   * @param event - 表单提交事件
   */
  async function submitComment(event: { preventDefault: () => void }) {
    event.preventDefault();
    
    // 验证输入
    if (!name.trim() || !content.trim()) {
      setMessage("请填写昵称和评论内容。");
      return;
    }

    setSending(true);
    setMessage("");

    try {
      const response = await fetch(apiBase + "/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, contentId, name, content }),
      });

      if (!response.ok) throw new Error("submit failed");
      
      const created = (await response.json()) as CommentItem;
      
      // 根据排序方式插入新评论
      setComments((current) =>
        sort === "latest"
          ? [created, ...current]
          : [...current, created].sort((a, b) => b.likes - a.likes),
      );
      
      // 重置表单
      setName("");
      setContent("");
      setMessage("评论已发布。");
    } catch {
      setMessage("发布失败，请确认后端服务正在运行。");
    } finally {
      setSending(false);
    }
  }

  /**
   * 点赞评论
   * @param id - 评论ID
   */
  async function likeComment(id: string) {
    // 防止重复点赞
    if (likedIds.has(id)) return;

    try {
      const response = await fetch(apiBase + "/comments/" + id + "/like", {
        method: "POST",
        headers: { "X-Visitor-Key": visitorKey() }, // 携带访客标识
      });

      if (!response.ok) throw new Error("like failed");
      
      const updated = (await response.json()) as CommentItem;
      
      // 更新评论列表中的点赞数
      setComments((current) =>
        current
          .map((item) =>
            item.id === id ? { ...item, likes: updated.likes } : item,
          )
          .sort((a, b) => (sort === "likes" ? b.likes - a.likes : 0)),
      );
      
      // 记录已点赞的评论
      setLikedIds((current) => new Set([...current, id]));
    } catch {
      setMessage("点赞失败，请稍后再试。");
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
          <button
            className={sort === "latest" ? "active" : ""}
            type="button"
            onClick={() => setSort("latest")}
          >
            最新
          </button>
          <button
            className={sort === "likes" ? "active" : ""}
            type="button"
            onClick={() => setSort("likes")}
          >
            点赞最多
          </button>
        </div>
      </div>

      <form className="comment-form" onSubmit={submitComment}>
        <label>
          <span>昵称</span>
          <input
            value={name}
            maxLength={30}
            onChange={(event) => setName(event.target.value)}
            placeholder="怎么称呼你？"
          />
        </label>
        <label>
          <span>评论内容</span>
          <textarea
            value={content}
            maxLength={600}
            onChange={(event) => setContent(event.target.value)}
            placeholder="写下此刻的想法…"
            rows={4}
          />
        </label>
        <div className="comment-form-actions">
          <span aria-live="polite">{message}</span>
          <button className="comment-submit" type="submit" disabled={sending}>
            <Send size={16} /> {sending ? "发布中…" : "发布评论"}
          </button>
        </div>
      </form>

      <div className="comment-list" aria-live="polite">
        {loading && <p className="comment-empty">正在接收评论信号…</p>}
        {!loading && !comments.length && !message && (
          <p className="comment-empty">还没有评论，成为第一位留下信号的人。</p>
        )}
        {!loading &&
          comments.map((comment) => (
            <article className="comment-item" key={comment.id}>
              <span className="comment-avatar" aria-hidden="true">
                {comment.avatar}
              </span>
              <div className="comment-copy">
                <div className="comment-meta">
                  <strong>{comment.name}</strong>
                  <time dateTime={comment.createdAt}>
                    {formatDate(comment.createdAt)}
                  </time>
                </div>
                <p>{comment.content}</p>
                <button
                  className={
                    "comment-like" + (likedIds.has(comment.id) ? " liked" : "")
                  }
                  type="button"
                  onClick={() => void likeComment(comment.id)}
                  aria-label={"给 " + comment.name + " 的评论点赞"}
                >
                  <Heart
                    size={16}
                    fill={likedIds.has(comment.id) ? "currentColor" : "none"}
                  />
                  <span>{comment.likes}</span>
                </button>
              </div>
            </article>
          ))}
      </div>
      <p className="comment-note">
        <MessageCircle size={15} /> 点赞在当前浏览器会话中每条评论只能操作一次。
      </p>
    </section>
  );
}