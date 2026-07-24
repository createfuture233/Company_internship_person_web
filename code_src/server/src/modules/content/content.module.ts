/**
 * 内容模块
 * 提供公开内容的获取接口
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ContentController } from './content.controller'

@Module({ 
  imports: [PrismaModule],            // 导入数据库模块
  controllers: [ContentController]    // 注册内容控制器
})
export class ContentModule {}