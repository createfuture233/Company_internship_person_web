/**
 * 后端 API 统一入口。
 *
 * - 本地开发：默认请求 NestJS 的 http://localhost:3000/api
 * - 生产部署：默认走 Nginx 同源反向代理 /api
 * - 特殊部署：可用 PUBLIC_API_BASE 覆盖
 */
const browserApiBase = import.meta.env.PUBLIC_API_BASE;
const ssrApiBase = import.meta.env.PUBLIC_SSR_API_BASE;

export const apiBase = import.meta.env.SSR
  ? (ssrApiBase ?? "http://127.0.0.1:3000/api")
  : (browserApiBase ?? (import.meta.env.PROD ? "/api" : "http://localhost:3000/api"));

export function apiUrl(path: string) {
  return apiBase + path;
}
