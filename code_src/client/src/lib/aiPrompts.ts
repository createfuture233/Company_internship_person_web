/**
 * AI 内容类型
 */
export type AiContentType = 'article' | 'project'

/**
 * AI 提示词配置
 * 包含管理员和访客端的各种提示词模板
 */
export const aiPrompts = {
  /** 管理员端提示词配置 */
  admin: {
    /** 默认生成提示词 */
    defaultGenerate:
      '根据上传文件或当前说明，生成一篇适合个人网站发布的内容。',
    
    /** 默认分析提示词 */
    defaultAnalyze:
      '请分析这篇内容还有哪些可以优化的地方。',
    
    /** 聊天建议列表 */
    chatSuggestions: [
      '分析最近内容还缺什么',
      '帮我规划下一篇文章',
      '总结作品页面可以优化的地方',
    ],
    
    /** 聊天输入框占位符 */
    chatPlaceholder:
      '向 AI 助手提问...',
    
    /** 空聊天状态标题 */
    chatEmptyTitle:
      '问我一个后台问题',
    
    /** 空聊天状态描述 */
    chatEmptyDescription:
      '例如：帮我规划下一篇文章、分析作品页、整理评论运营建议。',
    
    /**
     * 构建一键生成提示词
     * @param type - 内容类型（文章或作品）
     * @param fileAnalysis - 文件分析结果（可选）
     * @returns 完整的提示词字符串
     */
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
  
  /** 访客端提示词配置 */
  visitor: {
    /** 空消息状态提示 */
    emptyMessage:
      '可以问我：这个网站有哪些作品？这篇文章讲了什么？作者正在探索什么方向？',
    
    /** 输入框占位符 */
    inputPlaceholder:
      '问问这个星球...',
  },
}