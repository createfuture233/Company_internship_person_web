# 个人星球 SQLite 数据库设计与建库说明

> 适用项目：个人星球（Astro + React + NestJS）  
> 建议方案：SQLite + Prisma ORM  
> 文档日期：2026-07-20

## 1. 目标与范围

当前项目中的文章、作品、评论、管理员会话等数据暂存于 NestJS 服务内存。服务重启后数据会丢失，也无法可靠支持内容新增与后台管理。

本方案将以下数据写入 SQLite 数据库文件：

- 管理员账号与登录会话。
- 网站文章和作品内容。
- 文章/作品的标签、封面和发布状态。
- 评论、评论点赞与访客标识。
- 联系表单消息、订阅邮箱。
- 管理员内容修改审计日志。
- 网站可配置的基础信息。

SQLite 适合当前单管理员、低并发的个人网站：无需额外部署数据库服务器，数据保存在一个文件中。未来需要多管理员、高并发评论或多实例部署时，可按 Prisma 模型迁移至 PostgreSQL。

## 2. 推荐目录结构

~~~text
code_src/server/
├── prisma/
│   ├── schema.prisma              Prisma 数据模型
│   ├── migrations/                自动生成的迁移记录
│   └── seed.ts                    初始管理员和演示数据
├── data/
│   └── personal-planet.db         SQLite 数据库文件（不提交到 Git）
├── src/
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── auth/
│   ├── contents/
│   ├── comments/
│   └── main.ts
└── .env                           数据库连接配置（不提交到 Git）
~~~

建议在 server/.gitignore 或 code_src/.gitignore 中确保包含：

