export type AiContentType = 'article' | 'project'

export const aiPrompts = {
  admin: {
    defaultGenerate:
      '根据上传文件或当前说明，生成一篇适合个人网站发布的内容。',
    defaultAnalyze:
      '请分析这篇内容还有哪些可以优化的地方。',
    chatSuggestions: [
      '分析最近内容还缺什么',
      '帮我规划下一篇文章',
      '总结作品页面可以优化的地方',
    ],
    chatPlaceholder:
      '向 AI 助手提问...',
    chatEmptyTitle:
      '问我一个后台问题',
    chatEmptyDescription:
      '例如：帮我规划下一篇文章、分析作品页、整理评论运营建议。',
    buildOneClickPrompt(type: AiContentType, fileAnalysis?: string) {
      const target = type === 'article' ? '文章' : '作品详情页'
      return [
        `请基于上传文件内容，一键生成一篇完整的${target}。`,
        '要求：标题明确，摘要自然，正文内容丰富，表达适合个人网站。',
        type === 'project'
          ? '如果是作品，请突出技术栈、功能亮点、实现过程和后续优化方向。'
          : '如果是文章，请突出背景、过程、思考和复盘价值。',
        fileAnalysis ? `参考以下 AI 文件分析：\n${fileAnalysis}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    },
  },
  visitor: {
    emptyMessage:
      '可以问我：这个网站有哪些作品？这篇文章讲了什么？作者正在探索什么方向？',
    inputPlaceholder:
      '问问这个星球...',
  },
}
