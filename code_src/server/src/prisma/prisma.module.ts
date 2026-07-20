import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect()
    await this.$executeRawUnsafe('PRAGMA foreign_keys = ON')
    await this.$queryRawUnsafe('PRAGMA journal_mode = WAL')
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}