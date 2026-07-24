/**
 * 评论模块
 * 提供评论的CRUD和点赞功能
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { CommentsController } from './comments.controller'

@Module({ 
  imports: [PrismaModule],            // 导入数据库模块
  controllers: [CommentsController]   // 注册评论控制器
})
export class CommentsModule {}