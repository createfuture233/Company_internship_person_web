import { apiBase } from "../lib/api";
import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";

/** 导航链接配置 */
const links = [
  { href: "/about", label: "关于" },
  { href: "/articles", label: "文章" },
  { href: "/projects", label: "作品" },
  { href: "/contact", label: "联系" },
];

/**
 * 导航组件
 * 负责顶部导航栏的渲染，包含：
 * - 品牌 Logo
 * - 导航链接（根据登录状态动态显示后台入口）
 * - 主题切换按钮
 * - 管理员退出按钮
 * - 移动端菜单按钮
 */
export default function Navigation() {
  const [dark, setDark] = useState(false);       // 是否为深色主题
  const [open, setOpen] = useState(false);       // 移动端菜单是否展开
  const [current, setCurrent] = useState("/");   // 当前页面路径
  const [loggedIn, setLoggedIn] = useState(false); // 是否已登录管理员

  /**
   * 组件挂载时初始化状态
   * 1. 读取保存的主题设置
   * 2. 获取当前页面路径
   * 3. 检查管理员登录状态
   */
  useEffect(() => {
    const saved = localStorage.getItem("personal-planet-theme");
    setDark(saved === "dark");
    setCurrent(window.location.pathname);
    setLoggedIn(Boolean(localStorage.getItem("personal-planet-admin-token")));
  }, []);

  /**
   * 主题切换时更新页面主题和本地存储
   */
  useEffect(() => {
    const theme = dark ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("personal-planet-theme", theme);
  }, [dark]);

  /**
   * 管理员退出登录
   * 1. 向后端发送退出请求（如果有token）
   * 2. 清除本地token
   * 3. 如果当前在后台页面，跳转到首页
   */
  async function logout() {
    const token = localStorage.getItem("personal-planet-admin-token");
    if (token)
      await fetch(apiBase + "/auth/logout", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
    localStorage.removeItem("personal-planet-admin-token");
    setLoggedIn(false);
    if (
      window.location.pathname === "/admin" ||
      window.location.pathname.startsWith("/admin/")
    )
      window.location.href = "/";
  }

  /** 根据登录状态决定导航链接 */
  const navLinks = loggedIn
    ? [...links, { href: "/admin", label: "后台" }]
    : links;

  /** 判断链接是否为当前活动状态 */
  const isActive = (href: string) =>
    href === "/admin"
      ? current === "/admin" || current.startsWith("/admin/")
      : current === href;

  return (
    <nav className="nav">
      {/* 品牌 Logo */}
      <a className="brand" href="/">
        B-612<span>星球</span>
      </a>

      {/* 导航链接列表 */}
      <div className={open ? "links open" : "links"}>
        {navLinks.map((link) => (
          <a
            className={isActive(link.href) ? "active" : ""}
            aria-current={isActive(link.href) ? "page" : undefined}
            href={link.href}
            key={link.href}
            onClick={() => setOpen(false)}
          >
            {link.label}
          </a>
        ))}
      </div>

      {/* 操作按钮区域 */}
      <div className="nav-actions">
        {/* 管理员退出按钮 */}
        {loggedIn && (
          <button
            aria-label="退出管理员登录"
            className="icon-button admin-logout"
            onClick={() => void logout()}
          >
            <LogOut size={17} />
          </button>
        )}

        {/* 主题切换按钮 */}
        <button
          aria-label="切换主题"
          className="icon-button"
          data-theme-toggle
          onClick={() => setDark(!dark)}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* 移动端菜单按钮 */}
        <button
          aria-label="打开菜单"
          className="icon-button mobile"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </nav>
  );
}