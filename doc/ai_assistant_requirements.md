# AI 助手功能需求文档

> 文档状态：新增规划  
> 最后更新：2026-07-21  
> 项目名称：B-612星球  
> 关联模块：文章、作品、管理后台、访客问答、文件解析

## 1. 功能定位

AI 助手用于增强个人网站的内容生产、内容理解和访问互动能力。系统以 DeepSeek 作为大模型调用服务，结合网站已有文章、作品、评论和上传文件，提供两类能力：

- 管理者 AI：帮助管理员解析文件、生成文章或作品草稿、优化已有内容、分析当前内容质量，并辅助管理后台运营。
- 访客 AI：基于公开文章和作品回答访客问题，引导访客理解作者经历、作品细节、技术栈和文章观点。

AI 助手不替代管理员发布内容。AI 生成的文章、作品或修改建议必须先进入草稿或预览状态，由管理员确认后才能公开展示。

## 2. 用户角色与权限

| 角色 | 入口 | 可使用能力 | 数据访问范围 |
| --- | --- | --- | --- |
| 访客 | 前台悬浮 AI 按钮、文章详情页、作品详情页 | 问答、内容解释、相关推荐 | 只能访问已发布文章、已发布作品和公开站点信息 |
| 管理员 | 后台 AI 助手页面、文章/作品编辑页 | 文件解析、生成草稿、内容分析、内容改写、管理问答 | 可访问文章、作品、评论、联系信息、站点设置和上传文件 |

### 2.1 访客限制

- 访客不能访问草稿、归档内容、后台数据、联系信息、管理员账号信息和系统配置。
- 访客提问需要限流，防止恶意刷接口。
- 访客侧回答必须基于公开内容，无法确定时应明确说明“不确定”。

### 2.2 管理员限制

- 管理员必须登录后才能使用后台 AI 能力。
- 管理员 AI 生成结果默认保存为草稿，不自动发布。
- 管理员使用文件解析和批量生成时，应记录操作日志。

## 3. 入口与页面规划

```text
前台：
/articles/:id                  文章详情页 AI 问答
/projects/:slug                作品详情页 AI 问答
全站右下角                    访客 AI 助手悬浮入口

后台：
/admin/ai                      AI 助手总入口
/admin/articles                文章管理：生成/分析/改写入口
/admin/projects                作品管理：生成/分析/改写入口
/admin/messages                可用 AI 辅助理解联系信息，但不自动回复
```

### 3.1 访客 AI 助手界面

- 右下角新增 AI 悬浮按钮，样式适配明亮和暗色主题。
- 点击后打开聊天面板。
- 聊天面板显示欢迎语、输入框、发送按钮、加载状态和历史消息。
- 在文章详情页中，默认上下文为当前文章。
- 在作品详情页中，默认上下文为当前作品。
- 在其他页面中，默认上下文为公开站点信息、已发布文章和已发布作品摘要。

### 3.2 管理员 AI 助手界面

后台新增 `/admin/ai` 页面，侧边栏增加“AI 助手”菜单项。页面分为以下分区：

| 分区 | 功能 |
| --- | --- |
| 文件解析 | 上传 Markdown、TXT、PDF、DOCX 等文件，提取文本内容 |
| 生成文章 | 根据文件内容、提示词或已有资料生成文章草稿 |
| 生成作品 | 根据项目说明、技术栈、截图说明或文件内容生成作品草稿 |
| 内容分析 | 分析当前文章或作品的结构、表达、SEO、可读性和改进建议 |
| 管理问答 | 管理员可以询问站点数据、内容状态、评论反馈和联系信息概况 |

## 4. 核心功能需求

### 4.1 文件上传与解析

管理员可以上传文件，系统解析文件内容后交给 AI 使用。

支持文件类型建议：

| 类型 | 后缀 | 解析方式 |
| --- | --- | --- |
| 纯文本 | `.txt` | 直接读取文本 |
| Markdown | `.md` | 保留标题、列表、代码块等结构 |
| PDF | `.pdf` | 使用后端解析库提取文本 |
| Word | `.docx` | 使用后端解析库提取段落、标题和表格文本 |
| JSON | `.json` | 格式化后作为结构化数据输入 |

文件限制：

- 单个文件建议不超过 10MB。
- 文件内容过长时需要切分为多个片段。
- 上传文件仅管理员可见。
- 原始文件和解析文本都需要记录来源。
- 文件解析失败时，页面应显示明确错误原因。

### 4.2 生成文章

管理员可以输入主题、目标读者、文章风格、关键词，也可以选择一个或多个已解析文件作为素材。

生成结果包含：

- 标题
- 摘要
- 正文
- 标签建议
- 封面图提示词或封面图地址建议
- 发布状态，默认 `draft`

生成后处理：

- 管理员可在右侧预览文章效果。
- 管理员点击“保存为草稿”后写入 `contents` 和 `content_tags`。
- 管理员可继续手动编辑后再发布。

