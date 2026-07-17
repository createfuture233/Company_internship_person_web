import 'reflect-metadata'
import { Body, Controller, Get, Module, Post, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator'

class ContactDto { @IsNotEmpty() @MaxLength(60) name!: string; @IsEmail() email!: string; @IsNotEmpty() @MaxLength(2000) message!: string }
class SubscribeDto { @IsEmail() email!: string }

@Controller('api')
class AppController {
  @Get('health') health() { return { status: 'ok', service: 'personal-planet-api' } }
  @Get('articles') articles() { return [{ id: 1, slug: 'personal-planet-plan', title: '从灵感到上线：我的个人网站规划', tag: '随笔' }] }
  @Get('projects') projects() { return [{ id: 1, slug: 'personal-planet', title: '个人星球', stack: ['React', 'Vite', 'NestJS'] }] }
  @Post('contact') contact(@Body() data: ContactDto) { return { ok: true, message: `谢谢你，${data.name}！消息已收到。` } }
  @Post('subscriptions') subscribe(@Body() data: SubscribeDto) { return { ok: true, email: data.email } }
}
@Module({ controllers: [AppController] }) class AppModule {}
async function bootstrap() { const app = await NestFactory.create(AppModule); app.enableCors({ origin: 'http://localhost:5173' }); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); await app.listen(process.env.PORT ?? 3000) }
bootstrap()
