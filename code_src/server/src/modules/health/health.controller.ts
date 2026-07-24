/**
 * 健康检查控制器
 * 提供服务健康状态检查接口
 */
import { Controller, Get } from '@nestjs/common'

@Controller('api')
export class HealthController {
  /**
   * 健康检查接口
   * @returns 服务状态信息
   */
  @Get('health')
  health() {
    return { status: 'ok', service: 'personal-planet-api', database: 'sqlite' }
  }
}