~~~gitignore
data/*.db
data/*.db-journal
data/*.db-wal
data/*.db-shm
.env
.env.*
!.env.example
~~~

## 3. 需要持久化的数据表

| 表名 | 用途 | 主要字段 |
| --- | --- | --- |
| admins | 管理员账号 | username、password_hash、role |
| admin_sessions | 登录会话或刷新令牌 | token_hash、expires_at、revoked_at |
| contents | 文章和作品统一内容表 | type、slug、title、summary、body、status |
| content_tags | 内容标签 | content_id、name |
| comments | 文章/作品评论 | content_id、nickname、avatar_text、body、likes |
| comment_likes | 防止同一访客重复点赞 | comment_id、visitor_key |
| contact_messages | 联系表单消息 | name、email、message、status |
| subscriptions | 订阅邮箱 | email、confirmed_at |
| site_settings | 网站可配置字段 | key、value |
| audit_logs | 管理员修改记录 | admin_id、action、target_type、target_id |

### 3.1 表关系

~~~text
admins 1 ─── N admin_sessions
admins 1 ─── N audit_logs

contents 1 ─── N content_tags
contents 1 ─── N comments

comments 1 ─── N comment_likes
~~~

文章和作品共用 contents 表，通过 type 字段区分：

- article：文章。
- project：作品。

这样管理员编辑、查询、标签和评论可以复用同一套接口。


## 3.2 字段字典

通用约定：

- id：主键，用于唯一定位一条记录。
- created_at / createdAt：记录创建时间。
- updated_at / updatedAt：记录最后一次修改时间。
- 外键：指向另一张表的主键，保证关联数据有效；删除父记录时，相关子记录可按级联规则一并删除。
- SQLite 中时间可以使用 ISO 8601 字符串保存；Prisma 的 DateTime 字段会负责类型转换。

### admins：管理员账号表

| 字段 | 类型 | 含义与约束 |
| --- | --- | --- |
| id | INTEGER | 管理员自增主键。内部关联管理员会话、审计日志时使用。 |
| username | TEXT | 登录账号，例如 admin。必须唯一，不能为空。 |
| password_hash | TEXT | 密码哈希值，不保存明文密码。使用 bcrypt 生成和校验。 |
| role | TEXT | 管理员角色。当前可固定为 admin，为将来的 editor、reviewer 等角色预留。 |
| created_at | TEXT / DateTime | 管理员账号创建时间。 |
| updated_at | TEXT / DateTime | 管理员账号最后修改时间，例如更换密码时更新。 |

### admin_sessions：管理员会话表

| 字段 | 类型 | 含义与约束 |
| --- | --- | --- |
| id | INTEGER | 会话自增主键。 |
| admin_id | INTEGER | 所属管理员的 ID，外键关联 admins.id。 |
| token_hash | TEXT | 登录令牌或刷新令牌的哈希值。数据库不保存原始令牌，避免泄露后可直接冒用。必须唯一。 |
| expires_at | TEXT / DateTime | 会话过期时间。每次鉴权时必须检查是否已过期。 |
| revoked_at | TEXT / DateTime，可空 | 会话被主动退出或管理员强制失效的时间；为空表示尚未撤销。 |
| created_at | TEXT / DateTime | 本次登录会话创建时间。 |

### contents：文章与作品统一内容表

| 字段 | 类型 | 含义与约束 |
| --- | --- | --- |
| id | TEXT | 内容唯一 ID。推荐使用 Prisma CUID 或 UUID，供评论、标签和后台编辑关联。 |
| type | TEXT / Enum | 内容类型，只能是 article 或 project。article 表示文章，project 表示作品。 |
| slug | TEXT | URL 友好标识，例如 personal-planet。必须唯一，用于详情页地址。 |
| title | TEXT | 文章或作品标题，不能为空。 |
| summary | TEXT | 摘要或项目简介，用于列表卡片和详情页导语。 |
| body | TEXT | 详情正文。初期可存 Markdown 或纯文本；以后可存富文本 JSON。 |
| cover_url | TEXT，可空 | 封面图地址。没有封面时允许为空。 |
| stack | TEXT，可空 | 作品使用的技术栈，例如 Astro、React、NestJS；文章通常为空。 |
| status | TEXT / Enum | 内容状态，只能是 draft、published、archived。草稿不应被公开 API 返回。 |
| published_at | TEXT / DateTime，可空 | 首次公开发布时间。草稿阶段为空；用于按时间排序。 |
| created_at | TEXT / DateTime | 内容创建时间。 |
| updated_at | TEXT / DateTime | 内容最后编辑时间。 |

### content_tags：内容标签表

| 字段 | 类型 | 含义与约束 |
| --- | --- | --- |
| id | INTEGER | 标签关联记录的自增主键。 |
| content_id | TEXT | 所属内容 ID，外键关联 contents.id。 |
| name | TEXT | 标签名称，例如 前端、随笔、设计。 |
| content_id + name | 联合唯一约束 | 同一篇文章或作品不能重复拥有相同标签。 |

### comments：评论表

| 字段 | 类型 | 含义与约束 |
| --- | --- | --- |
| id | TEXT | 评论唯一 ID，供点赞、排序和前端列表 key 使用。 |
| content_id | TEXT | 评论所属的文章或作品 ID，外键关联 contents.id。 |
| nickname | TEXT | 评论者填写的显示名称，不能为空。 |
| avatar_text | TEXT | 默认头像显示文字，通常取昵称前一到两个字符。 |
| body | TEXT | 评论正文，不能为空；后端应限制长度并进行内容审核。 |
| likes | INTEGER | 缓存后的点赞总数，默认 0，不能小于 0。 |
| status | TEXT / Enum | 评论状态：visible 为可见，hidden 为人工隐藏，spam 为垃圾评论。 |
| created_at | TEXT / DateTime | 评论发布时间；“最新排序”使用该字段倒序排列。 |
| updated_at | TEXT / DateTime | 评论编辑或审核状态变更时间。 |

### comment_likes：评论点赞记录表

| 字段 | 类型 | 含义与约束 |
| --- | --- | --- |
| id | INTEGER | 点赞记录自增主键。 |
| comment_id | TEXT | 被点赞评论的 ID，外键关联 comments.id。 |
| visitor_key | TEXT | 匿名访客标识。可使用随机 UUID 写入浏览器 localStorage，避免直接保存 IP。 |
| created_at | TEXT / DateTime | 点赞发生时间。 |
| comment_id + visitor_key | 联合唯一约束 | 同一访客对同一评论只能点赞一次。 |

### contact_messages：联系表单消息表

| 字段 | 类型 | 含义与约束 |
| --- | --- | --- |
| id | INTEGER | 联系消息自增主键。 |
| name | TEXT | 提交人的姓名或称呼。 |
| email | TEXT | 提交人的邮箱。后端需要校验格式。 |
| message | TEXT | 联系内容。 |
| status | TEXT | 处理状态，例如 unread、read、replied。 |
| created_at | TEXT / DateTime | 消息提交时间。 |

### subscriptions：订阅邮箱表

| 字段 | 类型 | 含义与约束 |
| --- | --- | --- |
| id | INTEGER | 订阅记录自增主键。 |
| email | TEXT | 订阅邮箱，必须唯一，避免重复订阅。 |
| confirmed_at | TEXT / DateTime，可空 | 邮箱完成确认的时间；为空时表示尚未确认。 |
| created_at | TEXT / DateTime | 用户提交订阅的时间。 |

### site_settings：网站设置表

| 字段 | 类型 | 含义与约束 |
| --- | --- | --- |
| key | TEXT | 设置项名称，也是主键，例如 site_title、github_url、default_theme。 |
| value | TEXT | 设置项对应的值。简单配置可存文本；复杂对象可存 JSON 字符串。 |
| updated_at | TEXT / DateTime | 设置项最近更新时间。 |

### audit_logs：管理员审计日志表

| 字段 | 类型 | 含义与约束 |
| --- | --- | --- |
| id | INTEGER | 日志自增主键。 |
| admin_id | INTEGER | 执行操作的管理员 ID，外键关联 admins.id。 |
| action | TEXT | 操作类型，例如 create_content、update_content、hide_comment、login。 |
| target_type | TEXT | 被操作对象类型，例如 content、comment、setting。 |
| target_id | TEXT，可空 | 被操作对象的 ID；例如编辑文章时保存 contents.id。 |
| payload | TEXT，可空 | 操作前后摘要或额外信息，建议存 JSON 字符串，避免直接存放敏感信息。 |
| created_at | TEXT / DateTime | 操作发生时间，用于追踪和排查问题。 |
## 4. Prisma 安装与初始化

在 code_src 目录执行：

~~~powershell
npm install --workspace=server @prisma/client @prisma/adapter-better-sqlite3 better-sqlite3 dotenv
npm install --workspace=server --save-dev prisma @types/better-sqlite3
npx prisma init --datasource-provider sqlite --schema server/prisma/schema.prisma
~~~

在 code_src/server/.env 写入：

~~~env
DATABASE_URL="file:./data/personal-planet.db"
~~~

说明：

- SQLite 数据库文件会生成在 server/data/personal-planet.db。
- Prisma 负责生成迁移文件和类型安全数据库客户端。
- 当前 Prisma 官方 SQLite 指南使用 better-sqlite3 适配器连接本地 SQLite 文件。[Prisma SQLite Quickstart](https://docs.prisma.io/docs/prisma-orm/quickstart/sqlite)

## 5. Prisma 数据模型代码

创建 server/prisma/schema.prisma：

~~~prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum ContentType {
  article
  project
}

enum ContentStatus {
  draft
  published
  archived
}

enum CommentStatus {
  visible
  hidden
  spam
}

model Admin {
  id           Int            @id @default(autoincrement())
  username     String         @unique
  passwordHash String
  role         String         @default("admin")
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  sessions     AdminSession[]
  auditLogs    AuditLog[]
}

model AdminSession {
  id        Int       @id @default(autoincrement())
  adminId   Int
  tokenHash String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())
  admin     Admin     @relation(fields: [adminId], references: [id], onDelete: Cascade)

  @@index([adminId])
  @@index([expiresAt])
}

model Content {
  id          String          @id @default(cuid())
  type        ContentType
  slug        String          @unique
  title       String
  summary     String
  body        String
  coverUrl    String?
  stack       String?
  status      ContentStatus   @default(draft)
  publishedAt DateTime?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  tags        ContentTag[]
  comments    Comment[]

  @@index([type, status, publishedAt])
  @@index([updatedAt])
}

model ContentTag {
  id        Int     @id @default(autoincrement())
  contentId String
  name      String
  content   Content @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@unique([contentId, name])
  @@index([name])
}

model Comment {
  id         String        @id @default(cuid())
  contentId  String
  nickname   String
  avatarText String
  body       String
  likes      Int           @default(0)
  status     CommentStatus @default(visible)
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt
  content    Content       @relation(fields: [contentId], references: [id], onDelete: Cascade)
  likedBy    CommentLike[]

  @@index([contentId, createdAt])
  @@index([contentId, likes])
  @@index([status])
}

model CommentLike {
  id         Int      @id @default(autoincrement())
  commentId  String
  visitorKey String
  createdAt  DateTime @default(now())
  comment    Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)

  @@unique([commentId, visitorKey])
  @@index([visitorKey])
}

model ContactMessage {
  id        Int      @id @default(autoincrement())
  name      String
  email     String
  message   String
  status    String   @default("unread")
  createdAt DateTime @default(now())

  @@index([status, createdAt])
  @@index([email])
}

model Subscription {
  id          Int       @id @default(autoincrement())
  email       String    @unique
  confirmedAt DateTime?
  createdAt   DateTime  @default(now())
}

model SiteSetting {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
}

model AuditLog {
  id         Int      @id @default(autoincrement())
  adminId    Int
  action     String
  targetType String
  targetId   String?
  payload    String?
  createdAt  DateTime @default(now())
  admin      Admin    @relation(fields: [adminId], references: [id], onDelete: Cascade)

  @@index([adminId, createdAt])
  @@index([targetType, targetId])
}
~~~

## 6. 数据库迁移命令

首次创建数据库：

~~~powershell
cd D:Project_WorkSpaceVScode_workspaceCompany_internship_person_webcode_src
npx prisma migrate dev --schema server/prisma/schema.prisma --name init_sqlite
npx prisma generate --schema server/prisma/schema.prisma
~~~

后续每次修改模型后：

~~~powershell
npx prisma migrate dev --schema server/prisma/schema.prisma --name 描述本次修改
npx prisma generate --schema server/prisma/schema.prisma
~~~

生产部署使用：

~~~powershell
npx prisma migrate deploy --schema server/prisma/schema.prisma
~~~

## 7. 原生 SQLite 建表 SQL

如果暂时不使用 Prisma，也可执行以下 SQL 建表。执行前必须开启外键约束。

~~~sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE TABLE contents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('article', 'project')),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  cover_url TEXT,
  stack TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
  UNIQUE (content_id, name)
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar_text TEXT NOT NULL,
  body TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'spam')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE
);

CREATE TABLE comment_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id TEXT NOT NULL,
  visitor_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  UNIQUE (comment_id, visitor_key)
);

CREATE TABLE contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE INDEX idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);
CREATE INDEX idx_contents_type_status_date ON contents(type, status, published_at);
CREATE INDEX idx_contents_updated_at ON contents(updated_at);
CREATE INDEX idx_content_tags_name ON content_tags(name);
CREATE INDEX idx_comments_content_created ON comments(content_id, created_at DESC);
CREATE INDEX idx_comments_content_likes ON comments(content_id, likes DESC);
CREATE INDEX idx_comments_status ON comments(status);
CREATE INDEX idx_contact_messages_status_date ON contact_messages(status, created_at DESC);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
~~~

## 8. 初始管理员种子数据

不要把明文密码写入数据库。建议使用 bcrypt 生成密码哈希后写入 admins 表。

安装 bcrypt：

~~~powershell
npm install --workspace=server bcrypt
npm install --workspace=server --save-dev @types/bcrypt
~~~

创建 server/prisma/seed.ts：

~~~ts
import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash(process.env.ADMIN_INITIAL_PASSWORD ?? '123456', 12)

  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      role: 'admin',
    },
  })
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
~~~

执行种子数据：

~~~powershell
npx tsx server/prisma/seed.ts
~~~

开发环境可临时通过环境变量设置初始密码：

~~~env
ADMIN_INITIAL_PASSWORD="123456"
~~~

生产环境必须更换密码，并禁止将真实密码提交到 Git。

## 9. NestJS PrismaService 示例

创建 server/src/prisma/prisma.service.ts：

~~~ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
~~~

创建 server/src/prisma/prisma.module.ts：

~~~ts
import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
~~~

在内容服务中查询已发布文章示例：

~~~ts
const articles = await this.prisma.content.findMany({
  where: {
    type: 'article',
    status: 'published',
  },
  include: {
    tags: true,
    _count: { select: { comments: true } },
  },
  orderBy: {
    publishedAt: 'desc',
  },
})
~~~

## 10. 现有内存数据迁移顺序

1. 创建 Prisma 模型并执行首次迁移。
2. 在 seed.ts 中写入当前 3 篇文章、2 个作品和管理员账号。
3. 将 main.ts 中的 comments、contentItems、sessions 内存数组替换为 PrismaService 查询。
4. 登录成功后，将会话或刷新令牌写入 admin_sessions。
5. 创建、编辑文章/作品时写入 contents，并同时写入 audit_logs。
6. 评论发布写入 comments；点赞操作在事务中创建 comment_likes 并递增 comments.likes。
7. 将前端文章/作品列表改为从 API 获取动态数据，使新增内容可自动出现在公开列表。

## 11. 上线前检查清单

- 数据库文件和环境变量已加入 Git 忽略规则。
- 已启用 SQLite 外键约束。
- 已启用 WAL 日志模式，改善单机读写并发。
- 密码使用 bcrypt 哈希，不保存明文。
- 管理员登录令牌具有过期和撤销机制。
- 评论点赞使用唯一约束防止重复点赞。
- 已建立内容、评论排序和审计查询索引。
- 已建立数据库备份策略；定期备份 personal-planet.db。
- 若未来部署多个 API 实例，迁移到 PostgreSQL。