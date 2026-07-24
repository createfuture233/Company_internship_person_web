/**
 * 数据种子模块
 * 在服务启动时自动创建初始数据
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { SeedService } from './seed.service'

@Module({ 
  imports: [PrismaModule],   // 导入数据库模块
  providers: [SeedService]   // 注册种子服务（会在模块初始化时自动执行）
})
export class SeedModule {}