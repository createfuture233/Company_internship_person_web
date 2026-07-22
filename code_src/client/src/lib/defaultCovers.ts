export type CoverType = 'article' | 'project'

const articleCovers = Array.from(
  { length: 5 },
  (_, index) => `/assets/images/articles/article-cover-${String(index + 1).padStart(2, '0')}.png`,
)

const projectCovers = Array.from(
  { length: 5 },
  (_, index) => `/assets/images/projects/project-cover-${String(index + 1).padStart(2, '0')}.png`,
)

function stableHash(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

export function getDefaultCover(type: CoverType, seed: string) {
  const covers = type === 'article' ? articleCovers : projectCovers
  return covers[stableHash(seed || type) % covers.length]
}

export function resolveCover(
  type: CoverType,
  seed: string,
  coverUrl?: string | null,
) {
  return coverUrl?.trim() || getDefaultCover(type, seed)
}
