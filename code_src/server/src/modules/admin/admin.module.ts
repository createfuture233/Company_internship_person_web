/**
 * 管理员模块
 * 提供后台管理功能，包括内容管理、评论管理、设置管理等
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'

@Module({
  imports: [PrismaModule],       // 导入Prisma数据库模块
  controllers: [AdminController], // 注册管理员控制器
  providers: [AdminService],      // 注册管理员服务
  exports: [AdminService],        // 导出服务供其他模块使用
})
export class AdminModule {}