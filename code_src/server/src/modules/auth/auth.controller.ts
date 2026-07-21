import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common'
import { IsNotEmpty, MaxLength } from 'class-validator'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../../prisma/prisma.module'
import { AdminService } from '../admin/admin.service'

class LoginDto {
  @IsNotEmpty() @MaxLength(60) username!: string
  @IsNotEmpty() @MaxLength(120) password!: string
}

@Controller('api')
export class AuthController {
  constructor(private readonly prisma: PrismaService, private readonly adminService: AdminService) {}

  @Post('auth/login')
  async login(@Body() data: LoginDto) {
    const admin = await this.prisma.admin.findUnique({ where: { username: data.username } })
    if (!admin || !(await bcrypt.compare(data.password, admin.passwordHash))) {
      throw new UnauthorizedException('账号或密码错误。')
    }
    const session = await this.adminService.createSession(admin.id)
    await this.adminService.audit(admin.id, 'login', 'admin', String(admin.id))
    return { token: session.token, username: admin.username, expiresAt: session.expiresAt }
  }

  @Post('auth/logout')
  async logout(@Headers('authorization') authorization?: string) {
    await this.adminService.revokeSession(authorization)
    return { ok: true }
  }
}