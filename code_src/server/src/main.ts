import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { AppModule } from './app.module'

config({ path: resolve(process.cwd(), 'server/.env'), override: true })
config({ path: resolve(process.cwd(), '.env'), override: true })

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({
    origin: ['http://localhost:4321', 'http://localhost:5173'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Visitor-Key'],
  })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  await app.listen(process.env.PORT ?? 3000)
}

bootstrap()
