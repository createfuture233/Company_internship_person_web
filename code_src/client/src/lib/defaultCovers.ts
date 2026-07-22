export type CoverType = 'article' | 'project'

const articleCovers = Array.from(
  { length: 5 },
  (_, index) => `/assets/images/articles/article-cover-${String(index + 1).padStart(2, '0')}.png`,
)

const projectCovers = Array.from(
  { length: 5 },
  (_, index) => `/assets/images/projects/project-cover-${String(index + 1).padStart(2, '0')}.png`,
)

export function getCoverOptions(type: CoverType) {
  return type === 'article' ? articleCovers : projectCovers
}

export function getSequentialCover(type: CoverType, index = 0) {
  const covers = getCoverOptions(type)
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0
  return covers[safeIndex % covers.length]
}

export function resolveCover(
  type: CoverType,
  coverUrl?: string | null,
  index = 0,
) {
  return coverUrl?.trim() || getSequentialCover(type, index)
}
