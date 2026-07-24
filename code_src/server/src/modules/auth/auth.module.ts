/**
 * 认证模块
 * 提供管理员登录和登出功能
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AdminModule } from '../admin/admin.module'
import { AuthController } from './auth.controller'

@Module({ 
  imports: [PrismaModule, AdminModule],  // 导入数据库和管理员模块
  controllers: [AuthController]          // 注册认证控制器
})
export class AuthModule {}