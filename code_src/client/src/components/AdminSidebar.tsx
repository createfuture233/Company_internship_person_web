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

/**
 * 后台侧边栏导航链接配置
 */
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

/**
 * 管理员后台侧边栏组件
 * 提供后台管理的导航菜单
 * @param active - 当前激活的菜单项
 */
export default function AdminSidebar({ active }: { active: string }) {
  /**
   * 组件挂载时验证管理员登录状态
   * 如果未登录则重定向到首页
   */
  useEffect(() => {
    if (!localStorage.getItem("personal-planet-admin-token"))
      window.location.href = "/";
  }, []);

  return (
    <aside className="admin-sidebar">
      <p className="eyebrow">ADMIN CONSOLE</p>
      <h2>后台</h2>
      <p>管理内容与站点信号。</p>
      
      {/* 导航菜单 */}
      <nav>
        {links.map(({ key, href, label, icon: Icon }) => (
          <a 
            href={href} 
            className={active === key ? "active" : ""} 
            key={key}
          >
            <Icon size={17} />
            {label}
          </a>
        ))}
      </nav>
    </aside>
  );
}