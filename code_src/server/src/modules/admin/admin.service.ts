import { Injectable, UnauthorizedException } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import { PrismaService } from '../../prisma/prisma.module'

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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

  async createSession(adminId: number) {
    const token = randomBytes(36).toString('base64url')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
    await this.prisma.adminSession.create({ data: { adminId, tokenHash: this.tokenHash(token), expiresAt } })
    return { token, expiresAt }
  }

  async revokeSession(authorization?: string) {
    const token = this.readToken(authorization)
    if (!token) return
    await this.prisma.adminSession.updateMany({
      where: { tokenHash: this.tokenHash(token), revokedAt: null },
      data: { revokedAt: new Date().toISOString() },
    })
  }

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

  private readToken(authorization?: string) {
    return authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  }

  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }
}
