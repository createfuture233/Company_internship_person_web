import { apiBase } from "./api";

export type PublicSiteSettings = {
  site_name?: string;
  home_intro?: string;
  contact_email?: string;
  github_url?: string;
  seo_title?: string;
  seo_description?: string;
};

export const defaultSiteSettings: Required<
  Pick<PublicSiteSettings, "contact_email" | "github_url">
> = {
  contact_email: "hello@example.com",
  github_url: "https://github.com",
};

export async function fetchPublicSiteSettings() {
  const response = await fetch(`${apiBase}/settings`);
  if (!response.ok) throw new Error("Failed to load public site settings");
  return (await response.json()) as PublicSiteSettings;
}

export function normalizeMailHref(email?: string) {
  const value = email?.trim() || defaultSiteSettings.contact_email;
  return value.startsWith("mailto:") ? value : `mailto:${value}`;
}

export function normalizeUrl(url?: string) {
  return url?.trim() || defaultSiteSettings.github_url;
}
