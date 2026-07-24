import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
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
import { getCoverOptions, resolveCover } from "../lib/defaultCovers";
import MarkdownRenderer from "./MarkdownRenderer";
import Pagination from "./Pagination";

/** 内容类型：文章或项目 */
type ContentType = "article" | "project";
/** 内容状态：草稿、已发布、已归档 */
type ContentStatus = "draft" | "published" | "archived";
/** 标签类型定义 */
type ContentTag = { id: number; name: string };
/** 内容项完整数据结构 */
type ContentItem = {
  id: string;                     // 内容唯一标识
  type: ContentType;              // 内容类型
  slug: string;                   // URL友好的别名
  title: string;                  // 标题
  summary: string;                // 摘要
  body: string;                   // 正文内容（Markdown格式）
  coverUrl: string | null;        // 封面图片URL
  stack: string | null;           // 技术栈（仅项目）
  status: ContentStatus;          // 发布状态
  publishedAt?: string | null;    // 发布时间
  createdAt?: string;             // 创建时间
  updatedAt?: string;             // 更新时间
  tags: ContentTag[];             // 标签列表
};
/** 表单数据结构（将tags转为字符串便于输入） */
type ContentForm = Omit<ContentItem, "tags"> & { tagsText: string };
/** 页面模式：列表视图或编辑视图 */
type Mode = "list" | "edit";

/** 状态文字映射表 */
const statusText: Record<ContentStatus, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

/**
 * 创建空白内容表单数据
 * @param type - 内容类型
 * @returns 初始化的表单数据
 */
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

/**
 * 将内容项转换为表单格式
 * @param item - 原始内容项
 * @returns 表单数据格式
 */
function toForm(item: ContentItem): ContentForm {
  return {
    ...item,
    coverUrl: item.coverUrl ?? "",
    stack: item.stack ?? "",
    tagsText: item.tags.map((tag) => tag.name).join(", "),
  };
}

/**
 * 生成公开页面的URL
 * @param item - 内容项（包含type、id、slug）
 * @returns 公开页面路径
 */
function publicHref(item: Pick<ContentItem, "type" | "id" | "slug">) {
  return item.type === "article"
    ? `/articles/${item.id}`
    : `/projects/${item.slug}`;
}

/**
 * 格式化日期为显示用的日期和时间部分
 * @param value - ISO日期字符串
 * @returns 包含date和time的对象
 */
function formatDateParts(value?: string | null) {
  if (!value) return { date: "未记录", time: "--:--" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "未记录", time: "--:--" };
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return { date: `${month}.${day}`, time: `${hour}:${minute}` };
}

/**
 * 日期徽章组件
 * 显示格式化的日期时间，支持悬停显示完整时间
 */
function DateBadge({ value }: { value?: string | null }) {
  const parts = formatDateParts(value);
  const full = value
    ? new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "未记录";
  return (
    <time className="admin-date-badge" dateTime={value ?? undefined} title={full}>
      <span>{parts.date}</span>
      <strong>{parts.time}</strong>
    </time>
  );
}

/**
 * 计算文本字数（去除空白字符）
 * @param value - 输入文本
 * @returns 字符数
 */
function wordCount(value: string) {
  return value.trim().replace(/\s+/g, "").length;
}

/**
 * 内容管理面板组件
 * 用于管理文章和项目的增删改查操作
 * @param contentType - 内容类型（article或project）
 */
