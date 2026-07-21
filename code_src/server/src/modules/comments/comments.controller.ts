import { BadRequestException, Body, ConflictException, Controller, Get, Headers, NotFoundException, Param, Post, Query } from '@nestjs/common'
import { IsIn, IsNotEmpty, MaxLength } from 'class-validator'
import { CommentStatus, ContentStatus, ContentType, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.module'

type CommentSort = 'latest' | 'likes'

class CreateCommentDto {
  @IsIn(['article', 'project']) contentType!: ContentType
  @IsNotEmpty() @MaxLength(80) contentId!: string
  @IsNotEmpty() @MaxLength(30) name!: string
  @IsNotEmpty() @MaxLength(600) content!: string
}

@Controller('api')
export class CommentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('comments')
  async getComments(
    @Query('contentType') contentType: ContentType,
    @Query('contentId') contentId: string,
    @Query('sort') sort: CommentSort = 'latest',
  ) {
    if (!['article', 'project'].includes(contentType) || !contentId) throw new BadRequestException('contentType and contentId are required')
    if (!['latest', 'likes'].includes(sort)) throw new BadRequestException('sort must be latest or likes')

    const validContent = await this.prisma.content.findFirst({ where: { id: contentId, type: contentType }, select: { id: true } })
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
  async likeComment(@Param('id') id: string, @Headers('x-visitor-key') visitorKeyHeader?: string) {
    const visitorKey = visitorKeyHeader?.trim()
    if (!visitorKey || visitorKey.length > 100) throw new BadRequestException('缺少有效的访客标识。')

    try {
      const comment = await this.prisma.$transaction(async (tx) => {
        await tx.commentLike.create({ data: { commentId: id, visitorKey } })
        return tx.comment.update({ where: { id }, data: { likes: { increment: 1 } } })
      })
      return { id: comment.id, likes: comment.likes }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('你已经为这条评论点赞。')
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') throw new NotFoundException('Comment not found')
      throw error
    }
  }
}