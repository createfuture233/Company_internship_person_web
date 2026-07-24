/**
 * 联系模块
 * 提供用户联系和邮件订阅功能
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ContactController } from './contact.controller'

@Module({ 
  imports: [PrismaModule],           // 导入数据库模块
  controllers: [ContactController]   // 注册联系控制器
})
export class ContactModule {}