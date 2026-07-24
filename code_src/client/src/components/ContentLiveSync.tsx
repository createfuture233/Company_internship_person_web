import { apiBase } from "../lib/api";
import { useEffect } from "react";

/** 内容类型 */
type ContentType = "article" | "project";

/**
 * 内容实时同步组件
 * 在文章或作品详情页自动获取最新内容并更新页面
 * 用于实现无刷新的内容更新
 */
export default function ContentLiveSync({
  type,
  id,
}: {
  type: ContentType;  // 内容类型（文章或项目）
  id: string;         // 内容ID
}) {
  /**
   * 组件挂载时获取内容并更新页面元素
   */
  useEffect(() => {
    fetch(apiBase + "/content/" + type + "/" + id)
      .then((response) => (response.ok ? response.json() : null))
      .then((item: { title: string; summary: string; body: string } | null) => {
        if (!item) return;
        
        // 获取页面根元素
        const root = document.querySelector<HTMLElement>(".detail-page");
        if (!root) return;

        // 更新标题、摘要和正文
        const title = root.querySelector<HTMLElement>("[data-content-title]");
        const summary = root.querySelector<HTMLElement>("[data-content-summary]");
        const body = root.querySelector<HTMLElement>("[data-content-body]");
        
        if (title) title.textContent = item.title;
        if (summary) summary.textContent = item.summary;
        if (body) body.textContent = item.body;
      })
      .catch(() => undefined);
  }, [id, type]);

  // 该组件不渲染任何内容，只执行副作用
  return null;
}