### 4.3 生成作品

管理员可以输入项目名称、项目背景、技术栈、实现功能、项目亮点和文件素材。

生成结果包含：

- 作品名称
- slug 建议
- 摘要
- 详情正文
- 技术栈 `stack`
- 标签建议
- 封面图地址或封面描述
- 发布状态，默认 `draft`

生成后处理：

- 管理员可保存为作品草稿。
- 作品保存后进入 `/admin/projects` 表格管理。
- 发布后生成真实展示路径 `/projects/:slug`。

### 4.4 分析当前文章或作品

管理员在文章或作品详情页、编辑页中可以点击“AI 分析”。

分析维度：

| 分析项 | 说明 |
| --- | --- |
| 内容结构 | 标题、摘要、段落层次是否清晰 |
| 表达质量 | 语言是否自然、是否有重复或歧义 |
| 信息完整度 | 是否缺少背景、目标、过程、结果或技术细节 |
| SEO 建议 | 标题关键词、摘要、标签是否合理 |
| 访客理解 | 普通访客是否容易读懂 |
| 改写建议 | 给出可直接采用的修改版本 |

分析结果只作为建议，不直接覆盖原内容。

### 4.5 访客问答

访客可以询问：

- 这篇文章主要讲什么？
- 这个作品用了哪些技术？
- 作者有什么项目经验？
- 哪些文章适合继续阅读？
- 这个网站有哪些作品？

回答规则：

- 优先使用当前页面内容。
- 当前页面无法回答时，再检索公开文章和作品摘要。
- 不能泄露后台数据、草稿、归档内容、管理员信息、联系表单内容。
- 对无法确定的问题，应说明资料不足。

### 4.6 管理者问答

管理员可以询问：

- 最近有哪些评论？
- 哪些文章还没有发布？
- 哪些作品内容太短？
- 某篇文章适合加什么标签？
- 根据最近联系信息总结潜在合作方向。

管理问答可以读取后台数据，但必须经过管理员鉴权。

## 5. DeepSeek 调用设计

### 5.1 调用方式

后端负责调用 DeepSeek API，前端不得直接保存或暴露 DeepSeek API Key。

```text
前端 React/Astro
    ↓ HTTP 请求
NestJS AI Controller
    ↓ 构建 Prompt、检索上下文、调用 DeepSeek
DeepSeek API
    ↓ 返回模型结果
NestJS 解析、过滤、落库
    ↓ JSON 返回
前端展示结果
```

### 5.2 环境变量

后端 `.env` 增加：

```env
DEEPSEEK_API_KEY="your_deepseek_api_key"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
AI_MAX_CONTEXT_CHARS="12000"
AI_VISITOR_RATE_LIMIT="20"
AI_ADMIN_RATE_LIMIT="100"
```

说明：

- `DEEPSEEK_API_KEY` 只放在后端环境变量中，不提交 Git。
- `DEEPSEEK_MODEL` 用于统一切换模型。
- `AI_MAX_CONTEXT_CHARS` 限制单次传给模型的上下文长度。
- 访客和管理员使用不同限流策略。

### 5.3 Prompt 分层

建议把提示词拆成三层：

| 层级 | 作用 |
| --- | --- |
| System Prompt | 定义 AI 身份、回答边界、安全规则 |
| Context Prompt | 注入当前文章、作品、文件解析结果或数据库查询结果 |
| User Prompt | 用户真实问题或管理员生成需求 |

访客 System Prompt 要强调：只能回答公开内容，不得编造后台信息。  
管理员 System Prompt 要强调：生成内容需要返回结构化 JSON，不能直接发布。

## 6. 数据库设计建议

### 6.1 新增数据表

#### ai_conversations：AI 会话表

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| id | TEXT 主键 | 会话 ID |
| role_scope | TEXT | 会话类型：visitor 或 admin |
| content_id | TEXT，可空 | 当前关联文章或作品 ID |
| content_type | TEXT，可空 | article、project 或 null |
| title | TEXT，可空 | 会话标题 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

#### ai_messages：AI 消息表

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| id | TEXT 主键 | 消息 ID |
| conversation_id | TEXT | 所属会话 ID |
| sender | TEXT | user、assistant 或 system |
| body | TEXT | 消息内容 |
| token_usage | INTEGER，可空 | 本次消息消耗 token 数 |
| created_at | DATETIME | 创建时间 |

#### ai_uploaded_files：AI 上传文件表

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| id | TEXT 主键 | 文件 ID |
| original_name | TEXT | 原始文件名 |
| mime_type | TEXT | 文件 MIME 类型 |
| file_size | INTEGER | 文件大小，单位字节 |
| storage_path | TEXT | 文件保存路径 |
| parsed_text | TEXT | 解析后的文本内容 |
| parse_status | TEXT | pending、success、failed |
| error_message | TEXT，可空 | 解析失败原因 |
| created_at | DATETIME | 上传时间 |

