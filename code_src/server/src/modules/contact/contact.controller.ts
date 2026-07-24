/**
 * 联系控制器
 * 处理用户联系表单和邮件订阅
 */
import { Body, Controller, Post } from '@nestjs/common'
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator'
import { PrismaService } from '../../prisma/prisma.module'

/** 联系表单DTO */
class ContactDto {
  @IsNotEmpty() @MaxLength(60) name!: string      // 姓名
  @IsEmail() email!: string                        // 邮箱
  @IsNotEmpty() @MaxLength(2000) message!: string  // 消息内容
}

/** 订阅DTO */
class SubscribeDto {
  @IsEmail() email!: string                        // 订阅邮箱
}

/**
 * 获取当前时间的ISO字符串
 */
function nowIso() {
  return new Date().toISOString()
}

@Controller('api')
export class ContactController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 提交联系消息
   * @param data - 联系表单数据
   * @returns 提交结果
   */
  @Post('contact')
  async contact(@Body() data: ContactDto) {
    const message = await this.prisma.contactMessage.create({
      data: { name: data.name.trim(), email: data.email.toLowerCase(), message: data.message.trim(), createdAt: nowIso() },
    })
    return { ok: true, id: message.id, message: '消息已收到。' }
  }

  /**
   * 订阅邮件通知
   * @param data - 订阅数据
   * @returns 订阅结果
   */
  @Post('subscriptions')
  async subscribe(@Body() data: SubscribeDto) {
    const email = data.email.toLowerCase()
    const subscription = await this.prisma.subscription.upsert({ where: { email }, update: {}, create: { email, createdAt: nowIso() } })
    return { ok: true, email: subscription.email }
  }
}