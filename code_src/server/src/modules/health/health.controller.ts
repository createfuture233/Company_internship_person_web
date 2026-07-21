import { Controller, Get } from '@nestjs/common'

@Controller('api')
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'personal-planet-api', database: 'sqlite' }
  }
}