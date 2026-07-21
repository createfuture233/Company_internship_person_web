import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Edit3,
  ExternalLink,
  Eye,
  Image,
  Plus,
  Save,
  ShieldAlert,
  Tag,
  Trash2,
} from "lucide-react";
import { apiBase } from "../lib/api";
import MarkdownRenderer from "./MarkdownRenderer";

type ContentType = "article" | "project";
type ContentStatus = "draft" | "published" | "archived";
type ContentTag = { id: number; name: string };
type ContentItem = {
  id: string;
  type: ContentType;
  slug: string;
  title: string;
  summary: string;
  body: string;
  coverUrl: string | null;
  stack: string | null;
  status: ContentStatus;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  tags: ContentTag[];
};
type ContentForm = Omit<ContentItem, "tags"> & { tagsText: string };
type Mode = "list" | "edit";

const statusText: Record<ContentStatus, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

const blankContent = (type: ContentType): ContentForm => ({
  id: "",
  slug: "",
  type,
  title: type === "article" ? "未命名文章" : "未命名作品",
  summary: "在这里填写内容摘要。",
  body: "在这里填写详情正文。",
  coverUrl: "",
  stack: type === "project" ? "Astro · React · NestJS" : "",
  status: "published",
  publishedAt: null,
  createdAt: "",
  updatedAt: "",
  tagsText: "",
});

function toForm(item: ContentItem): ContentForm {
  return {
    ...item,
    coverUrl: item.coverUrl ?? "",
    stack: item.stack ?? "",
    tagsText: item.tags.map((tag) => tag.name).join(", "),
  };
}

function publicHref(item: Pick<ContentItem, "type" | "id" | "slug">) {
  return item.type === "article"
    ? `/articles/${item.id}`
    : `/projects/${item.slug}`;
}

