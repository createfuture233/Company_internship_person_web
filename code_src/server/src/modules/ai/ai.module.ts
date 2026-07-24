/**
 * AI模块
 * 提供AI对话、内容生成、文件分析等功能
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AdminModule } from '../admin/admin.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'

@Module({
  imports: [PrismaModule, AdminModule], // 导入数据库和管理员模块
  controllers: [AiController],           // 注册AI控制器
  providers: [AiService],                // 注册AI服务
  exports: [AiService],                  // 导出服务供其他模块使用
})
export class AiModule {}