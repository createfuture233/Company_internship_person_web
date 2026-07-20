import { useEffect } from 'react'

type ContentType = 'article' | 'project'
const apiBase = import.meta.env.PUBLIC_API_BASE ?? 'http://localhost:3000/api'

export default function ContentLiveSync({ type, id }: { type: ContentType; id: string }) {
  useEffect(() => {
    fetch(apiBase + '/content/' + type + '/' + id)
      .then((response) => response.ok ? response.json() : null)
      .then((item: { title: string; summary: string; body: string } | null) => {
        if (!item) return
        const root = document.querySelector<HTMLElement>('.detail-page')
        if (!root) return
        const title = root.querySelector<HTMLElement>('[data-content-title]')
        const summary = root.querySelector<HTMLElement>('[data-content-summary]')
        const body = root.querySelector<HTMLElement>('[data-content-body]')
        if (title) title.textContent = item.title
        if (summary) summary.textContent = item.summary
        if (body) body.textContent = item.body
      })
      .catch(() => undefined)
  }, [id, type])

  return null
}