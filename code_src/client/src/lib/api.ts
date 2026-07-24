/**
 * 后端 API 基础地址配置
 * 
 * 根据环境变量和运行模式自动选择合适的 API 地址：
 * - 浏览器环境（非 SSR）：
 *   - 生产环境：使用 `/api`（Nginx 反向代理）
 *   - 开发环境：使用 `http://localhost:3000/api`
 *   - 可通过 `PUBLIC_API_BASE` 环境变量覆盖
 * - SSR 环境：
 *   - 默认使用 `http://127.0.0.1:3000/api`
 *   - 可通过 `PUBLIC_SSR_API_BASE` 环境变量覆盖
 */
const browserApiBase = import.meta.env.PUBLIC_API_BASE;
const ssrApiBase = import.meta.env.PUBLIC_SSR_API_BASE;

/**
 * API 基础地址
 */
export const apiBase = import.meta.env.SSR
  ? (ssrApiBase ?? "http://127.0.0.1:3000/api")
  : (browserApiBase ?? (import.meta.env.PROD ? "/api" : "http://localhost:3000/api"));

/**
 * 构建完整的 API URL
 * @param path - API 路径（如 `/articles`）
 * @returns 完整的 API URL
 */
export function apiUrl(path: string) {
  return apiBase + path;
}