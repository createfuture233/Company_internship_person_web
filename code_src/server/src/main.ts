/**
 * NestJS 应用入口文件
 * 负责初始化应用、配置中间件、启动服务器
 */

// 引入反射元数据支持（NestJS 依赖）
import 'reflect-metadata'
// 引入 NestJS 验证管道
import { ValidationPipe } from '@nestjs/common'
// 引入 NestJS 应用工厂
import { NestFactory } from '@nestjs/core'
// 引入 dotenv 配置加载
import { config } from 'dotenv'
// 引入文件系统操作工具
import { existsSync, mkdirSync } from 'node:fs'
// 引入路径解析工具
import { resolve } from 'node:path'
// 引入应用根模块
import { AppModule } from './app.module'
// 引入 Express 静态文件服务
import * as express from 'express'

/**
 * 加载环境变量配置
 * 优先加载 server/.env，然后加载项目根目录 .env
 */
config({ path: resolve(process.cwd(), 'server/.env'), override: true })
config({ path: resolve(process.cwd(), '.env'), override: true })

/**
 * 确定上传文件存储根目录
 * 支持多种运行环境：开发环境、生产环境、项目根目录运行等
 * @returns 上传目录的绝对路径
 */
function uploadRoot() {
  // 优先使用环境变量配置的上传目录
  const envUploadRoot = process.env.UPLOAD_ROOT?.trim()
  if (envUploadRoot) return envUploadRoot

  const cwd = process.cwd()
  
  // 情况1：在 server 目录下运行（开发场景）
  if (existsSync(resolve(cwd, 'prisma')) || existsSync(resolve(cwd, 'src'))) {
    return resolve(cwd, '..', '..', 'uploads')
  }
  
  // 情况2：在项目根目录下运行（生产场景）
  if (existsSync(resolve(cwd, 'client')) && existsSync(resolve(cwd, 'server'))) {
    return resolve(cwd, '..', 'uploads')
  }
  
  // 默认情况：当前目录下的 uploads 文件夹
  return resolve(cwd, 'uploads')
}

/**
 * 解析 CORS 允许的源列表
 * 支持字符串和正则表达式格式
 * @returns CORS 源列表
 */
function parseCorsOrigins(): (string | RegExp)[] {
  const envOrigins = process.env.CORS_ORIGINS
  // 默认允许本地开发环境的两个端口
  const defaults = ['http://localhost:4321', 'http://localhost:5173']
  
  // 如果没有配置环境变量，返回默认值
  if (!envOrigins) return defaults
  
  // 解析逗号分隔的源列表
  const parsed = envOrigins.split(',').map((s) => s.trim()).filter(Boolean)
  
  // 将斜杠包裹的字符串转换为正则表达式
  // 例如：/^https?:\/\/.*\.example\.com$/ 会被转换为 RegExp
  return parsed.map((o) => o.startsWith('/') && o.endsWith('/') ? new RegExp(o.slice(1, -1)) : o).concat(defaults)
}

/**
 * 应用启动引导函数
 * 负责：
 * 1. 创建上传目录
 * 2. 初始化 NestJS 应用
 * 3. 配置 CORS
 * 4. 配置全局验证管道
 * 5. 配置静态文件服务
 * 6. 启动 HTTP 服务器
 */
async function bootstrap() {
  // 创建上传目录（确保存在）
  const uploadDir = uploadRoot()
  mkdirSync(uploadDir, { recursive: true })

  // 创建 NestJS 应用实例
  const app = await NestFactory.create(AppModule)
  
  // 配置 CORS（跨域资源共享）
  app.enableCors({
    origin: parseCorsOrigins(),           // 允许的源列表
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Visitor-Key'],  // 允许的请求头
    credentials: true,                    // 允许携带凭证
  })
  
  // 配置全局验证管道
  // whitelist: true - 自动移除未装饰的属性
  // transform: true - 自动将请求体转换为 DTO 实例
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  // 配置静态文件服务：将 /uploads/ 路径映射到上传目录
  app.use('/uploads/', express.static(uploadDir))

  // 获取端口和主机配置（从环境变量或默认值）
  const port = process.env.PORT ?? 3000
  const host = process.env.HOST ?? '0.0.0.0'
  
  // 启动 HTTP 服务器
  await app.listen(port, host)
  
  // 输出启动日志
  console.log(`[Server] running on http://${host}:${port}`)
  console.log(`[Server] static files served from: ${uploadDir}`)
}

// 启动应用
bootstrap()