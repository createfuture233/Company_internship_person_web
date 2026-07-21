import { BadRequestException, Body, Controller, Delete, Get, Headers, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsArray, IsIn, IsNotEmpty, IsOptional, MaxLength, ValidateNested } from 'class-validator'
import { randomBytes } from 'node:crypto'
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

@Controller('api')
export class AdminController {
  constructor(private readonly prisma: PrismaService, private readonly adminService: AdminService) {}

  @Get('admin/content')
  async adminContent(@Headers('authorization') authorization?: string) {
    await this.adminService.requireAdmin(authorization)
    return this.prisma.content.findMany({ include: { tags: true }, orderBy: { updatedAt: 'desc' } })
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
        publishedAt: data.status === ContentStatus.published ? new Date() : null,
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
        publishedAt: data.status === ContentStatus.published ? existing.publishedAt ?? new Date() : existing.publishedAt,
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
    const [articles, projects, comments, unreadMessages] = await Promise.all([
      this.prisma.content.count({ where: { type: ContentType.article } }),
      this.prisma.content.count({ where: { type: ContentType.project } }),
      this.prisma.comment.count({ where: { status: CommentStatus.visible } }),
      this.prisma.contactMessage.count({ where: { status: 'unread' } }),
    ])
    return { articles, projects, comments, unreadMessages }
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
    const item = await this.prisma.comment.update({ where: { id }, data: { status: data.status } })
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

  @Patch('admin/settings')
  async updateAdminSettings(@Headers('authorization') authorization: string | undefined, @Body() data: UpdateSettingsDto) {
    const admin = await this.adminService.requireAdmin(authorization)
    const settings = await this.prisma.$transaction(data.settings.map((item) => this.prisma.siteSetting.upsert({
      where: { key: item.key.trim() },
      update: { value: item.value.trim() },
      create: { key: item.key.trim(), value: item.value.trim() },
    })))
    await this.adminService.audit(admin.id, 'update_site_settings', 'site_setting', undefined, { keys: settings.map((item) => item.key) })
    return settings
  }
}