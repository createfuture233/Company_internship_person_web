import { useEffect, useState } from "react";
import {
  defaultSiteSettings,
  fetchPublicSiteSettings,
  normalizeMailHref,
  normalizeUrl,
  type PublicSiteSettings,
} from "../lib/siteSettings";

/**
 * 站点联系链接组件
 * 从后端动态获取联系方式并展示
 */
export default function SiteContactLinks() {
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

  // 加载状态显示
  if (!settings) {
    return (
      <div className="contact-links">
        <span>正在读取联系方式...</span>
      </div>
    );
  }

  // 提取联系信息
  const email = settings.contact_email?.trim() || defaultSiteSettings.contact_email;
  const github = normalizeUrl(settings?.github_url);

  return (
    <div className="contact-links">
      {/* 邮箱链接 */}
      <a href={normalizeMailHref(email)}>✉ {email}</a>
      {/* GitHub 链接 */}
      <a href={github} target="_blank" rel="noreferrer">
        ◇ GitHub
      </a>
    </div>
  );
}