import { BadRequestException, Body, Controller, Delete, Get, Headers, NotFoundException, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Type } from 'class-transformer'
import { IsArray, IsIn, IsNotEmpty, IsOptional, MaxLength, ValidateNested } from 'class-validator'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { CommentStatus, ContentStatus, ContentType, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.module'
import { AdminService } from './admin.service'

type CommentSort = 'latest' | 'likes'

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

function newSlug(type: ContentType) {
  return type + '-' + Date.now() + '-' + randomBytes(3).toString('hex')
}

function nowIso() {
  return new Date().toISOString()
}

const allowedCoverMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
const allowedCoverExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg'])

function safeCoverExtension(file: { originalname?: string; mimetype?: string }) {
  const raw = extname(file.originalname ?? '').toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(raw)) return raw
  if (file.mimetype === 'image/png') return '.png'
  if (file.mimetype === 'image/jpeg') return '.jpg'
  if (file.mimetype === 'image/webp') return '.webp'
  if (file.mimetype === 'image/svg+xml') return '.svg'
  return '.png'
}

function uploadRoot() {
  const envUploadRoot = process.env.UPLOAD_ROOT?.trim()
  if (envUploadRoot) return envUploadRoot

  const cwd = process.cwd()
  if (existsSync(join(cwd, 'prisma')) || existsSync(join(cwd, 'src'))) {
    return join(cwd, '..', '..', 'uploads')
  }
  if (existsSync(join(cwd, 'client')) && existsSync(join(cwd, 'server'))) {
    return join(cwd, '..', 'uploads')
  }
  return join(cwd, 'uploads')
}

@Controller('api')
export class AdminController {
  constructor(private readonly prisma: PrismaService, private readonly adminService: AdminService) {}

  @Get('admin/content')
  async adminContent(@Headers('authorization') authorization?: string) {
    await this.adminService.requireAdmin(authorization)
    return this.prisma.content.findMany({ include: { tags: true }, orderBy: { updatedAt: 'desc' } })
  }

  @Post('admin/uploads/cover')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async uploadCover(
    @Headers('authorization') authorization: string | undefined,
    @UploadedFile() file: any,
    @Query('type') type: ContentType = ContentType.article,
  ) {
    const admin = await this.adminService.requireAdmin(authorization)
    if (!file) throw new BadRequestException('Cover file is required')
    if (!allowedCoverMimeTypes.has(file.mimetype)) throw new BadRequestException('Only png, jpg, webp or svg images are allowed')
    if (!['article', 'project'].includes(type)) throw new BadRequestException('type must be article or project')

    const folder = type === ContentType.project ? 'projects' : 'articles'
    const uploadDir = join(uploadRoot(), 'images', folder)
    mkdirSync(uploadDir, { recursive: true })
    const filename = `${type}-cover-${Date.now()}-${randomBytes(4).toString('hex')}${safeCoverExtension(file)}`
    const target = join(uploadDir, filename)
    writeFileSync(target, file.buffer)
    const url = `/uploads/images/${folder}/${filename}`
    await this.adminService.audit(admin.id, 'upload_cover', 'asset', filename, { type, url })
    return { url }
  }

