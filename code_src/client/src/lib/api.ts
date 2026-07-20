/** 后端 API 的统一入口；部署时可由 PUBLIC_API_BASE 覆盖。 */
export const apiBase = import.meta.env.PUBLIC_API_BASE ?? 'http://localhost:3000/api'

export function apiUrl(path: string) {
  return apiBase + path
}