#### ai_generations：AI 生成记录表

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| id | TEXT 主键 | 生成任务 ID |
| generation_type | TEXT | article、project、analysis、rewrite |
| source_file_id | TEXT，可空 | 关联上传文件 ID |
| source_content_id | TEXT，可空 | 关联已有内容 ID |
| prompt | TEXT | 管理员输入的生成要求 |
| result_json | TEXT | AI 返回的结构化结果 |
| target_content_id | TEXT，可空 | 保存为草稿后的内容 ID |
| status | TEXT | pending、success、failed、saved |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 6.2 与现有表的关系

- AI 生成文章或作品后，最终仍写入现有 `contents` 表。
- 标签仍写入现有 `content_tags` 表。
- AI 分析结果可以只保存在 `ai_generations` 中，不影响正式内容。
- 访客问答只读取 `published` 状态内容。

## 7. 后端接口规划

### 7.1 访客接口

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/ai/visitor/chat` | POST | 访客提问，基于公开内容回答 |
| `/api/ai/visitor/conversations` | POST | 创建访客会话，可选 |
| `/api/ai/visitor/conversations/:id/messages` | GET | 获取访客会话历史，可选 |

### 7.2 管理员接口

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/admin/ai/files` | POST | 上传并解析文件 |
| `/api/admin/ai/files` | GET | 查看已上传文件 |
| `/api/admin/ai/files/:id` | DELETE | 删除上传文件和解析文本 |
| `/api/admin/ai/generate/article` | POST | 根据提示词或文件生成文章草稿 |
| `/api/admin/ai/generate/project` | POST | 根据提示词或文件生成作品草稿 |
| `/api/admin/ai/analyze/content/:id` | POST | 分析已有文章或作品 |
| `/api/admin/ai/rewrite/content/:id` | POST | 改写已有文章或作品 |
| `/api/admin/ai/save-generation/:id` | POST | 将生成结果保存为草稿 |
| `/api/admin/ai/chat` | POST | 管理员问答 |

## 8. 前端组件规划

| 组件 | 位置 | 作用 |
| --- | --- | --- |
| `AiFloatingButton.tsx` | `client/src/components` | 前台 AI 悬浮入口 |
| `VisitorAiChat.tsx` | `client/src/components` | 访客聊天面板 |
| `AdminAiDashboard.tsx` | `client/src/components` | 后台 AI 助手总页面 |
| `AiFileUploader.tsx` | `client/src/components` | 文件上传与解析状态 |
| `AiGenerationForm.tsx` | `client/src/components` | 文章/作品生成表单 |
| `AiAnalysisPanel.tsx` | `client/src/components` | 内容分析结果展示 |
| `AiSuggestionPreview.tsx` | `client/src/components` | AI 生成草稿预览与保存 |

## 9. 推荐实现步骤

1. 后端增加 DeepSeek 配置读取和 `AiService`。
2. 实现最小可用的管理员 AI 聊天接口。
3. 新增 `/admin/ai` 页面和侧边栏入口。
4. 实现文件上传与文本解析。
5. 实现生成文章草稿，并写入 `contents` 表。
6. 实现生成作品草稿，并写入 `contents` 表。
7. 实现文章/作品分析功能。
8. 实现前台访客 AI 问答，只允许读取公开内容。
9. 增加限流、日志、错误处理和敏感信息过滤。
10. 优化 UI、流式输出、会话历史和上下文检索。

## 10. 安全与合规要求

- DeepSeek API Key 只能存在后端 `.env` 中。
- 前端请求 AI 接口时，不得携带或暴露模型密钥。
- 文件上传需要限制大小、类型和数量。
- 解析后的文本可能包含隐私信息，仅管理员可见。
- 访客 AI 不允许读取草稿、归档内容、后台消息、管理员会话和配置。
- 管理员 AI 操作需要写入审计日志。
- AI 生成内容必须经过管理员确认后才能发布。
- 对外回答应避免编造事实，缺少资料时明确说明无法确定。

## 11. 验收标准

- 管理员登录后可以进入 `/admin/ai`。
- 管理员可以上传文件并看到解析后的文本摘要。
- 管理员可以根据文件或提示词生成文章草稿。
- 管理员可以根据文件或提示词生成作品草稿。
- AI 生成的文章和作品默认保存为草稿，不自动发布。
- 管理员可以对已有文章或作品进行 AI 分析，并看到结构化建议。
- 访客可以在文章或作品详情页提问，并获得基于当前公开内容的回答。
- 访客无法通过 AI 获得后台数据、草稿内容或联系表单内容。
- DeepSeek API Key 不出现在前端代码、浏览器请求和 Git 提交中。
- 后端日志能记录管理员 AI 生成、保存、分析等关键操作。