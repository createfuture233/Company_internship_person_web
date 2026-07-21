import { Body, Controller, Post } from '@nestjs/common'
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator'
import { PrismaService } from '../../prisma/prisma.module'

class ContactDto {
  @IsNotEmpty() @MaxLength(60) name!: string
  @IsEmail() email!: string
  @IsNotEmpty() @MaxLength(2000) message!: string
}

class SubscribeDto {
  @IsEmail() email!: string
}

@Controller('api')
export class ContactController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('contact')
  async contact(@Body() data: ContactDto) {
    const message = await this.prisma.contactMessage.create({
      data: { name: data.name.trim(), email: data.email.toLowerCase(), message: data.message.trim() },
    })
    return { ok: true, id: message.id, message: '消息已收到。' }
  }

  @Post('subscriptions')
  async subscribe(@Body() data: SubscribeDto) {
    const email = data.email.toLowerCase()
    const subscription = await this.prisma.subscription.upsert({ where: { email }, update: {}, create: { email } })
    return { ok: true, email: subscription.email }
  }
}