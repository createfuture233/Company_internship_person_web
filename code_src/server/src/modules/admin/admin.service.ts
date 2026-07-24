/**
 * 管理员服务
 * 提供管理员身份验证、会话管理和审计日志功能
 */
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import { PrismaService } from '../../prisma/prisma.module'

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 验证管理员身份
   * @param authorization - Authorization 请求头（Bearer token）
   * @returns 管理员信息
   * @throws UnauthorizedException - 当token无效或过期时
   */
  async requireAdmin(authorization?: string) {
    const token = this.readToken(authorization)
    const session = await this.prisma.adminSession.findFirst({
      where: {
        tokenHash: this.tokenHash(token),
        revokedAt: null,
        expiresAt: { gt: new Date().toISOString() },
      },
      include: { admin: true },
    })
    if (!session) throw new UnauthorizedException('管理员登录已失效，请重新登录。')
    return session.admin
  }

  /**
   * 创建管理员会话
   * @param adminId - 管理员ID
   * @returns 会话token和过期时间
   */
  async createSession(adminId: number) {
    const token = randomBytes(36).toString('base64url')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString() // 7天有效期
    await this.prisma.adminSession.create({ data: { adminId, tokenHash: this.tokenHash(token), expiresAt } })
    return { token, expiresAt }
  }

  /**
   * 撤销管理员会话（登出）
   * @param authorization - Authorization 请求头
   */
  async revokeSession(authorization?: string) {
    const token = this.readToken(authorization)
    if (!token) return
    await this.prisma.adminSession.updateMany({
      where: { tokenHash: this.tokenHash(token), revokedAt: null },
      data: { revokedAt: new Date().toISOString() },
    })
  }

  /**
   * 记录审计日志
   * @param adminId - 执行操作的管理员ID
   * @param action - 操作类型
   * @param targetType - 目标资源类型
   * @param targetId - 目标资源ID
   * @param payload - 额外信息
   */
  async audit(adminId: number, action: string, targetType: string, targetId?: string, payload?: object) {
    await this.prisma.auditLog.create({
      data: {
        adminId,
        action,
        targetType,
        targetId,
        payload: payload ? JSON.stringify(payload) : null,
        createdAt: new Date().toISOString(),
      },
    })
  }

  /**
   * 从Authorization头中提取token
   * @param authorization - Authorization 请求头
   * @returns token字符串
   */
  private readToken(authorization?: string) {
    return authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  }

  /**
   * 对token进行SHA256哈希
   * @param token - 原始token
   * @returns 哈希值
   */
  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }
}