export default function AdminPanel({
  contentType,
}: {
  contentType: ContentType;
}) {
  // ========== 状态管理 ==========
  const [items, setItems] = useState<ContentItem[]>([]);      // 内容列表
  const [form, setForm] = useState<ContentForm | null>(null);  // 表单数据
  const [mode, setMode] = useState<Mode>("list");              // 当前模式
  const [isNew, setIsNew] = useState(false);                   // 是否新建
  const [message, setMessage] = useState("正在验证管理员权限…"); // 提示消息
  const [saving, setSaving] = useState(false);                 // 保存状态
  const [statusFilter, setStatusFilter] = useState<"all" | ContentStatus>(
    "all",
  );                                                           // 状态筛选
  const [page, setPage] = useState(1);                         // 当前页码
  const pageSize = 5;                                          // 每页条数
  const typeName = contentType === "article" ? "文章" : "作品"; // 类型名称

  // ========== 封面相关状态 ==========
  const coverOptions = useMemo(() => getCoverOptions(contentType), [contentType]); // 默认封面选项
  const [uploadedCovers, setUploadedCovers] = useState<string[]>([]);            // 用户上传的封面
  const coverScrollerRef = useRef<HTMLDivElement | null>(null);                  // 封面滚动容器引用
  const coverTrackRef = useRef<HTMLDivElement | null>(null);                     // 封面轨道引用
  const coverSetWidthRef = useRef(0);                                            // 单组封面宽度
  const coverOffsetRef = useRef(0);                                              // 当前滚动偏移
  const coverPausedRef = useRef(false);                                          // 是否暂停自动滚动
  const coverResumeAtRef = useRef(0);                                            // 恢复自动滚动的时间点
  const coverTransitionTimerRef = useRef<number | undefined>(undefined);          // 过渡动画计时器
  const [coverRepeatCount, setCoverRepeatCount] = useState(3);                   // 封面重复次数

  // 合并默认封面和上传封面（去重）
  const allCoverOptions = useMemo(
    () => Array.from(new Set([...coverOptions, ...uploadedCovers])),
    [coverOptions, uploadedCovers],
  );

  // 创建循环显示的封面列表（实现无缝滚动）
  const loopedCoverOptions = useMemo(
    () =>
      Array.from({ length: coverRepeatCount }, (_, loopIndex) =>
        allCoverOptions.map((cover) => ({ cover, loopIndex })),
      ).flat(),
    [allCoverOptions, coverRepeatCount],
  );

  // ========== API 工具方法 ==========

  /**
   * 获取认证请求头
   * @returns 包含Authorization的请求头对象
   */
  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("personal-planet-admin-token")}`,
  });

  /**
   * 加载内容列表
   * @returns 筛选后的内容列表
   */
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

  /**
   * 加载用户上传的封面列表
   */
  const loadUploadedCovers = async () => {
    const response = await fetch(
      `${apiBase}/admin/uploads/covers?type=${contentType}`,
      { headers: headers() },
    );
    if (!response.ok) return;
    const data = (await response.json()) as { urls?: string[] };
    setUploadedCovers(Array.isArray(data.urls) ? data.urls : []);
  };

  // ========== 生命周期钩子 ==========

  /**
   * 组件挂载时初始化数据
   * 1. 检查登录状态
   * 2. 加载上传的封面
   * 3. 加载内容列表
   * 4. 根据URL参数决定是否直接进入编辑模式
   */
  useEffect(() => {
    if (!localStorage.getItem("personal-planet-admin-token")) {
      setMessage("请返回首页并点击右侧星球插画登录。");
      return;
    }
    loadUploadedCovers().catch(() => undefined);
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

  // ========== 分页和筛选逻辑 ==========

  /** 根据状态筛选后的内容列表 */
  const visibleItems = useMemo(() => {
    return statusFilter === "all"
      ? items
      : items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  /** 总页数 */
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
  /** 当前页码（确保不超过总页数） */
  const currentPage = Math.min(page, totalPages);
  /** 当前页显示的内容项 */
  const pagedItems = visibleItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  /** 类型或筛选条件变化时重置页码 */
  useEffect(() => {
    setPage(1);
  }, [contentType, statusFilter]);

  // ========== 封面画廊自动滚动逻辑 ==========

  /**
   * 测量封面容器尺寸，动态计算需要重复的封面数量
   * 使用 ResizeObserver 监听容器大小变化
   */
  useEffect(() => {
    const scroller = coverScrollerRef.current;
    const track = coverTrackRef.current;
    if (!scroller || !track || !allCoverOptions.length) return;

    const measure = () => {
      // 每组之间同样有 gap，不能直接用总宽度除以副本数；否则循环重置点会逐渐漂移
      const firstCover = track.querySelector<HTMLButtonElement>("button");
      const cardWidth = firstCover?.getBoundingClientRect().width ?? 0;
      const gap = Number.parseFloat(getComputedStyle(track).gap) || 0;
      const singleSetWidth = allCoverOptions.length * (cardWidth + gap);
      coverSetWidthRef.current = singleSetWidth;
      const neededCopies = Math.max(
        3,
        Math.ceil((scroller.clientWidth * 2) / Math.max(1, singleSetWidth)) + 1,
      );
      if (neededCopies !== coverRepeatCount) setCoverRepeatCount(neededCopies);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(track);
    return () => observer.disconnect();
  }, [allCoverOptions.length, coverRepeatCount, mode]);

  /**
   * 封面自动滚动动画
   * 使用 requestAnimationFrame 实现平滑滚动效果
   */
  useEffect(() => {
    const track = coverTrackRef.current;
    if (!track || mode !== "edit" || allCoverOptions.length <= 1) return;

    let frame = 0;
    let lastTime = performance.now();
    const speed = 100; // 滚动速度（像素/秒）

    const tick = (time: number) => {
      const delta = Math.min(48, time - lastTime); // 限制最大时间增量，避免跳帧
      lastTime = time;
      const setWidth = coverSetWidthRef.current;
      // 检查是否应该滚动：未暂停、已过恢复时间、有有效宽度
      if (!coverPausedRef.current && time >= coverResumeAtRef.current && setWidth > 0) {
        coverOffsetRef.current += (speed * delta) / 1000;
        // 循环重置：当偏移超过单组宽度时，减去单组宽度实现无缝循环
        if (coverOffsetRef.current >= setWidth) {
          coverOffsetRef.current -= setWidth;
        }
        track.style.transform = `translate3d(${-coverOffsetRef.current}px, 0, 0)`;
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      if (coverTransitionTimerRef.current) {
        window.clearTimeout(coverTransitionTimerRef.current);
      }
    };
  }, [allCoverOptions.length, mode, coverRepeatCount]);

  // ========== 核心操作方法 ==========

  /**
   * 手动切换封面滑块
   * @param direction - 切换方向（-1向左，1向右）
   */
  function moveCoverSlide(direction: -1 | 1) {
    const track = coverTrackRef.current;
    if (!track) return;

    const card = track.querySelector<HTMLButtonElement>("button");
    const gap = Number.parseFloat(getComputedStyle(track).gap) || 0;
    const step = (card?.getBoundingClientRect().width ?? 320) + gap;
    const setWidth = coverSetWidthRef.current;

    // 手动切换时先暂停自动滚动，避免两个动画同时修改
    coverResumeAtRef.current = performance.now() + 1050;
    let nextOffset = coverOffsetRef.current + direction * step;
    // 确保偏移在有效范围内循环
    if (setWidth > 0) {
      while (nextOffset < 0) nextOffset += setWidth;
      while (nextOffset >= setWidth) nextOffset -= setWidth;
    }

    // 清除之前的过渡计时器
    if (coverTransitionTimerRef.current) {
      window.clearTimeout(coverTransitionTimerRef.current);
    }
    // 设置过渡动画
    track.style.transition = "transform 520ms cubic-bezier(.22, 1, .36, 1)";
    coverOffsetRef.current = nextOffset;
    track.style.transform = `translate3d(${-nextOffset}px, 0, 0)`;
    // 动画结束后清除过渡样式
    coverTransitionTimerRef.current = window.setTimeout(() => {
      track.style.transition = "";
    }, 560);
  }

  /**
   * 编辑内容项
   * @param item - 要编辑的内容项
   */
  function editItem(item: ContentItem) {
    setForm(toForm(item));
    setIsNew(false);
    setMode("edit");
    setMessage("");
  }

  /**
   * 创建新内容
   */
  function createNew() {
    setIsNew(true);
    setForm(blankContent(contentType));
    setMode("edit");
    setMessage(`正在创建新的${typeName}，填写后点击保存。`);
  }

  /**
   * 返回列表视图
   */
  function backToList() {
    setMode("list");
    setIsNew(false);
    setForm(null);
    setMessage("");
  }

  /**
   * 保存内容
   * @param event - 表单提交事件
   */
  async function save(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setMessage("");
    
    // 构建请求体
    const payload = {
      ...(isNew ? { type: form.type } : {}), // 新建时需要传入类型
      title: form.title,
      summary: form.summary,
      body: form.body,
      coverUrl: form.coverUrl,
      stack: form.stack,
      status: form.status,
      tags: form.tagsText
        .split(/[,，]/)           // 支持中英文逗号分隔
        .map((tag) => tag.trim()) // 去除首尾空格
        .filter(Boolean),         // 过滤空标签
    };

    try {
      // 根据是否新建选择不同的API端点和方法
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

      // 更新本地状态
      setItems((current) =>
        isNew
          ? [updated, ...current]                          // 新建：添加到列表开头
          : current.map((item) => (item.id === updated.id ? updated : item)), // 更新：替换原项
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

  /**
   * 上传封面图片
   * @param event - 文件选择事件
   */
  async function uploadCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file || !form) return;

    // 文件类型校验
    if (!file.type.startsWith("image/")) {
      setMessage("请选择图片文件作为封面。");
      return;
    }

    // 文件大小校验（最大20MB）
    if (file.size > 20 * 1024 * 1024) {
      setMessage("封面图片不能超过 20MB，请压缩后再上传。");
      return;
    }

    // 构建FormData
    const data = new FormData();
    data.append("file", file);
    setMessage("封面图片上传中...");

    try {
      const response = await fetch(
        `${apiBase}/admin/uploads/cover?type=${contentType}`,
        {
          method: "POST",
          headers: headers(),
          body: data,
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string | string[] } | null;
        const detail = Array.isArray(payload?.message)
          ? payload.message.join("；")
          : payload?.message;
        
        // 处理未授权情况
        if (response.status === 401) {
          localStorage.removeItem("personal-planet-admin-token");
          throw new Error("管理员登录已失效，请重新登录后上传。");
        }
        throw new Error(detail || `上传请求失败（HTTP ${response.status}）`);
      }

      const result = (await response.json()) as { url: string };
      // 更新上传封面列表
      setUploadedCovers((current) =>
        current.includes(result.url) ? current : [result.url, ...current],
      );
      // 设置当前封面
      setForm((current) => (current ? { ...current, coverUrl: result.url } : current));
      setMessage("封面图片已上传，保存内容后生效。");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "未知错误";
      setMessage(`封面上传失败：${detail}`);
    } finally {
      // 重置文件输入框
      event.currentTarget.value = "";
    }
  }

  /**
   * 删除内容项
   * @param item - 要删除的内容项
   */
  async function remove(item: ContentItem) {
    // 确认删除
    if (!confirm(`确定删除“${item.title}”吗？此操作不可恢复。`)) return;

    try {
      const response = await fetch(
        `${apiBase}/admin/content/${item.type}/${item.id}`,
        { method: "DELETE", headers: headers() },
      );

      if (!response.ok) throw new Error("delete failed");

      // 更新本地状态
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      // 如果删除的是当前编辑的项，返回列表
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
              {pagedItems.map((item) => (
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
                  <td className="admin-date-cell">
                    <DateBadge value={item.createdAt} />
                  </td>
                  <td className="admin-date-cell">
                    <DateBadge value={item.updatedAt} />
                  </td>
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
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          label={`${typeName}分页`}
        />
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
          <section className="admin-cover-picker">
            <div className="admin-cover-picker-head">
              <div>
                <span>封面图</span>
                <small>可从默认图库选择，也可以上传自己的图片。</small>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, coverUrl: "" })}
              >
                使用随机默认
              </button>
            </div>
            <img
              className="admin-cover-current"
              src={resolveCover(contentType, form.coverUrl)}
              alt="当前封面预览"
            />
            <div className="admin-cover-carousel" aria-label="封面图库">
              <button
                className="admin-cover-nav"
                type="button"
                onClick={() => moveCoverSlide(-1)}
                aria-label="上一组封面"
              >
                ‹
              </button>
              <div
                className="admin-cover-options"
                ref={coverScrollerRef}
                onMouseEnter={() => {
                  coverPausedRef.current = true;
                }}
                onMouseLeave={() => {
                  coverPausedRef.current = false;
                }}
              >
                <div className="admin-cover-track" ref={coverTrackRef}>
                  {loopedCoverOptions.map(({ cover, loopIndex }, index) => {
                    const isUploaded = cover.startsWith("/uploads/");
                    const defaultIndex = coverOptions.indexOf(cover);
                    return (
                      <button
                        key={`${cover}-${loopIndex}`}
                        className={form.coverUrl === cover ? "active" : ""}
                        type="button"
                        onClick={() => setForm({ ...form, coverUrl: cover })}
                        aria-hidden={loopIndex > 0}
                        tabIndex={loopIndex > 0 ? -1 : 0}
                      >
                        <img src={resolveCover(contentType, cover)} alt={`${isUploaded ? "上传封面" : "默认封面"} ${index + 1}`} />
                        <span>{isUploaded ? "UP" : String(defaultIndex + 1).padStart(2, "0")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                className="admin-cover-nav"
                type="button"
                onClick={() => moveCoverSlide(1)}
                aria-label="下一组封面"
              >
                ›
              </button>
            </div>
            <label className="admin-cover-url">
              封面图地址
              <input
                type="text"
                value={form.coverUrl ?? ""}
                placeholder="/assets/images/articles/article-cover-01.png"
                onChange={(event) =>
                  setForm({ ...form, coverUrl: event.target.value })
                }
              />
            </label>
            <label className="admin-cover-upload">
              <Image size={16} />
              上传自己的封面图
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={uploadCover}
              />
            </label>
          </section>
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
            <img
              className="admin-cover-preview"
              src={resolveCover(contentType, form.coverUrl)}
              alt="封面预览"
            />
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