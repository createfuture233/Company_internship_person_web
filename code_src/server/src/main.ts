import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { AppModule } from './app.module'

config({ path: resolve(process.cwd(), 'server/.env'), override: true })
config({ path: resolve(process.cwd(), '.env'), override: true })

function parseCorsOrigins(): (string | RegExp)[] {
  const envOrigins = process.env.CORS_ORIGINS
  const defaults = ['http://localhost:4321', 'http://localhost:5173']
  if (!envOrigins) return defaults
  const parsed = envOrigins.split(',').map((s) => s.trim()).filter(Boolean)
  return parsed.map((o) => o.startsWith('/') && o.endsWith('/') ? new RegExp(o.slice(1, -1)) : o).concat(defaults)
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({
    origin: parseCorsOrigins(),
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Visitor-Key'],
    credentials: true,
  })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  const port = process.env.PORT ?? 3000
  const host = process.env.HOST ?? '0.0.0.0'
  await app.listen(port, host)
  console.log(`[Server] running on http://${host}:${port}`)
}

bootstrap()
