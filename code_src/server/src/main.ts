import 'reflect-metadata'
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
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

type ContentItem = {
  id: string
  type: ContentType
  title: string
  summary: string
  body: string
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

class LoginDto {
  @IsNotEmpty() @MaxLength(60) username!: string
  @IsNotEmpty() @MaxLength(120) password!: string
}

class UpdateContentDto {
  @IsNotEmpty() @MaxLength(120) title!: string
  @IsNotEmpty() @MaxLength(500) summary!: string
  @IsNotEmpty() @MaxLength(5000) body!: string
}

class CreateContentDto extends UpdateContentDto {
  @IsIn(['article', 'project']) type!: ContentType
}
const comments: CommentItem[] = [
  { id: 'comment-article-1', contentType: 'article', contentId: '1', name: 'Nova', avatar: 'N', content: '把个人网站做成长期记录的想法很有启发。', likes: 12, createdAt: '2026-07-18T09:20:00.000Z' },
  { id: 'comment-article-1-2', contentType: 'article', contentId: '1', name: 'Mika', avatar: 'M', content: '期待下一篇开发日志。', likes: 5, createdAt: '2026-07-19T13:40:00.000Z' },
  { id: 'comment-project-personal-planet', contentType: 'project', contentId: 'personal-planet', name: 'Orbit', avatar: 'O', content: '视觉系统和交互方向都很清晰。', likes: 9, createdAt: '2026-07-18T16:10:00.000Z' },
]

const contentItems: ContentItem[] = [
  { id: '1', type: 'article', title: '从灵感到上线：我的个人网站规划', summary: '把模糊的想法拆成可执行的页面、内容和技术选择。', body: '一个想法真正开始成形，往往不是在写下结论的时候，而是在不断追问它要为谁解决什么问题的过程中。记录真实的使用情境、限制条件与希望达成的体验，能让创作在持续迭代中保持清晰。' },
  { id: '2', type: 'article', title: '为网页加入有呼吸感的动态背景', summary: '记录手绘风动效与性能之间的平衡方法。', body: '动态效果应该服务于内容阅读，而不是抢走注意力。通过降低运动幅度、控制触发时机和尊重系统减弱动效设置，可以让页面拥有呼吸感。' },
  { id: '3', type: 'article', title: '用需求文档让创意落地', summary: '从用户场景、交互到验收标准的一次实践。', body: '需求文档的价值在于把抽象期待转为可验证的约定。先说明用户要完成什么，再说明页面如何反馈，最后补上可以验收的结果。' },
  { id: 'personal-planet', type: 'project', title: '个人星球', summary: '一座记录作品、思考与成长的数字花园。', body: '这个项目关注如何把信息、交互与视觉氛围组织成一个连贯的体验，并在持续迭代中保留可维护性。' },
  { id: 'data-atlas', type: 'project', title: '数据漫游图鉴', summary: '将日常数据转化为可探索的叙事地图。', body: '项目从数据的采集、结构整理到视觉编码出发，尝试让原本抽象的数字成为可以探索、比较和讲述的故事。' },
]

const sessions = new Set<string>()

function createToken() {
  return 'planet-admin-' + Date.now() + '-' + Math.random().toString(36).slice(2)
}

function extractToken(authorization?: string) {
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
}

@Controller('api')
class AppController {
  private requireAdmin(authorization?: string) {
    if (!sessions.has(extractToken(authorization))) throw new UnauthorizedException('管理员登录已失效，请重新登录。')
  }

  @Get('health')
  health() { return { status: 'ok', service: 'personal-planet-api' } }

  @Get('articles')
  articles() { return contentItems.filter((item) => item.type === 'article') }

  @Get('projects')
  projects() { return contentItems.filter((item) => item.type === 'project') }

  @Get('content/:type/:id')
  getContent(@Param('type') type: ContentType, @Param('id') id: string) {
    const item = contentItems.find((entry) => entry.type === type && entry.id === id)
    if (!item) throw new NotFoundException('Content not found')
    return item
  }

  @Post('auth/login')
  login(@Body() data: LoginDto) {
    if (data.username !== 'admin' || data.password !== '123456') throw new UnauthorizedException('账号或密码错误。')
    const token = createToken()
    sessions.add(token)
    return { token, username: 'admin' }
  }

  @Post('auth/logout')
  logout(@Headers('authorization') authorization?: string) {
    sessions.delete(extractToken(authorization))
    return { ok: true }
  }

  @Get('admin/content')
  adminContent(@Headers('authorization') authorization?: string) {
    this.requireAdmin(authorization)
    return contentItems
  }

  @Post('admin/content')
  createContent(
    @Headers('authorization') authorization: string | undefined,
    @Body() data: CreateContentDto,
  ) {
    this.requireAdmin(authorization)
    const item: ContentItem = {
      id: data.type + '-' + Date.now(),
      type: data.type,
      title: data.title.trim(),
      summary: data.summary.trim(),
      body: data.body.trim(),
    }
    contentItems.unshift(item)
    return item
  }
  @Patch('admin/content/:type/:id')
  updateContent(
    @Headers('authorization') authorization: string | undefined,
    @Param('type') type: ContentType,
    @Param('id') id: string,
    @Body() data: UpdateContentDto,
  ) {
    this.requireAdmin(authorization)
    const item = contentItems.find((entry) => entry.type === type && entry.id === id)
    if (!item) throw new NotFoundException('Content not found')
    item.title = data.title.trim()
    item.summary = data.summary.trim()
    item.body = data.body.trim()
    return item
  }

  @Get('comments')
  getComments(
    @Query('contentType') contentType: ContentType,
    @Query('contentId') contentId: string,
    @Query('sort') sort: CommentSort = 'latest',
  ) {
    if (!['article', 'project'].includes(contentType) || !contentId) throw new BadRequestException('contentType and contentId are required')
    if (!['latest', 'likes'].includes(sort)) throw new BadRequestException('sort must be latest or likes')
    const items = comments.filter((comment) => comment.contentType === contentType && comment.contentId === contentId).sort((a, b) => sort === 'likes' ? b.likes - a.likes || +new Date(b.createdAt) - +new Date(a.createdAt) : +new Date(b.createdAt) - +new Date(a.createdAt))
    return { items, total: items.length, sort }
  }

  @Post('comments')
  createComment(@Body() data: CreateCommentDto) {
    const comment: CommentItem = { id: 'comment-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), contentType: data.contentType, contentId: data.contentId, name: data.name.trim(), avatar: data.name.trim().slice(0, 2).toUpperCase(), content: data.content.trim(), likes: 0, createdAt: new Date().toISOString() }
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