import { useEffect, useState } from "react";
import {
  defaultSiteSettings,
  fetchPublicSiteSettings,
  normalizeMailHref,
  normalizeUrl,
  type PublicSiteSettings,
} from "../lib/siteSettings";

export default function SiteContactLinks() {
  const [settings, setSettings] = useState<PublicSiteSettings | null>(null);

  useEffect(() => {
    fetchPublicSiteSettings()
      .then((data) => setSettings({ ...defaultSiteSettings, ...data }))
      .catch(() => setSettings(defaultSiteSettings));
  }, []);

  if (!settings) {
    return (
      <div className="contact-links">
        <span>正在读取联系方式...</span>
      </div>
    );
  }

  const email = settings.contact_email?.trim() || defaultSiteSettings.contact_email;
  const github = normalizeUrl(settings?.github_url);

  return (
    <div className="contact-links">
      <a href={normalizeMailHref(email)}>✉ {email}</a>
      <a href={github} target="_blank" rel="noreferrer">
        ◇ GitHub
      </a>
    </div>
  );
}
