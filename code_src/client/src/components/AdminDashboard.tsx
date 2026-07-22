import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileText, FolderKanban, Heart, Mail, MessageCircle, PieChart, Sparkles, TrendingUp } from "lucide-react";
import { apiBase } from "../lib/api";

type TrendPoint = { date: string; contents: number; comments: number; messages: number };
type Overview = {
  articles: number;
  projects: number;
  comments: number;
  unreadMessages: number;
  totals: { contents: number; comments: number; messages: number; interactions: number; likes: number };
  contentStatus: { draft: number; published: number; archived: number };
  contentTypes: { article: number; project: number };
  commentStatus: { visible: number; hidden: number; spam: number };
  commentByContent: { article: number; project: number };
  messageStatus: { unread: number; read: number; replied: number; archived: number };
  trend: TrendPoint[];
  insights: { responseRate: number; averageLikes: number; publishedRate: number };
};
type Segment = { label: string; value: number; color: string };

function emptyTrend(): TrendPoint[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return { date: date.toISOString().slice(0, 10), contents: 0, comments: 0, messages: 0 };
  });
}

function normalizeOverview(raw: Partial<Overview> & Record<string, unknown>): Overview {
  const articles = Number(raw.articles ?? 0);
  const projects = Number(raw.projects ?? 0);
  const comments = Number(raw.comments ?? 0);
  const unreadMessages = Number(raw.unreadMessages ?? 0);
  const totals = raw.totals ?? {
    contents: articles + projects,
    comments,
    messages: unreadMessages,
    interactions: comments + unreadMessages,
    likes: 0,
  };
  return {
    articles,
    projects,
    comments,
    unreadMessages,
    totals,
    contentStatus: raw.contentStatus ?? { draft: 0, published: articles + projects, archived: 0 },
    contentTypes: raw.contentTypes ?? { article: articles, project: projects },
    commentStatus: raw.commentStatus ?? { visible: comments, hidden: 0, spam: 0 },
    commentByContent: raw.commentByContent ?? { article: comments, project: 0 },
    messageStatus: raw.messageStatus ?? { unread: unreadMessages, read: 0, replied: 0, archived: 0 },
    trend: raw.trend?.length ? raw.trend : emptyTrend(),
    insights: raw.insights ?? { responseRate: 0, averageLikes: 0, publishedRate: articles + projects ? 100 : 0 },
  };
}

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function DonutChart({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const gradient = total
    ? segments.map((item) => {
        const start = cursor;
        const end = cursor + (item.value / total) * 100;
        cursor = end;
        return `${item.color} ${start}% ${end}%`;
      }).join(", ")
    : "#e6ded0 0% 100%";
  return <div className="overview-donut" style={{ background: `conic-gradient(${gradient})` }}><span>{total}</span><small>总量</small></div>;
}

function MiniBars({ items }: { items: Segment[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return <div className="overview-bars">
    {items.map((item) => <div key={item.label}>
      <span>{item.label}</span>
      <i><b style={{ width: `${Math.max(6, (item.value / max) * 100)}%`, background: item.color }} /></i>
      <strong>{item.value}</strong>
    </div>)}
  </div>;
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const values = points.map((item) => item.contents + item.comments + item.messages);
  const max = Math.max(1, ...values);
  const path = values.map((value, index) => {
    const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * 100;
    const y = 100 - (value / max) * 86 - 7;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  return <div className="overview-trend">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={path} /></svg>
    <div className="overview-trend-bars">
      {points.map((item) => {
        const total = item.contents + item.comments + item.messages;
        return <span key={item.date} style={{ height: `${Math.max(10, (total / max) * 100)}%` }}><em>{item.date.slice(5)}</em></span>;
      })}
    </div>
  </div>;
}

export default function AdminDashboardV3() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("personal-planet-admin-token");
    if (!token) {
      setError("请先登录管理员账号。");
      return;
    }
    fetch(apiBase + "/admin/overview", { headers: { Authorization: "Bearer " + token } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((raw) => setData(normalizeOverview(raw)))
      .catch(() => setError("无法读取后台数据，请重新登录或确认后端服务已经启动。"));
  }, []);

  const insights = useMemo(() => {
    if (!data) return [];
    const activeType = data.articles >= data.projects ? "文章" : "作品";
    const commentFocus = data.commentByContent.article >= data.commentByContent.project ? "文章" : "作品";
    return [
      `当前内容以${activeType}为主，公开发布率为 ${data.insights.publishedRate}%。`,
      `互动共 ${data.totals.interactions} 条，评论平均点赞 ${data.insights.averageLikes} 次。`,
      `评论更集中在${commentFocus}，可以优先优化该类型详情页的引导。`,
      `联系信息响应率为 ${data.insights.responseRate}%，未读 ${data.unreadMessages} 条。`,
    ];
  }, [data]);

  if (error) return <section className="admin-module"><p className="admin-state">{error}</p></section>;
  if (!data) return <section className="admin-module"><p className="admin-state">正在加载后台概览…</p></section>;

  const cards = [
    { key: "articles", value: data.articles, label: "文章总数", icon: FileText, href: "/admin/articles", tone: "orange" },
    { key: "projects", value: data.projects, label: "作品总数", icon: FolderKanban, href: "/admin/projects", tone: "green" },
    { key: "comments", value: data.comments, label: "可见评论", icon: MessageCircle, href: "/admin/comments", tone: "cyan" },
    { key: "unreadMessages", value: data.unreadMessages, label: "未读联系", icon: Mail, href: "/admin/messages", tone: "pink" },
  ];
  const contentStatus = [
    { label: "已发布", value: data.contentStatus.published, color: "#68d391" },
    { label: "草稿", value: data.contentStatus.draft, color: "#f6ad55" },
    { label: "归档", value: data.contentStatus.archived, color: "#a0aec0" },
  ];
  const contentTypes = [
    { label: "文章", value: data.contentTypes.article, color: "#ee704c" },
    { label: "作品", value: data.contentTypes.project, color: "#4fd1c5" },
  ];
  const commentStatus = [
    { label: "可见", value: data.commentStatus.visible, color: "#54e8ff" },
    { label: "隐藏", value: data.commentStatus.hidden, color: "#a783ff" },
    { label: "垃圾", value: data.commentStatus.spam, color: "#ff7aa8" },
  ];
  const messageStatus = [
    { label: "未读", value: data.messageStatus.unread, color: "#ff7aa8" },
    { label: "已读", value: data.messageStatus.read, color: "#f6ad55" },
    { label: "已回复", value: data.messageStatus.replied, color: "#68d391" },
    { label: "归档", value: data.messageStatus.archived, color: "#a0aec0" },
  ];

  return <section className="admin-module admin-overview">
    <p className="eyebrow">OVERVIEW</p>
    <h1>站点概览</h1>
    <p className="admin-intro">用数据观察内容生产、访问互动与联系信息，让后台像一张小小的驾驶舱。</p>
    <div className="admin-stats overview-stats">
      {cards.map(({ key, value, label, icon: Icon, href, tone }) => <a href={href} key={key} className={`overview-stat-${tone}`}><Icon size={21} /><strong>{value}</strong><span>{label}</span></a>)}
    </div>
    <div className="overview-grid">
      <article className="overview-card overview-card-large">
        <div className="overview-card-head"><span><PieChart size={18} /> 内容发布结构</span><small>{data.totals.contents} 条内容</small></div>
        <div className="overview-chart-row"><DonutChart segments={contentStatus} /><div><MiniBars items={contentStatus} /><p>发布率 {data.insights.publishedRate}% · 草稿占比 {percent(data.contentStatus.draft, data.totals.contents)}%</p></div></div>
      </article>
      <article className="overview-card"><div className="overview-card-head"><span><BarChart3 size={18} /> 文章 / 作品</span></div><MiniBars items={contentTypes} /></article>
      <article className="overview-card"><div className="overview-card-head"><span><MessageCircle size={18} /> 评论状态</span><small>{data.totals.comments} 条</small></div><MiniBars items={commentStatus} /></article>
      <article className="overview-card"><div className="overview-card-head"><span><Mail size={18} /> 联系处理</span><small>{data.insights.responseRate}% 响应</small></div><MiniBars items={messageStatus} /></article>
      <article className="overview-card overview-card-wide"><div className="overview-card-head"><span><TrendingUp size={18} /> 最近 7 天活跃趋势</span><small>内容 + 评论 + 联系</small></div><TrendChart points={data.trend} /></article>
      <article className="overview-card overview-card-insight"><div className="overview-card-head"><span><Sparkles size={18} /> 数据分析建议</span><small><Heart size={13} /> {data.totals.likes} 点赞</small></div><ul>{insights.map((item) => <li key={item}>{item}</li>)}</ul></article>
    </div>
  </section>;
}
