import { Controller, Get, NotFoundException, Param } from '@nestjs/common'
import { ContentStatus, ContentType } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.module'

@Controller('api')
export class ContentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('articles')
  articles() {
    return this.prisma.content.findMany({
      where: { type: ContentType.article, status: ContentStatus.published },
      include: { tags: true, _count: { select: { comments: true } } },
      orderBy: { publishedAt: 'desc' },
    })
  }

  @Get('projects')
  projects() {
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
}