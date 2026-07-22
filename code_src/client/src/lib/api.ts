/**
 * 后端 API 统一入口。
 *
 * - 本地开发：默认请求 NestJS 的 http://localhost:3000/api
 * - 生产部署：默认走 Nginx 同源反向代理 /api
 * - 特殊部署：可用 PUBLIC_API_BASE 覆盖
 */
export const apiBase =
  import.meta.env.PUBLIC_API_BASE ??
  (import.meta.env.PROD ? "/api" : "http://localhost:3000/api");

export function apiUrl(path: string) {
  return apiBase + path;
}
