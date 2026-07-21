import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { AdminModule } from './modules/admin/admin.module'
import { AiModule } from './modules/ai/ai.module'
import { AuthModule } from './modules/auth/auth.module'
import { CommentsModule } from './modules/comments/comments.module'
import { ContactModule } from './modules/contact/contact.module'
import { ContentModule } from './modules/content/content.module'
import { HealthModule } from './modules/health/health.module'
import { SeedModule } from './modules/seed/seed.module'

@Module({
  imports: [
    PrismaModule,
    SeedModule,
    HealthModule,
    AuthModule,
    ContentModule,
    CommentsModule,
    ContactModule,
    AdminModule,
    AiModule,
  ],
})
export class AppModule {}