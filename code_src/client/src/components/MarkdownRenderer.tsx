import { marked } from 'marked'
import { useEffect, useState } from 'react'

/**
 * Markdown 渲染器组件属性
 */
interface MarkdownRendererProps {
  content: string  // Markdown 格式的内容
}

/**
 * Markdown 渲染器组件
 * 使用 marked 库将 Markdown 文本转换为 HTML 并渲染
 * 支持 GitHub Flavored Markdown (GFM) 和换行符转换
 */
export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const [html, setHtml] = useState('') // 解析后的 HTML 内容

  /**
   * 当内容变化时重新解析 Markdown
   */
  useEffect(() => {
    const parseMarkdown = async () => {
      // 配置 marked 解析选项
      marked.setOptions({
        gfm: true,        // 启用 GitHub Flavored Markdown
        breaks: true,     // 将软换行转换为 <br> 标签
      })
      // 异步解析 Markdown
      const result = await marked.parse(content)
      setHtml(result as string)
    }
    parseMarkdown()
  }, [content])

  // 使用 dangerouslySetInnerHTML 渲染解析后的 HTML
  return (
    <div 
      className="markdown-content" 
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}