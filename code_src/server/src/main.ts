import 'reflect-metadata'
import { config } from 'dotenv'
import { createHash, randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import * as bcrypt from 'bcrypt'
import {
  BadRequestException,
  Body,
  ConflictException,
  Delete,
  Controller,
  Get,
  Headers,
  Module,
  NotFoundException,
  OnModuleInit,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { IsArray, IsEmail, IsIn, IsNotEmpty, IsOptional, MaxLength, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { CommentStatus, ContentStatus, ContentType, Prisma } from '@prisma/client'
import { PrismaModule, PrismaService } from './prisma/prisma.module'
import { AiModule } from './modules/ai/ai.module'
import { AiService } from './modules/ai/ai.service'

config({ path: resolve(process.cwd(), 'server/.env') })
config({ path: resolve(process.cwd(), '.env') })

type CommentSort = 'latest' | 'likes'

class ContactDto {
  @IsNotEmpty() @MaxLength(60) name!: string
  @IsEmail() email!: string
  @IsNotEmpty() @MaxLength(2000) message!: string
}

class SubscribeDto {
  @IsEmail() email!: string
}

class CreateCommentDto {
  @IsIn(['article', 'project']) contentType!: ContentType
  @IsNotEmpty() @MaxLength(80) contentId!: string
  @IsNotEmpty() @MaxLength(30) name!: string
  @IsNotEmpty() @MaxLength(600) content!: string
}

class LoginDto {
  @IsNotEmpty() @MaxLength(60) username!: string
  @IsNotEmpty() @MaxLength(120) password!: string
}

class ContentFieldsDto {
  @IsNotEmpty() @MaxLength(120) title!: string
  @IsNotEmpty() @MaxLength(500) summary!: string
  @IsNotEmpty() @MaxLength(5000) body!: string
  @IsOptional() @MaxLength(2000) coverUrl?: string
  @IsOptional() @MaxLength(500) stack?: string
  @IsIn(['draft', 'published', 'archived']) status!: ContentStatus
  @IsArray() @IsOptional() @MaxLength(30, { each: true }) tags?: string[]
}

class CreateContentDto extends ContentFieldsDto {
  @IsIn(['article', 'project']) type!: ContentType
}

class UpdateContentDto extends ContentFieldsDto {}
class UpdateCommentStatusDto {
  @IsIn(['visible', 'hidden', 'spam']) status!: CommentStatus
}

class UpdateMessageStatusDto {
  @IsIn(['unread', 'read', 'replied', 'archived']) status!: string
}

class SettingItemDto {
  @IsNotEmpty() @MaxLength(100) key!: string
  @MaxLength(5000) value!: string
}

class UpdateSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingItemDto)
  settings!: SettingItemDto[]
}

const initialContents = [
  {
    id: '1',
    type: ContentType.article,
    slug: 'personal-planet-plan',
    title: '从灵感到上线：我的个人网站规划',
    summary: '把模糊的想法拆成可执行的页面、内容和技术选择。',
    body: '一个想法真正开始成形，往往不是在写下结论的时候，而是在不断追问它要为谁解决什么问题的过程中。记录真实的使用情境、限制条件与希望达成的体验，能让创作在持续迭代中保持清晰。',
  },
  {
    id: '2',
    type: ContentType.article,
    slug: 'breathing-web-background',
    title: '为网页加入有呼吸感的动态背景',
    summary: '记录手绘风动效与性能之间的平衡方法。',
    body: '动态效果应该服务于内容阅读，而不是抢走注意力。通过降低运动幅度、控制触发时机和尊重系统减弱动效设置，可以让页面拥有呼吸感。',
  },
  {
    id: '3',
    type: ContentType.article,
    slug: 'requirements-to-product',
    title: '用需求文档让创意落地',
    summary: '从用户场景、交互到验收标准的一次实践。',
    body: '需求文档的价值在于把抽象期待转为可验证的约定。先说明用户要完成什么，再说明页面如何反馈，最后补上可以验收的结果。',
  },
  {
    id: 'personal-planet',
    type: ContentType.project,
    slug: 'personal-planet',
    title: '个人星球',
    summary: '一座记录作品、思考与成长的数字花园。',
    body: '这个项目关注如何把信息、交互与视觉氛围组织成一个连贯的体验，并在持续迭代中保留可维护性。',
    stack: 'Astro · React · NestJS',
  },
  {
    id: 'data-atlas',
    type: ContentType.project,
    slug: 'data-atlas',
    title: '数据漫游图鉴',
    summary: '将日常数据转化为可探索的叙事地图。',
    body: '项目从数据的采集、结构整理到视觉编码出发，尝试让原本抽象的数字成为可以探索、比较和讲述的故事。',
    stack: 'TypeScript · Canvas',
  },
]

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function readToken(authorization?: string) {
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
}

function newSlug(type: ContentType) {
  return type + '-' + Date.now() + '-' + randomBytes(3).toString('hex')
}

@Controller('api')
class AppController implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly aiService: AiService) {}

  async onModuleInit() {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_INITIAL_PASSWORD ?? '123456', 12)
    await this.prisma.admin.upsert({
      where: { username: 'admin' },
      update: {},
      create: { username: 'admin', passwordHash, role: 'admin' },
    })

    for (const item of initialContents) {
      await this.prisma.content.upsert({
        where: { id: item.id },
        update: {},
        create: {
          ...item,
          status: ContentStatus.published,
          publishedAt: new Date(),
        },
      })
    }

    const commentSeeds = [
      { id: 'comment-article-1', contentId: '1', nickname: 'Nova', avatarText: 'N', body: '把个人网站做成长期记录的想法很有启发。', likes: 12 },
      { id: 'comment-article-1-2', contentId: '1', nickname: 'Mika', avatarText: 'M', body: '期待下一篇开发日志。', likes: 5 },
      { id: 'comment-project-personal-planet', contentId: 'personal-planet', nickname: 'Orbit', avatarText: 'O', body: '视觉系统和交互方向都很清晰。', likes: 9 },
    ]

    for (const comment of commentSeeds) {
      await this.prisma.comment.upsert({
        where: { id: comment.id },
        update: {},
        create: { ...comment, status: CommentStatus.visible },
      })
    }
  }

  private async requireAdmin(authorization?: string) {
    const token = readToken(authorization)
    const session = await this.prisma.adminSession.findFirst({
      where: {
        tokenHash: tokenHash(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { admin: true },
    })
    if (!session) throw new UnauthorizedException('管理员登录已失效，请重新登录。')
    return session.admin
  }

  private async audit(adminId: number, action: string, targetType: string, targetId?: string, payload?: object) {
    await this.prisma.auditLog.create({
      data: {
        adminId,
        action,
        targetType,
        targetId,
        payload: payload ? JSON.stringify(payload) : null,
      },
    })
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'personal-planet-api', database: 'sqlite' }
  }

  @Get('articles')
  async articles() {
    return this.prisma.content.findMany({
      where: { type: ContentType.article, status: ContentStatus.published },
      include: { tags: true, _count: { select: { comments: true } } },
      orderBy: { publishedAt: 'desc' },
    })
  }

  @Get('projects')
  async projects() {
    return this.prisma.content.findMany({
      where: { type: ContentType.project, status: ContentStatus.published },
      include: { tags: true, _count: { select: { comments: true } } },
      orderBy: { publishedAt: 'desc' },
    })
  }

  @Get('content/:type/:id')
  async getContent(@Param('type') type: ContentType, @Param('id') id: string) {
    const item = await this.prisma.content.findFirst({
      where: { type, status: ContentStatus.published, OR: [{ id }, { slug: id }] },
      include: { tags: true },
    })
    if (!item) throw new NotFoundException('Content not found')
    return item
  }

  @Post('auth/login')
  async login(@Body() data: LoginDto) {
    const admin = await this.prisma.admin.findUnique({ where: { username: data.username } })
    if (!admin || !(await bcrypt.compare(data.password, admin.passwordHash))) {
      throw new UnauthorizedException('账号或密码错误。')
    }

    const token = randomBytes(36).toString('base64url')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
    await this.prisma.adminSession.create({
      data: { adminId: admin.id, tokenHash: tokenHash(token), expiresAt },
    })
    await this.audit(admin.id, 'login', 'admin', String(admin.id))
    return { token, username: admin.username, expiresAt }
  }

  @Post('auth/logout')
  async logout(@Headers('authorization') authorization?: string) {
    const token = readToken(authorization)
    if (token) {
      await this.prisma.adminSession.updateMany({
        where: { tokenHash: tokenHash(token), revokedAt: null },
        data: { revokedAt: new Date() },
      })
    }
    return { ok: true }
  }

  @Get('admin/ai/config')
  async adminAiConfig(@Headers('authorization') authorization?: string) {
    await this.requireAdmin(authorization)
    return this.aiService.getStatus()
  }
  @Get('admin/content')
  async adminContent(@Headers('authorization') authorization?: string) {
    await this.requireAdmin(authorization)
    return this.prisma.content.findMany({ include: { tags: true }, orderBy: { updatedAt: 'desc' } })
  }

  @Post('admin/content')
  async createContent(
    @Headers('authorization') authorization: string | undefined,
    @Body() data: CreateContentDto,
  ) {
    const admin = await this.requireAdmin(authorization)
    const slug = newSlug(data.type)
    const tags = [...new Set((data.tags ?? []).map((tag) => tag.trim()).filter(Boolean))]
    const item = await this.prisma.content.create({
      data: {
        type: data.type,
        slug,
        title: data.title.trim(),
        summary: data.summary.trim(),
        body: data.body.trim(),
        coverUrl: data.coverUrl?.trim() || null,
        stack: data.type === ContentType.project ? data.stack?.trim() || null : null,
        status: data.status,
        publishedAt: data.status === ContentStatus.published ? new Date() : null,
        tags: { create: tags.map((name) => ({ name })) },
      },
      include: { tags: true },
    })
    await this.audit(admin.id, 'create_content', 'content', item.id, { type: item.type, title: item.title })
    return item
  }

  @Patch('admin/content/:type/:id')
  async updateContent(
    @Headers('authorization') authorization: string | undefined,
    @Param('type') type: ContentType,
    @Param('id') id: string,
    @Body() data: UpdateContentDto,
  ) {
    const admin = await this.requireAdmin(authorization)
    const existing = await this.prisma.content.findFirst({ where: { id, type } })
    if (!existing) throw new NotFoundException('Content not found')
    const tags = [...new Set((data.tags ?? []).map((tag) => tag.trim()).filter(Boolean))]
    const item = await this.prisma.content.update({
      where: { id },
      data: {
        title: data.title.trim(),
        summary: data.summary.trim(),
        body: data.body.trim(),
        coverUrl: data.coverUrl?.trim() || null,
        stack: type === ContentType.project ? data.stack?.trim() || null : null,
        status: data.status,
        publishedAt: data.status === ContentStatus.published ? existing.publishedAt ?? new Date() : existing.publishedAt,
        tags: { deleteMany: {}, create: tags.map((name) => ({ name })) },
      },
      include: { tags: true },
    })
    await this.audit(admin.id, 'update_content', 'content', item.id, { title: item.title })
    return item
  }

  @Get('admin/overview')
  async adminOverview(@Headers('authorization') authorization?: string) {
    await this.requireAdmin(authorization)
    const [articles, projects, comments, unreadMessages] = await Promise.all([
      this.prisma.content.count({ where: { type: ContentType.article } }),
      this.prisma.content.count({ where: { type: ContentType.project } }),
      this.prisma.comment.count({ where: { status: CommentStatus.visible } }),
      this.prisma.contactMessage.count({ where: { status: 'unread' } }),
    ])
    return { articles, projects, comments, unreadMessages }
  }

  @Delete('admin/content/:type/:id')
  async deleteContent(
    @Headers('authorization') authorization: string | undefined,
    @Param('type') type: ContentType,
    @Param('id') id: string,
  ) {
    const admin = await this.requireAdmin(authorization)
    const item = await this.prisma.content.findFirst({ where: { id, type } })
    if (!item) throw new NotFoundException('Content not found')
    await this.prisma.content.delete({ where: { id } })
    await this.audit(admin.id, 'delete_content', 'content', id, { title: item.title })
    return { ok: true }
  }

  @Get('admin/comments')
  async adminComments(
    @Headers('authorization') authorization: string | undefined,
    @Query('status') status?: CommentStatus,
    @Query('contentType') contentType?: ContentType,
    @Query('contentId') contentId?: string,
    @Query('sort') sort: CommentSort = 'latest',
  ) {
    await this.requireAdmin(authorization)
    const where: Prisma.CommentWhereInput = {}
    if (status && ['visible', 'hidden', 'spam'].includes(status)) where.status = status
    if (contentType && ['article', 'project'].includes(contentType)) where.content = { type: contentType }
    if (contentId?.trim()) where.contentId = contentId.trim()
    if (!['latest', 'likes'].includes(sort)) throw new BadRequestException('sort must be latest or likes')
    return this.prisma.comment.findMany({
      where,
      include: { content: { select: { title: true, type: true } } },
      orderBy: sort === 'likes' ? [{ likes: 'desc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
    })
  }

  @Patch('admin/comments/:id')
  async updateAdminComment(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() data: UpdateCommentStatusDto,
  ) {
    const admin = await this.requireAdmin(authorization)
    const item = await this.prisma.comment.update({ where: { id }, data: { status: data.status } })
    await this.audit(admin.id, 'update_comment_status', 'comment', id, { status: data.status })
    return item
  }

  @Delete('admin/comments/:id')
  async deleteAdminComment(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const admin = await this.requireAdmin(authorization)
    await this.prisma.comment.delete({ where: { id } })
    await this.audit(admin.id, 'delete_comment', 'comment', id)
    return { ok: true }
  }

  @Get('admin/messages')
  async adminMessages(
    @Headers('authorization') authorization: string | undefined,
    @Query('status') status?: string,
  ) {
    await this.requireAdmin(authorization)
    return this.prisma.contactMessage.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    })
  }

  @Patch('admin/messages/:id')
  async updateAdminMessage(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() data: UpdateMessageStatusDto,
  ) {
    const admin = await this.requireAdmin(authorization)
    const item = await this.prisma.contactMessage.update({ where: { id: Number(id) }, data: { status: data.status } })
    await this.audit(admin.id, 'update_contact_status', 'contact_message', id, { status: data.status })
    return item
  }

  @Delete('admin/messages/:id')
  async deleteAdminMessage(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const admin = await this.requireAdmin(authorization)
    await this.prisma.contactMessage.delete({ where: { id: Number(id) } })
    await this.audit(admin.id, 'delete_contact_message', 'contact_message', id)
    return { ok: true }
  }

  @Get('admin/settings')
  async adminSettings(@Headers('authorization') authorization?: string) {
    await this.requireAdmin(authorization)
    return this.prisma.siteSetting.findMany({ orderBy: { key: 'asc' } })
  }

  @Patch('admin/settings')
  async updateAdminSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() data: UpdateSettingsDto,
  ) {
    const admin = await this.requireAdmin(authorization)
    const settings = await this.prisma.$transaction(data.settings.map((item) => this.prisma.siteSetting.upsert({
      where: { key: item.key.trim() },
      update: { value: item.value.trim() },
      create: { key: item.key.trim(), value: item.value.trim() },
    })))
    await this.audit(admin.id, 'update_site_settings', 'site_setting', undefined, { keys: settings.map((item) => item.key) })
    return settings
  }
  @Get('comments')
  async getComments(
    @Query('contentType') contentType: ContentType,
    @Query('contentId') contentId: string,
    @Query('sort') sort: CommentSort = 'latest',
  ) {
    if (!['article', 'project'].includes(contentType) || !contentId) {
      throw new BadRequestException('contentType and contentId are required')
    }
    if (!['latest', 'likes'].includes(sort)) {
      throw new BadRequestException('sort must be latest or likes')
    }

    const validContent = await this.prisma.content.findFirst({
      where: { id: contentId, type: contentType },
      select: { id: true },
    })
    if (!validContent) throw new NotFoundException('Content not found')

    const comments = await this.prisma.comment.findMany({
      where: { contentId, status: CommentStatus.visible },
      orderBy: sort === 'likes' ? [{ likes: 'desc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
    })

    return {
      items: comments.map((comment) => ({
        id: comment.id,
        name: comment.nickname,
        avatar: comment.avatarText,
        content: comment.body,
        likes: comment.likes,
        createdAt: comment.createdAt,
      })),
      total: comments.length,
      sort,
    }
  }

  @Post('comments')
  async createComment(@Body() data: CreateCommentDto) {
    const content = await this.prisma.content.findFirst({
      where: { id: data.contentId, type: data.contentType, status: ContentStatus.published },
      select: { id: true },
    })
    if (!content) throw new NotFoundException('Content not found')

    const comment = await this.prisma.comment.create({
      data: {
        contentId: data.contentId,
        nickname: data.name.trim(),
        avatarText: data.name.trim().slice(0, 2).toUpperCase(),
        body: data.content.trim(),
      },
    })
    return {
      id: comment.id,
      name: comment.nickname,
      avatar: comment.avatarText,
      content: comment.body,
      likes: comment.likes,
      createdAt: comment.createdAt,
    }
  }

  @Post('comments/:id/like')
  async likeComment(
    @Param('id') id: string,
    @Headers('x-visitor-key') visitorKeyHeader?: string,
  ) {
    const visitorKey = visitorKeyHeader?.trim()
    if (!visitorKey || visitorKey.length > 100) {
      throw new BadRequestException('缺少有效的访客标识。')
    }

    try {
      const comment = await this.prisma.$transaction(async (tx) => {
        await tx.commentLike.create({ data: { commentId: id, visitorKey } })
        return tx.comment.update({ where: { id }, data: { likes: { increment: 1 } } })
      })
      return { id: comment.id, likes: comment.likes }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('你已经为这条评论点赞。')
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException('Comment not found')
      }
      throw error
    }
  }

  @Post('contact')
  async contact(@Body() data: ContactDto) {
    const message = await this.prisma.contactMessage.create({
      data: { name: data.name.trim(), email: data.email.toLowerCase(), message: data.message.trim() },
    })
    return { ok: true, id: message.id, message: '消息已收到。' }
  }

  @Post('subscriptions')
  async subscribe(@Body() data: SubscribeDto) {
    const email = data.email.toLowerCase()
    const subscription = await this.prisma.subscription.upsert({
      where: { email },
      update: {},
      create: { email },
    })
    return { ok: true, email: subscription.email }
  }
}

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [AppController],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({
    origin: ['http://localhost:4321', 'http://localhost:5173'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Visitor-Key'],
  })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  await app.listen(process.env.PORT ?? 3000)
}

bootstrap()