  @Get('admin/uploads/covers')
  async listUploadedCovers(
    @Headers('authorization') authorization: string | undefined,
    @Query('type') type: ContentType = ContentType.article,
  ) {
    await this.adminService.requireAdmin(authorization)
    if (!['article', 'project'].includes(type)) throw new BadRequestException('type must be article or project')

    const folder = type === ContentType.project ? 'projects' : 'articles'
    const uploadDir = join(uploadRoot(), 'images', folder)
    if (!existsSync(uploadDir)) return { urls: [] }

    const urls = readdirSync(uploadDir)
      .filter((filename) => allowedCoverExtensions.has(extname(filename).toLowerCase()))
      .map((filename) => {
        const fullPath = join(uploadDir, filename)
        return { filename, updatedAt: statSync(fullPath).mtimeMs }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((item) => `/uploads/images/${folder}/${item.filename}`)

    return { urls }
  }

  @Post('admin/content')
  async createContent(@Headers('authorization') authorization: string | undefined, @Body() data: CreateContentDto) {
    const admin = await this.adminService.requireAdmin(authorization)
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
        publishedAt: data.status === ContentStatus.published ? nowIso() : null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        tags: { create: tags.map((name) => ({ name })) },
      },
      include: { tags: true },
    })
    await this.adminService.audit(admin.id, 'create_content', 'content', item.id, { type: item.type, title: item.title })
    return item
  }

  @Patch('admin/content/:type/:id')
  async updateContent(
    @Headers('authorization') authorization: string | undefined,
    @Param('type') type: ContentType,
    @Param('id') id: string,
    @Body() data: UpdateContentDto,
  ) {
    const admin = await this.adminService.requireAdmin(authorization)
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
        publishedAt: data.status === ContentStatus.published ? existing.publishedAt ?? nowIso() : existing.publishedAt,
        updatedAt: nowIso(),
        tags: { deleteMany: {}, create: tags.map((name) => ({ name })) },
      },
      include: { tags: true },
    })
    await this.adminService.audit(admin.id, 'update_content', 'content', item.id, { title: item.title })
    return item
  }

  @Delete('admin/content/:type/:id')
  async deleteContent(
    @Headers('authorization') authorization: string | undefined,
    @Param('type') type: ContentType,
    @Param('id') id: string,
  ) {
    const admin = await this.adminService.requireAdmin(authorization)
    const item = await this.prisma.content.findFirst({ where: { id, type } })
    if (!item) throw new NotFoundException('Content not found')
    await this.prisma.content.delete({ where: { id } })
    await this.adminService.audit(admin.id, 'delete_content', 'content', id, { title: item.title })
    return { ok: true }
  }

  @Get('admin/overview')
  async adminOverview(@Headers('authorization') authorization?: string) {
    await this.adminService.requireAdmin(authorization)
    const [contents, comments, messages] = await Promise.all([
      this.prisma.content.findMany({
        select: { type: true, status: true, createdAt: true, updatedAt: true },
      }),
      this.prisma.comment.findMany({
        select: { status: true, likes: true, createdAt: true, content: { select: { type: true } } },
      }),
      this.prisma.contactMessage.findMany({
        select: { status: true, createdAt: true },
      }),
    ])

    const contentStatus = { draft: 0, published: 0, archived: 0 }
    const contentTypes = { article: 0, project: 0 }
    for (const item of contents) {
      contentTypes[item.type] += 1
      contentStatus[item.status] += 1
    }

    const commentStatus = { visible: 0, hidden: 0, spam: 0 }
    const commentByContent = { article: 0, project: 0 }
    let totalLikes = 0
    for (const item of comments) {
      commentStatus[item.status] += 1
      commentByContent[item.content.type] += 1
      totalLikes += item.likes
    }

    const messageStatus = { unread: 0, read: 0, replied: 0, archived: 0 }
    for (const item of messages) {
      if (item.status in messageStatus) messageStatus[item.status as keyof typeof messageStatus] += 1
    }

    const dayKeys = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - (6 - index))
      return date.toISOString().slice(0, 10)
    })
    const trend = dayKeys.map((date) => ({ date, contents: 0, comments: 0, messages: 0 }))
    const addTrend = (value: string | null | undefined, key: 'contents' | 'comments' | 'messages') => {
      if (!value) return
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return
      const day = date.toISOString().slice(0, 10)
      const bucket = trend.find((item) => item.date === day)
      if (bucket) bucket[key] += 1
    }
    contents.forEach((item) => addTrend(item.createdAt, 'contents'))
    comments.forEach((item) => addTrend(item.createdAt, 'comments'))
    messages.forEach((item) => addTrend(item.createdAt, 'messages'))

    const totalInteractions = comments.length + messages.length
    const responseRate = messages.length ? Math.round(((messages.length - messageStatus.unread) / messages.length) * 100) : 0

    return {
      articles: contentTypes.article,
      projects: contentTypes.project,
      comments: commentStatus.visible,
      unreadMessages: messageStatus.unread,
      totals: {
        contents: contents.length,
        comments: comments.length,
        messages: messages.length,
        interactions: totalInteractions,
        likes: totalLikes,
      },
      contentStatus,
      contentTypes,
      commentStatus,
      commentByContent,
      messageStatus,
      trend,
      insights: {
        responseRate,
        averageLikes: comments.length ? Number((totalLikes / comments.length).toFixed(1)) : 0,
        publishedRate: contents.length ? Math.round((contentStatus.published / contents.length) * 100) : 0,
      },
    }
  }

  @Get('admin/comments')
  async adminComments(
    @Headers('authorization') authorization: string | undefined,
    @Query('status') status?: CommentStatus,
    @Query('contentType') contentType?: ContentType,
    @Query('contentId') contentId?: string,
    @Query('sort') sort: CommentSort = 'latest',
  ) {
    await this.adminService.requireAdmin(authorization)
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
  async updateAdminComment(@Headers('authorization') authorization: string | undefined, @Param('id') id: string, @Body() data: UpdateCommentStatusDto) {
    const admin = await this.adminService.requireAdmin(authorization)
    const item = await this.prisma.comment.update({ where: { id }, data: { status: data.status, updatedAt: nowIso() } })
    await this.adminService.audit(admin.id, 'update_comment_status', 'comment', id, { status: data.status })
    return item
  }

  @Delete('admin/comments/:id')
  async deleteAdminComment(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const admin = await this.adminService.requireAdmin(authorization)
    await this.prisma.comment.delete({ where: { id } })
    await this.adminService.audit(admin.id, 'delete_comment', 'comment', id)
    return { ok: true }
  }

  @Get('admin/messages')
  async adminMessages(@Headers('authorization') authorization: string | undefined, @Query('status') status?: string) {
    await this.adminService.requireAdmin(authorization)
    return this.prisma.contactMessage.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' } })
  }

  @Patch('admin/messages/:id')
  async updateAdminMessage(@Headers('authorization') authorization: string | undefined, @Param('id') id: string, @Body() data: UpdateMessageStatusDto) {
    const admin = await this.adminService.requireAdmin(authorization)
    const item = await this.prisma.contactMessage.update({ where: { id: Number(id) }, data: { status: data.status } })
    await this.adminService.audit(admin.id, 'update_contact_status', 'contact_message', id, { status: data.status })
    return item
  }

  @Delete('admin/messages/:id')
  async deleteAdminMessage(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const admin = await this.adminService.requireAdmin(authorization)
    await this.prisma.contactMessage.delete({ where: { id: Number(id) } })
    await this.adminService.audit(admin.id, 'delete_contact_message', 'contact_message', id)
    return { ok: true }
  }

  @Get('admin/settings')
  async adminSettings(@Headers('authorization') authorization?: string) {
    await this.adminService.requireAdmin(authorization)
    return this.prisma.siteSetting.findMany({ orderBy: { key: 'asc' } })
  }

  @Get('settings')
  async publicSettings() {
    const settings = await this.prisma.siteSetting.findMany({ orderBy: { key: 'asc' } })
    return Object.fromEntries(settings.map((item) => [item.key, item.value]))
  }

  @Patch('admin/settings')
  async updateAdminSettings(@Headers('authorization') authorization: string | undefined, @Body() data: UpdateSettingsDto) {
    const admin = await this.adminService.requireAdmin(authorization)
    const settings = await this.prisma.$transaction(data.settings.map((item) => this.prisma.siteSetting.upsert({
      where: { key: item.key.trim() },
      update: { value: item.value.trim(), updatedAt: nowIso() },
      create: { key: item.key.trim(), value: item.value.trim(), updatedAt: nowIso() },
    })))
    await this.adminService.audit(admin.id, 'update_site_settings', 'site_setting', undefined, { keys: settings.map((item) => item.key) })
    return settings
  }
}
