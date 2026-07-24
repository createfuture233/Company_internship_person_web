/**
 * 内容控制器
 * 提供公开内容的获取接口（文章列表、作品列表、内容详情）
 */
import { Controller, Get, NotFoundException, Param } from '@nestjs/common'
import { ContentStatus, ContentType } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.module'

@Controller('api')
export class ContentController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取已发布的文章列表
   * @returns 文章列表（包含标签和评论数）
   */
  @Get('articles')
  articles() {
    return this.prisma.content.findMany({
      where: { type: ContentType.article, status: ContentStatus.published },
      include: { tags: true, _count: { select: { comments: true } } },
      orderBy: { publishedAt: 'desc' },
    })
  }

  /**
   * 获取已发布的作品列表
   * @returns 作品列表（包含标签和评论数）
   */
  @Get('projects')
  projects() {
    return this.prisma.content.findMany({
      where: { type: ContentType.project, status: ContentStatus.published },
      include: { tags: true, _count: { select: { comments: true } } },
      orderBy: { publishedAt: 'desc' },
    })
  }

  /**
   * 获取内容详情（文章或作品）
   * @param type - 内容类型（article/project）
   * @param id - 内容ID或slug
   * @returns 内容详情
   */
  @Get('content/:type/:id')
  async getContent(@Param('type') type: ContentType, @Param('id') id: string) {
    const item = await this.prisma.content.findFirst({
      where: { type, status: ContentStatus.published, OR: [{ id }, { slug: id }] },
      include: { tags: true },
    })
    if (!item) throw new NotFoundException('Content not found')
    return item
  }
}