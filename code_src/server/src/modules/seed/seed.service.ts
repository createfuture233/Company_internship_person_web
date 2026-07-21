import { Injectable, OnModuleInit } from '@nestjs/common'
import { CommentStatus, ContentStatus, ContentType } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../../prisma/prisma.module'

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

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const now = new Date().toISOString()
    const passwordHash = await bcrypt.hash(process.env.ADMIN_INITIAL_PASSWORD ?? '123456', 12)
    await this.prisma.admin.upsert({
      where: { username: 'admin' },
      update: { passwordHash, updatedAt: now },
      create: { username: 'admin', passwordHash, role: 'admin', createdAt: now, updatedAt: now },
    })

    for (const item of initialContents) {
      await this.prisma.content.upsert({
        where: { id: item.id },
        update: {},
        create: { ...item, status: ContentStatus.published, publishedAt: now, createdAt: now, updatedAt: now },
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
        create: { ...comment, status: CommentStatus.visible, createdAt: now, updatedAt: now },
      })
    }
  }
}
