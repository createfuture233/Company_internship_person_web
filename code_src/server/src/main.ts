import 'reflect-metadata'
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { IsEmail, IsIn, IsNotEmpty, MaxLength } from 'class-validator'

type ContentType = 'article' | 'project'
type CommentSort = 'latest' | 'likes'

type CommentItem = {
  id: string
  contentType: ContentType
  contentId: string
  name: string
  avatar: string
  content: string
  likes: number
  createdAt: string
}

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

const comments: CommentItem[] = [
  { id: 'comment-article-1', contentType: 'article', contentId: '1', name: 'Nova', avatar: 'N', content: 'The idea of turning a personal site into a long-term record feels inspiring.', likes: 12, createdAt: '2026-07-18T09:20:00.000Z' },
  { id: 'comment-article-1-2', contentType: 'article', contentId: '1', name: 'Mika', avatar: 'M', content: 'Looking forward to the next part of the build log.', likes: 5, createdAt: '2026-07-19T13:40:00.000Z' },
  { id: 'comment-project-personal-planet', contentType: 'project', contentId: 'personal-planet', name: 'Orbit', avatar: 'O', content: 'The visual system and interaction direction are both very clear.', likes: 9, createdAt: '2026-07-18T16:10:00.000Z' },
]

@Controller('api')
class AppController {
  @Get('health')
  health() { return { status: 'ok', service: 'personal-planet-api' } }

  @Get('articles')
  articles() { return [{ id: 1, slug: 'personal-planet-plan', title: 'Personal site plan', tag: 'Notes' }] }

  @Get('projects')
  projects() { return [{ id: 1, slug: 'personal-planet', title: 'Personal Planet', stack: ['Astro', 'React', 'NestJS'] }] }

  @Get('comments')
  getComments(
    @Query('contentType') contentType: ContentType,
    @Query('contentId') contentId: string,
    @Query('sort') sort: CommentSort = 'latest',
  ) {
    if (!['article', 'project'].includes(contentType) || !contentId) throw new BadRequestException('contentType and contentId are required')
    if (!['latest', 'likes'].includes(sort)) throw new BadRequestException('sort must be latest or likes')

    const items = comments
      .filter((comment) => comment.contentType === contentType && comment.contentId === contentId)
      .sort((a, b) => sort === 'likes'
        ? b.likes - a.likes || +new Date(b.createdAt) - +new Date(a.createdAt)
        : +new Date(b.createdAt) - +new Date(a.createdAt))

    return { items, total: items.length, sort }
  }

  @Post('comments')
  createComment(@Body() data: CreateCommentDto) {
    const comment: CommentItem = {
      id: 'comment-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      contentType: data.contentType,
      contentId: data.contentId,
      name: data.name.trim(),
      avatar: data.name.trim().slice(0, 2).toUpperCase(),
      content: data.content.trim(),
      likes: 0,
      createdAt: new Date().toISOString(),
    }
    comments.unshift(comment)
    return comment
  }

  @Post('comments/:id/like')
  likeComment(@Param('id') id: string) {
    const comment = comments.find((item) => item.id === id)
    if (!comment) throw new NotFoundException('Comment not found')
    comment.likes += 1
    return comment
  }

  @Post('contact')
  contact(@Body() data: ContactDto) { return { ok: true, message: 'Thanks, ' + data.name + '. Your message has been received.' } }

  @Post('subscriptions')
  subscribe(@Body() data: SubscribeDto) { return { ok: true, email: data.email } }
}

@Module({ controllers: [AppController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: ['http://localhost:4321', 'http://localhost:5173'] })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  await app.listen(process.env.PORT ?? 3000)
}

bootstrap()