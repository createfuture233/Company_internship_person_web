/**
 * 认证控制器
 * 处理管理员登录和登出
 */
import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common'
import { IsNotEmpty, MaxLength } from 'class-validator'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../../prisma/prisma.module'
import { AdminService } from '../admin/admin.service'

/** 登录DTO */
class LoginDto {
  @IsNotEmpty() @MaxLength(60) username!: string   // 用户名
  @IsNotEmpty() @MaxLength(120) password!: string  // 密码
}

@Controller('api')
export class AuthController {
  constructor(private readonly prisma: PrismaService, private readonly adminService: AdminService) {}

  /**
   * 管理员登录
   * @param data - 登录凭据
   * @returns 登录结果（token和用户信息）
   */
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

  /**
   * 管理员登出
   * @param authorization - Authorization请求头
   * @returns 登出结果
   */
  @Post('auth/logout')
  async logout(@Headers('authorization') authorization?: string) {
    await this.adminService.revokeSession(authorization)
    return { ok: true }
  }
}