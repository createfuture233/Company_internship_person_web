import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ContactController } from './contact.controller'

@Module({ imports: [PrismaModule], controllers: [ContactController] })
export class ContactModule {}