import { useEffect, useState } from "react";
import { Eye, EyeOff, Heart, Trash2 } from "lucide-react";
import { apiBase } from "../lib/api";
import Pagination from "./Pagination";

/** 内容类型 */
type ContentType = "article" | "project";

/** 评论项数据结构 */
type Item = {
  id: string;                              // 评论ID
  nickname: string;                        // 评论者昵称
  body: string;                            // 评论内容
  likes: number;                           // 点赞数
  status: "visible" | "hidden" | "spam";   // 状态（显示/隐藏/垃圾）
  createdAt: string;                       // 创建时间
  content: { title: string; type: ContentType }; // 所属内容
};

/** 内容选项数据结构 */
type ContentOption = { id: string; title: string; type: ContentType };

/**
 * 格式化日期时间为中文显示格式
 * @param value - ISO日期字符串
 * @returns 格式化后的日期时间字符串
 */
const format = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function AdminComments() {
  const [items, setItems] = useState<Item[]>([]);
  const [contents, setContents] = useState<ContentOption[]>([]);
  const [status, setStatus] = useState("");
  const [contentType, setContentType] = useState<ContentType | "">("");
  const [contentId, setContentId] = useState("");
  const [sort, setSort] = useState<"latest" | "likes">("latest");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("personal-planet-admin-token")}`,
  });
  const selectableContents = contentType
    ? contents.filter((item) => item.type === contentType)
    : contents;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = items.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const load = () => {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (contentType) query.set("contentType", contentType);
    if (contentId) query.set("contentId", contentId);
    query.set("sort", sort);
    return fetch(`${apiBase}/admin/comments?${query}`, { headers: headers() })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: Item[]) => {
        setItems(data);
        setNotice("");
      })
      .catch(() => setNotice("无法读取评论，请重新登录。"));
  };

  useEffect(() => {
    fetch(`${apiBase}/admin/content`, { headers: headers() })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: ContentOption[]) => setContents(data))
      .catch(() => setNotice("无法读取文章和作品列表，请重新登录。"));
  }, []);
  useEffect(() => {
    load();
    setPage(1);
  }, [status, contentType, contentId, sort]);

  function chooseType(next: ContentType | "") {
    setContentType(next);
    setContentId("");
  }
  async function update(id: string, next: string) {
    const response = await fetch(`${apiBase}/admin/comments/${id}`, {
      method: "PATCH",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (response.ok) load();
    else setNotice("操作失败。");
  }
  async function remove(id: string) {
    if (!confirm("确定删除这条评论吗？")) return;
    const response = await fetch(`${apiBase}/admin/comments/${id}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (response.ok) load();
    else setNotice("删除失败。");
  }

  return (
    <section className="admin-module">
      <p className="eyebrow">COMMENTS</p>
      <h1>评论管理</h1>
      <div className="admin-toolbar admin-comment-filters">
        <label>
          内容类型
          <select
            value={contentType}
            onChange={(event) =>
              chooseType(event.target.value as ContentType | "")
            }
          >
            <option value="">全部内容</option>
            <option value="article">文章</option>
            <option value="project">作品</option>
          </select>
        </label>
        <label>
          指定文章/作品
          <select
            value={contentId}
            onChange={(event) => setContentId(event.target.value)}
          >
            <option value="">
              全部
              {contentType === "article"
                ? "文章"
                : contentType === "project"
                  ? "作品"
                  : "内容"}
            </option>
            {selectableContents.map((item) => (
              <option key={item.id} value={item.id}>
                {item.type === "article" ? "文章" : "作品"} · {item.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          评论状态
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">全部状态</option>
            <option value="visible">显示</option>
            <option value="hidden">隐藏</option>
            <option value="spam">垃圾</option>
          </select>
        </label>
        <label>
          排序方式
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as "latest" | "likes")
            }
          >
            <option value="latest">最新时间</option>
            <option value="likes">点赞最多</option>
          </select>
        </label>
      </div>
      {notice && <p className="admin-notice">{notice}</p>}
      <div className="admin-list">
        {pagedItems.map((item) => (
          <article key={item.id}>
            <div>
              <strong>{item.nickname}</strong>
              <span>
                {item.content.type === "article" ? "文章" : "作品"} ·{" "}
                {item.content.title} · {format(item.createdAt)}
              </span>
              <p>{item.body}</p>
              <small>
                <Heart size={13} /> 点赞 {item.likes} · {item.status}
              </small>
            </div>
            <div className="admin-row-actions">
              <button
                onClick={() =>
                  update(
                    item.id,
                    item.status === "visible" ? "hidden" : "visible",
                  )
                }
                title="切换显示"
              >
                {item.status === "visible" ? (
                  <EyeOff size={16} />
                ) : (
                  <Eye size={16} />
                )}
              </button>
              <button onClick={() => remove(item.id)} title="删除">
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <p className="admin-state">没有符合当前筛选条件的评论。</p>
      )}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        label="评论分页"
      />
    </section>
  );
}