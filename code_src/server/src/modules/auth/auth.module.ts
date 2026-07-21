import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AdminModule } from '../admin/admin.module'
import { AuthController } from './auth.controller'

@Module({ imports: [PrismaModule, AdminModule], controllers: [AuthController] })
export class AuthModule {}