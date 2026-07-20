import { useEffect, useState } from "react";
import { FileText, FolderKanban, Mail, MessageCircle } from "lucide-react";
import { apiBase } from "../lib/api";

type Overview = {
  articles: number;
  projects: number;
  comments: number;
  unreadMessages: number;
};
const cards = [
  { key: "articles", label: "文章", icon: FileText, href: "/admin/articles" },
  {
    key: "projects",
    label: "作品",
    icon: FolderKanban,
    href: "/admin/projects",
  },
  {
    key: "comments",
    label: "可见评论",
    icon: MessageCircle,
    href: "/admin/comments",
  },
  {
    key: "unreadMessages",
    label: "未读联系",
    icon: Mail,
    href: "/admin/messages",
  },
] as const;
export default function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const token = localStorage.getItem("personal-planet-admin-token");
    if (!token) return;
    fetch(apiBase + "/admin/overview", {
      headers: { Authorization: "Bearer " + token },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError("无法读取后台数据，请重新登录。"));
  }, []);
  if (error) return <p className="admin-state">{error}</p>;
  if (!data) return <p className="admin-state">正在加载后台概览…</p>;
  return (
    <section className="admin-module">
      <p className="eyebrow">OVERVIEW</p>
      <h1>站点概览</h1>
      <p className="admin-intro">在这里快速查看内容、互动与联系信息。</p>
      <div className="admin-stats">
        {cards.map(({ key, label, icon: Icon, href }) => (
          <a href={href} key={key}>
            <Icon size={21} />
            <strong>{data[key]}</strong>
            <span>{label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
