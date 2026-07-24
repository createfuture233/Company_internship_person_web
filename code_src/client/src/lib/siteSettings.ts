import { apiBase } from "./api";

/**
 * 公开站点设置类型
 * 包含可公开访问的站点配置信息
 */
export type PublicSiteSettings = {
  site_name?: string;          // 站点名称
  home_intro?: string;         // 首页介绍文案
  contact_email?: string;      // 联系邮箱
  github_url?: string;         // GitHub 链接
  seo_title?: string;          // SEO 标题
  seo_description?: string;    // SEO 描述
};

/**
 * 默认站点设置
 * 当后端未配置时使用这些默认值
 */
export const defaultSiteSettings: Required<
  Pick<PublicSiteSettings, "contact_email" | "github_url">
> = {
  contact_email: "hello@example.com",
  github_url: "https://github.com",
};

/**
 * 从后端获取公开站点设置
 * @returns 站点设置对象
 * @throws 当请求失败时抛出错误
 */
export async function fetchPublicSiteSettings() {
  const response = await fetch(`${apiBase}/settings`);
  if (!response.ok) throw new Error("Failed to load public site settings");
  return (await response.json()) as PublicSiteSettings;
}

/**
 * 规范化邮箱链接
 * 确保邮箱地址以 mailto: 开头
 * 
 * @param email - 邮箱地址（可选）
 * @returns 规范化的 mailto 链接
 */
export function normalizeMailHref(email?: string) {
  const value = email?.trim() || defaultSiteSettings.contact_email;
  return value.startsWith("mailto:") ? value : `mailto:${value}`;
}

/**
 * 规范化 URL
 * 如果为空则使用默认的 GitHub URL
 * 
 * @param url - URL（可选）
 * @returns 规范化的 URL
 */
export function normalizeUrl(url?: string) {
  return url?.trim() || defaultSiteSettings.github_url;
}