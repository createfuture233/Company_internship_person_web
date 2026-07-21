# AI 助手功能实现说明

> 更新时间：2026-07-21  
> 技术栈：Astro + React Islands + NestJS + Prisma + SQLite + DeepSeek  
> 状态：已实现第一版完整闭环

## 1. 功能范围

AI 助手分为两类使用者：

| 使用者 | 入口 | 已实现能力 |
| --- | --- | --- |
| 访客 | 全站右下角悬浮 AI 按钮 | 基于公开文章、作品和当前详情页上下文进行问答 |
| 管理员 | `/admin/ai` 后台页面 | 后台问答、文件解析、生成文章、生成作品、分析已有内容、保存 AI 生成结果 |

## 2. 后端接口

### 2.1 管理员接口

所有管理员接口都需要请求头：

```http
Authorization: Bearer <admin-token>
```

| 接口 | 方法 | 作用 |
| --- | --- | --- |
| `/api/admin/ai/config` | GET | 检查 DeepSeek 配置状态 |
| `/api/admin/ai/chat` | POST | 管理员后台 AI 问答 |
| `/api/admin/ai/files` | POST | 上传并解析文本类文件 |
| `/api/admin/ai/generate` | POST | 根据提示词、文件或现有内容生成文章/作品草稿 |
| `/api/admin/ai/analyze` | POST | 分析已有文章或作品 |
| `/api/admin/ai/generations/:id/save` | POST | 将 AI 生成结果保存到 `contents` 和 `content_tags` |

### 2.2 访客接口

| 接口 | 方法 | 作用 |
| --- | --- | --- |
| `/api/ai/visitor/chat` | POST | 访客 AI 问答，只读取公开内容 |

访客接口支持请求头：

```http
X-Visitor-Key: <visitor-id>
```

该值用于简单限流和区分会话来源。

## 3. 数据库存储

AI 功能使用以下表：

| 表名 | 作用 |
| --- | --- |
| `ai_conversations` | 保存 AI 会话 |
| `ai_messages` | 保存用户与 AI 消息 |
| `ai_uploaded_files` | 保存上传文件解析后的文本 |
| `ai_generations` | 保存 AI 生成、分析、保存状态 |

生成文章或作品后，最终仍写入现有内容表：

| 表名 | 作用 |
| --- | --- |
| `contents` | 保存文章或作品主体 |
| `content_tags` | 保存文章或作品标签 |

## 4. 前端页面

### 4.1 后台 AI 页面

路径：

```text
/admin/ai
```

组件：

```text
code_src/client/src/components/AdminAiSuite.tsx
```

页面包含四个分区：

1. 后台问答
2. 文件解析
3. 生成内容
4. 内容分析

### 4.2 访客 AI 悬浮助手

组件：

```text
code_src/client/src/components/VisitorAiAssistant.tsx
```

已挂载到：

```text
code_src/client/src/layouts/BaseLayout.astro
```

文章详情页和作品详情页已增加：

```html
data-content-type
data-content-id
```

访客 AI 可以识别当前页面对应的文章或作品。

## 5. 环境变量

后端读取：

```text
code_src/server/.env
```

需要配置：

```env
DEEPSEEK_API_KEY="你的 DeepSeek Key"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
AI_MAX_CONTEXT_CHARS="12000"
AI_VISITOR_RATE_LIMIT="20"
AI_ADMIN_RATE_LIMIT="100"
```

说明：

- DeepSeek Key 只允许放在后端 `.env`。
- 前端不会直接接触 Key。
- 管理员和访客使用不同限流配置。

## 6. 安全边界

- 访客 AI 只能读取 `published` 状态内容。
- 访客 AI 不读取后台、草稿、归档、联系信息、管理员信息。
- 管理员 AI 需要登录 token。
- AI 生成内容不会自动发布，必须由管理员点击保存。
- 文件解析结果只在后台使用。

## 7. 已验证

已执行：

```powershell
npm run build
```

结果：

- 前端 Astro 检查通过。
- 前端构建通过。
- 后端 TypeScript 编译通过。

