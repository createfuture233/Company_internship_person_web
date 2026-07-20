export type ContentType = 'article' | 'project'

export type ContentSummary = {
  id: string
  slug: string
  type: ContentType
  title: string
  summary: string
  body: string
  publishedAt?: string
}
