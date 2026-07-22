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

export default function DynamicFooter() {
  const [settings, setSettings] = useState<PublicSiteSettings | null>(null);

  useEffect(() => {
    fetchPublicSiteSettings()
      .then((data) => setSettings({ ...defaultSiteSettings, ...data }))
      .catch(() => setSettings(defaultSiteSettings));
  }, []);

  const email = settings?.contact_email?.trim() || "";
  const github = settings ? normalizeUrl(settings.github_url) : "";
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
      initial={false}
      whileInView={{ opacity: [0.18, 1], y: [32, 0] }}
      viewport={{ once: false, amount: 0.15 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="footer-mark">✦</div>
          <strong>个人星球</strong>
          <p>
            记录思考、作品与成长。在代码和想象之间，缓慢构建属于自己的数字宇宙。
          </p>
        </div>
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
      <div className="footer-bottom">
        <p>© 2026 PERSONAL PLANET · ALL SIGNALS OPEN</p>
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
