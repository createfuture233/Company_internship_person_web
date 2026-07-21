import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AdminModule } from '../admin/admin.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'

@Module({
  imports: [PrismaModule, AdminModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}