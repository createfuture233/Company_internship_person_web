/**
 * 健康检查模块
 * 提供服务健康状态检查功能
 */
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'

@Module({ controllers: [HealthController] })  // 注册健康检查控制器
export class HealthModule {}