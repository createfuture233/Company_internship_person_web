/**
 * 封面类型
 */
export type CoverType = 'article' | 'project'

/** 文章默认封面列表 */
const articleCovers = Array.from(
  { length: 5 },
  (_, index) => `/assets/images/articles/article-cover-${String(index + 1).padStart(2, '0')}.png`,
)

/** 作品默认封面列表 */
const projectCovers = Array.from(
  { length: 5 },
  (_, index) => `/assets/images/projects/project-cover-${String(index + 1).padStart(2, '0')}.png`,
)

/**
 * 获取指定类型的封面选项列表
 * @param type - 封面类型（文章或作品）
 * @returns 封面 URL 数组
 */
export function getCoverOptions(type: CoverType) {
  return type === 'article' ? articleCovers : projectCovers
}

/**
 * 根据索引获取封面（循环使用）
 * @param type - 封面类型
 * @param index - 索引（默认为 0）
 * @returns 封面 URL
 */
export function getSequentialCover(type: CoverType, index = 0) {
  const covers = getCoverOptions(type)
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0
  return covers[safeIndex % covers.length]
}

/**
 * 解析封面 URL
 * 如果提供了自定义封面则使用自定义封面，否则使用默认封面
 * 开发环境下上传的封面会添加完整的本地服务器地址
 * 
 * @param type - 封面类型
 * @param coverUrl - 自定义封面 URL（可选）
 * @param index - 默认封面索引（默认为 0）
 * @returns 解析后的封面 URL
 */
export function resolveCover(
  type: CoverType,
  coverUrl?: string | null,
  index = 0,
) {
  const resolved = coverUrl?.trim() || getSequentialCover(type, index)

  // 开发环境下，上传的封面需要添加完整的服务器地址
  if (
    resolved.startsWith('/uploads/') &&
    !import.meta.env.PROD
  ) {
    return `${import.meta.env.PUBLIC_UPLOAD_BASE ?? 'http://localhost:3000'}${resolved}`
  }

  return resolved
}