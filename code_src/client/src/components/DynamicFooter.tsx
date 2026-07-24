import { Github, Instagram, Linkedin, Rss } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  defaultSiteSettings,
  fetchPublicSiteSettings,
  normalizeMailHref,
  normalizeUrl,
  type PublicSiteSettings,
} from "../lib/siteSettings";

/**
 * 静态导航链接分组配置
 * 这些链接不会随配置变化
 */
const staticGroups = [
  [
    "探索",
    ["关于我", "/about"],
    ["文章记录", "/articles"],
    ["作品集", "/projects"],
    ["联系我", "/contact"],
  ],
  [
    "星球计划",
    ["设计实验", "/projects"],
    ["开发日志", "/articles"],
    ["未来清单", "/about"],
  ],
];

/**
 * 动态页脚组件
 * 与 Footer 组件类似，但支持从后端获取站点配置动态渲染联系信息
 * 使用 Framer Motion 实现滚动入场动画
 */
export default function DynamicFooter() {
  const [settings, setSettings] = useState<PublicSiteSettings | null>(null); // 站点配置

  /**
   * 组件挂载时获取站点配置
   * 获取失败时使用默认配置
   */
  useEffect(() => {
    fetchPublicSiteSettings()
      .then((data) => setSettings({ ...defaultSiteSettings, ...data }))
      .catch(() => setSettings(defaultSiteSettings));
  }, []);

  // 提取配置中的联系信息
  const email = settings?.contact_email?.trim() || "";
  const github = settings ? normalizeUrl(settings.github_url) : "";

  /**
   * 动态构建链接分组
   * 根据配置是否存在，决定是否添加"保持联系"分组
   */
  const groups = useMemo(
    () => {
      const contactGroup = settings
        ? [[
        "保持联系",
        ["GitHub", github],
        ["邮箱联系", normalizeMailHref(email)],
        ["订阅更新", "/contact"],
      ]]
        : []
      return [...staticGroups, ...contactGroup]
    },
    [email, github, settings],
  );

  return (
    <motion.footer
      className="liquid-footer"
      initial={false}                          // 不使用初始状态
      whileInView={{ opacity: [0.18, 1], y: [32, 0] }} // 进入视口时的动画效果
      viewport={{ once: false, amount: 0.15 }}         // 视口检测配置
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} // 动画过渡配置
    >
      <div className="footer-grid">
        {/* 品牌信息区域 */}
        <div className="footer-brand">
          <div className="footer-mark">✦</div>
          <strong>B-612星球</strong>
          <p>
            记录思考、作品与成长。在代码和想象之间，缓慢构建属于自己的数字宇宙。
          </p>
        </div>

        {/* 动态导航链接分组 */}
        <div className="footer-links">
          {groups.map(([title, ...items]) => (
            <div key={title as string}>
              <h3>{title as string}</h3>
              {items.map(([label, href]) => (
                <a key={label as string} href={href as string}>
                  {label as string}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 底部信息区域 */}
      <div className="footer-bottom">
        {/* 版权信息 */}
        <p>© 2026 B-612 PLANET · ALL SIGNALS OPEN</p>
        
        {/* 社交媒体链接（GitHub 动态显示） */}
        <div>
          <span>保持连接</span>
          {settings && (
            <a href={github} aria-label="GitHub">
              <Github size={16} />
            </a>
          )}
          <a href="#" aria-label="LinkedIn">
            <Linkedin size={16} />
          </a>
          <a href="#" aria-label="Instagram">
            <Instagram size={16} />
          </a>
          <a href="#" aria-label="RSS">
            <Rss size={16} />
          </a>
        </div>
      </div>
    </motion.footer>
  );
}