function formatDate(value?: string | null) {
  if (!value) return "未记录";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function wordCount(value: string) {
  return value.trim().replace(/\s+/g, "").length;
}

export default function AdminPanel({
  contentType,
}: {
  contentType: ContentType;
}) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [form, setForm] = useState<ContentForm | null>(null);
  const [mode, setMode] = useState<Mode>("list");
  const [isNew, setIsNew] = useState(false);
  const [message, setMessage] = useState("正在验证管理员权限…");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | ContentStatus>(
    "all",
  );
  const typeName = contentType === "article" ? "文章" : "作品";

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("personal-planet-admin-token")}`,
  });
  const load = async () => {
    const response = await fetch(`${apiBase}/admin/content`, {
      headers: headers(),
    });
    if (!response.ok) throw new Error("unauthorized");
    const data = (await response.json()) as ContentItem[];
    const scoped = data.filter((item) => item.type === contentType);
    setItems(scoped);
    return scoped;
  };

  useEffect(() => {
    if (!localStorage.getItem("personal-planet-admin-token")) {
      setMessage("请返回首页并点击右侧星球插画登录。");
      return;
    }
    load()
      .then((scoped) => {
        const requestedId = new URLSearchParams(window.location.search).get(
          "id",
        );
        const preferred = scoped.find((item) => item.id === requestedId);
        if (preferred) editItem(preferred);
        else {
          setMode("list");
          setMessage("");
        }
      })
      .catch(() => {
        localStorage.removeItem("personal-planet-admin-token");
        setMessage("登录状态已失效，请返回首页重新登录。");
      });
  }, [contentType]);

  const visibleItems = useMemo(() => {
    return statusFilter === "all"
      ? items
      : items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  function editItem(item: ContentItem) {
    setForm(toForm(item));
    setIsNew(false);
    setMode("edit");
    setMessage("");
  }

  function createNew() {
    setIsNew(true);
    setForm(blankContent(contentType));
    setMode("edit");
    setMessage(`正在创建新的${typeName}，填写后点击保存。`);
  }

  function backToList() {
    setMode("list");
    setIsNew(false);
    setForm(null);
    setMessage("");
  }

  async function save(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setMessage("");
    const payload = {
      ...(isNew ? { type: form.type } : {}),
      title: form.title,
      summary: form.summary,
      body: form.body,
      coverUrl: form.coverUrl,
      stack: form.stack,
      status: form.status,
      tags: form.tagsText
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    try {
      const endpoint = isNew
        ? "/admin/content"
        : `/admin/content/${form.type}/${form.id}`;
      const response = await fetch(apiBase + endpoint, {
        method: isNew ? "POST" : "PATCH",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("save failed");
      const updated = (await response.json()) as ContentItem;
      setItems((current) =>
        isNew
          ? [updated, ...current]
          : current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setForm(toForm(updated));
      setIsNew(false);
      setMessage(
        updated.status === "published"
          ? "已保存并公开发布，可打开真实页面查看。"
          : "已保存。当前状态不会出现在公开页面。",
      );
    } catch {
      setMessage("保存失败，请确认后端服务正在运行且管理员状态有效。");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: ContentItem) {
    if (!confirm(`确定删除“${item.title}”吗？此操作不可恢复。`)) return;
    try {
      const response = await fetch(
        `${apiBase}/admin/content/${item.type}/${item.id}`,
        { method: "DELETE", headers: headers() },
      );
      if (!response.ok) throw new Error("delete failed");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (form?.id === item.id) backToList();
      setMessage("内容已删除。");
    } catch {
      setMessage("删除失败，请稍后重试。");
    }
  }

  if (message && !items.length && mode === "list")
    return (
      <section className="admin-panel">
        <ShieldAlert size={28} />
        <p>{message}</p>
      </section>
    );

  if (mode === "list")
    return (
      <section className="admin-panel admin-content-manager">
        <div className="admin-panel-head">
          <div>
            <p className="eyebrow">
              {contentType === "article"
                ? "ARTICLE MANAGER"
                : "PROJECT MANAGER"}
            </p>
            <h1>{typeName}管理</h1>
            <p>用表格管理{typeName}的发布状态、标签、更新时间与快捷操作。</p>
          </div>
          <div className="admin-table-actions">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | ContentStatus)
              }
              aria-label="筛选状态"
            >
              <option value="all">全部状态</option>
              <option value="published">已发布</option>
              <option value="draft">草稿</option>
              <option value="archived">已归档</option>
            </select>
            <button type="button" onClick={createNew}>
              <Plus size={16} />
              新增{typeName}
            </button>
          </div>
        </div>
        {message && <p className="admin-notice">{message}</p>}
        <div className="admin-table-wrap">
          <table className="admin-content-table">
            <thead>
              <tr>
                <th>{typeName}信息</th>
                <th>状态</th>
                <th>标签 / 技术栈</th>
                <th>创建时间</th>
                <th>上次修改</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id}>
                  <td className="admin-table-main">
                    <strong>{item.title}</strong>
                    <span>{item.summary}</span>
                    <small>
                      ID: {item.id} · Slug: {item.slug} · {wordCount(item.body)}{" "}
                      字
                    </small>
                  </td>
                  <td>
                    <span
                      className={`admin-status admin-status-${item.status}`}
                    >
                      {statusText[item.status]}
                    </span>
                  </td>
                  <td className="admin-table-tags">
                    {contentType === "project" && item.stack && (
                      <em>{item.stack}</em>
                    )}
                    <div>
                      {item.tags.length ? (
                        item.tags.map((tag) => (
                          <span key={tag.id}>#{tag.name}</span>
                        ))
                      ) : (
                        <small>暂无标签</small>
                      )}
                    </div>
                  </td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>{formatDate(item.updatedAt)}</td>
                  <td>
                    <div className="admin-table-row-actions">
                      {item.status === "published" && (
                        <a
                          href={publicHref(item)}
                          target="_blank"
                          rel="noreferrer"
                          title="查看真实页面"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => editItem(item)}
                        title="编辑"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        className="admin-danger"
                        type="button"
                        onClick={() => remove(item)}
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleItems.length && (
            <p className="admin-state">暂无符合当前筛选条件的{typeName}。</p>
          )}
        </div>
      </section>
    );

  if (!form)
    return (
      <section className="admin-panel">
        <ShieldAlert size={28} />
        <p>{message}</p>
      </section>
    );

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <p className="eyebrow">{isNew ? "CREATE CONTENT" : "EDIT CONTENT"}</p>
          <h1>{isNew ? `新增${typeName}` : `编辑${typeName}`}</h1>
          <p>左侧修改字段，右侧实时预览详情页效果。</p>
        </div>
        <div className="admin-table-actions">
          <button type="button" onClick={backToList}>
            <ArrowLeft size={16} />
            返回列表
          </button>
          {!isNew && form.status === "published" && (
            <a
              className="admin-open-page"
              href={publicHref(form)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} />
              打开真实页面
            </a>
          )}
        </div>
      </div>

      <div className="admin-workbench">
        <form className="admin-editor" onSubmit={save}>
          <label>
            标题
            <input
              value={form.title}
              maxLength={120}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </label>
          <label>
            摘要
            <input
              value={form.summary}
              maxLength={500}
              onChange={(event) =>
                setForm({ ...form, summary: event.target.value })
              }
            />
          </label>
          <label>
            封面图地址（可空）
            <input
              type="url"
              value={form.coverUrl ?? ""}
              placeholder="https://example.com/cover.jpg"
              onChange={(event) =>
                setForm({ ...form, coverUrl: event.target.value })
              }
            />
          </label>
          {contentType === "project" && (
            <label>
              技术栈（可空）
              <input
                value={form.stack ?? ""}
                placeholder="Astro · React · NestJS"
                maxLength={500}
                onChange={(event) =>
                  setForm({ ...form, stack: event.target.value })
                }
              />
            </label>
          )}
          <label>
            <Tag size={15} />
            标签（用逗号分隔）
            <input
              value={form.tagsText}
              placeholder="设计, 前端, 随笔"
              onChange={(event) =>
                setForm({ ...form, tagsText: event.target.value })
              }
            />
          </label>
          <label>
            发布状态
            <select
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as ContentStatus,
                })
              }
            >
              <option value="draft">draft · 草稿</option>
              <option value="published">published · 已发布</option>
              <option value="archived">archived · 已归档</option>
            </select>
          </label>
          <label>
            详情正文
            <textarea
              value={form.body}
              maxLength={5000}
              rows={12}
              onChange={(event) =>
                setForm({ ...form, body: event.target.value })
              }
            />
          </label>
          <div className="admin-save-row">
            <span aria-live="polite">{message}</span>
            <button className="comment-submit" type="submit" disabled={saving}>
              <Save size={16} />
              {saving ? "保存中…" : isNew ? `发布${typeName}` : "保存更改"}
            </button>
          </div>
        </form>

        <aside className="admin-preview" aria-label="详情页实时预览">
          <div className="admin-preview-label">
            <Eye size={16} /> 详情页实时预览
          </div>
          <article className="admin-preview-detail">
            {form.coverUrl && (
              <img
                className="admin-cover-preview"
                src={form.coverUrl}
                alt="封面预览"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            )}
            {!form.coverUrl && (
              <div className="admin-cover-placeholder">
                <Image size={25} />
                未设置封面图
              </div>
            )}
            <p className="eyebrow">
              {contentType === "article" ? "ARTICLE DETAIL" : "PROJECT DETAIL"}{" "}
              · {form.status}
            </p>
            <h1>{form.title || `未命名${typeName}`}</h1>
            <p className="detail-lead">{form.summary || "这里将显示摘要。"}</p>
            {contentType === "project" && form.stack && (
              <p className="admin-preview-stack">{form.stack}</p>
            )}
            {form.tagsText && (
              <div className="admin-preview-tags">
                {form.tagsText
                  .split(/[,，]/)
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
              </div>
            )}
            <div className="detail-body">
              <h2>{contentType === "article" ? "正文内容" : "项目说明"}</h2>
              <MarkdownRenderer content={form.body || "这里将显示详情正文。"} />
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}
