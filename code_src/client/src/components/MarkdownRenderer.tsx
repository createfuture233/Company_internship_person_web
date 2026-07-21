import { marked } from 'marked'
import { useEffect, useState } from 'react'

interface MarkdownRendererProps {
  content: string
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    const parseMarkdown = async () => {
      marked.setOptions({
        gfm: true,
        breaks: true,
      })
      const result = await marked.parse(content)
      setHtml(result as string)
    }
    parseMarkdown()
  }, [content])

  return (
    <div 
      className="markdown-content" 
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}