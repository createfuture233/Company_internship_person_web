import {
  BarChart3,
  Bot,
  FileText,
  FolderKanban,
  Mail,
  MessageCircle,
  Settings,
} from "lucide-react";
import { useEffect } from "react";

const links = [
  { key: "overview", href: "/admin", label: "概览", icon: BarChart3 },
  { key: "articles", href: "/admin/articles", label: "文章", icon: FileText },
  {
    key: "projects",
    href: "/admin/projects",
    label: "作品",
    icon: FolderKanban,
  },
  {
    key: "comments",
    href: "/admin/comments",
    label: "评论",
    icon: MessageCircle,
  },
  { key: "messages", href: "/admin/messages", label: "联系信息", icon: Mail },
  { key: "ai", href: "/admin/ai", label: "AI 助手", icon: Bot },
  {
    key: "settings",
    href: "/admin/settings",
    label: "网站设置",
    icon: Settings,
  },
];

export default function AdminSidebar({ active }: { active: string }) {
  useEffect(() => {
    if (!localStorage.getItem("personal-planet-admin-token"))
      window.location.href = "/";
  }, []);
  return (
    <aside className="admin-sidebar">
      <p className="eyebrow">ADMIN CONSOLE</p>
      <h2>后台</h2>
      <p>管理内容与站点信号。</p>
      <nav>
        {links.map(({ key, href, label, icon: Icon }) => (
          <a href={href} className={active === key ? "active" : ""} key={key}>
            <Icon size={17} />
            {label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
