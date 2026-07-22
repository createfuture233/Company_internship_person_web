# 个人星球网站虚拟机部署与运维指南

本文档记录当前项目在 Ubuntu 虚拟机上的部署方式、目录位置、常用重启命令、更新流程与排错方法，方便后续维护。

## 0. 从零开始部署流程

本章节适用于一台全新的 Ubuntu 虚拟机，从没有 Node.js、Nginx、PM2 的状态开始部署本项目。

### 0.1 登录虚拟机

在本地终端或 PowerShell 中连接虚拟机：

```bash
ssh yang@192.168.10.150
```

如果你的虚拟机 IP、用户名不同，请替换为自己的信息。

### 0.2 处理 apt 自动更新锁

新装 Ubuntu 可能正在后台自动更新，执行 `apt install` 时可能出现：

```txt
无法获得锁 /var/lib/dpkg/lock-frontend
锁正由进程 unattended-upgr 持有
```

先检查：

```bash
ps -ef | grep -E "apt|dpkg|unattended" | grep -v grep
```

如果看到 `unattended-upgrade`，可以等待几分钟；如果长时间不结束，可以停止自动更新并修复 dpkg 状态：

```bash
sudo systemctl stop unattended-upgrades
sudo dpkg --configure -a
```

### 0.3 安装基础软件

更新软件源：

```bash
sudo apt update
```

安装基础工具：

```bash
sudo apt install -y curl git nginx sqlite3 ca-certificates build-essential
```

检查是否安装成功：

```bash
curl --version
git --version
nginx -v
sqlite3 --version
```

### 0.4 安装 Node.js 22

推荐使用 NodeSource 安装 Node.js 22。

下载 NodeSource 安装脚本：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
```

执行脚本：

```bash
sudo bash /tmp/nodesource_setup.sh
```

安装 Node.js：

```bash
sudo apt install -y nodejs
```

检查版本：

```bash
node -v
npm -v
```

当前部署验证过的版本：

```txt
Node.js v22.23.1
npm 10.9.8
```

### 0.5 准备部署目录

创建 `/var/www` 并把权限交给当前用户：

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
```

进入目录：

```bash
cd /var/www
```

### 0.6 上传项目代码

#### 方式一：使用 Git 拉取

如果服务器可以访问 GitHub：

```bash
cd /var/www
git clone https://github.com/createfuture233/Company_internship_person_web.git
```

进入项目：

```bash
cd /var/www/Company_internship_person_web/code_src
```

#### 方式二：本地打包上传

如果 GitHub 访问慢，可以在本地把项目打包后上传到虚拟机。

在本地项目所在目录的上一级执行：

```bash
tar --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.npm-cache' \
    --exclude='code_src/client/dist' \
    --exclude='code_src/server/dist' \
    -czf company_person_web_deploy.tar.gz Company_internship_person_web
```

上传到虚拟机：

```bash
scp company_person_web_deploy.tar.gz yang@192.168.10.150:/tmp/
```

在虚拟机解压：

```bash
cd /var/www
tar -xzf /tmp/company_person_web_deploy.tar.gz -C /var/www
```

进入项目：

```bash
cd /var/www/Company_internship_person_web/code_src
```

### 0.7 配置后端 `.env`

后端环境变量文件位置：

```bash
/var/www/Company_internship_person_web/code_src/server/.env
```

如果没有 `.env`，从示例复制：

```bash
cd /var/www/Company_internship_person_web/code_src/server
cp .env.example .env
```

编辑 `.env`：

```bash
nano .env
```

常见配置示例：

```env
DATABASE_URL="file:./data/personal-planet-prisma.db"
ADMIN_INITIAL_PASSWORD="123456"

DEEPSEEK_API_KEY="你的 DeepSeek API Key"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
AI_MAX_CONTEXT_CHARS="12000"
AI_VISITOR_RATE_LIMIT="20"
AI_ADMIN_RATE_LIMIT="100"
```

注意：

- `.env` 不要提交到 GitHub。
- 修改 `.env` 后必须重启后端。
- 如果换了 `DEEPSEEK_API_KEY`，不重启后端就不会生效。

### 0.8 安装项目依赖

进入 `code_src`：

```bash
cd /var/www/Company_internship_person_web/code_src
```

安装依赖：

```bash
npm install --cache .npm-cache
```

### 0.9 生成 Prisma Client

```bash
npx prisma generate --schema=server/prisma/schema.prisma
```

如果是全新数据库，还需要执行迁移：

```bash
npx prisma migrate deploy --schema=server/prisma/schema.prisma
```

如果项目已经带有 SQLite 数据库文件，并且 `.env` 指向该文件，可以先不执行迁移，直接构建测试。

### 0.10 构建项目

构建前端和后端：

```bash
npm run build
```

如果构建失败并提示 Prisma 类型不存在，通常是忘记生成 Prisma Client，重新执行：

```bash
npx prisma generate --schema=server/prisma/schema.prisma
npm run build
```

### 0.11 安装 PM2

```bash
sudo npm install -g pm2
```

检查：

```bash
pm2 -v
```

### 0.12 启动后端服务

后端入口：

```bash
/var/www/Company_internship_person_web/code_src/server/dist/main.js
```

启动：

```bash
cd /var/www/Company_internship_person_web/code_src/server
pm2 start dist/main.js --name personal-planet-api
```

测试后端：

```bash
curl http://127.0.0.1:3000/api/health
```

正常返回示例：

```json
{"status":"ok","service":"personal-planet-api","database":"sqlite"}
```

### 0.13 启动前端服务

前端入口：

```bash
/var/www/Company_internship_person_web/code_src/client/dist/server/entry.mjs
```

启动：

```bash
cd /var/www/Company_internship_person_web/code_src/client
PORT=4321 HOST=127.0.0.1 pm2 start dist/server/entry.mjs --name personal-planet-web --interpreter node
```

测试前端：

```bash
curl -I http://127.0.0.1:4321
```

正常应返回：

```txt
HTTP/1.1 200 OK
```

### 0.14 保存 PM2 进程并设置开机自启

保存当前进程：

```bash
pm2 save
```

设置开机自启：

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u yang --hp /home/yang
```

再次保存：

```bash
pm2 save
```

查看状态：

```bash
pm2 list
```

应该看到：

```txt
personal-planet-api    online
personal-planet-web    online
```

### 0.15 配置 Nginx

创建 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/personal-planet
```

写入：

```nginx
server {
    listen 80;
    server_name 192.168.10.150 _;

    client_max_body_size 20m;

    location /uploads/ {
        alias /var/www/Company_internship_person_web/uploads/;
        access_log off;
        expires 30d;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

启用配置：

```bash
sudo ln -sf /etc/nginx/sites-available/personal-planet /etc/nginx/sites-enabled/personal-planet
sudo rm -f /etc/nginx/sites-enabled/default
```

检查配置：

```bash
sudo nginx -t
```

重载 Nginx：

```bash
sudo systemctl reload nginx
sudo systemctl enable nginx
```

### 0.16 验证部署结果

虚拟机内部验证：

```bash
curl http://127.0.0.1/api/health
curl -I http://127.0.0.1
```

从本机浏览器访问：

```txt
http://192.168.10.150
```

后端健康检查：

```txt
http://192.168.10.150/api/health
```

### 0.17 验证核心功能

建议依次测试：

- 首页是否正常打开；
- 文章列表是否正常；
- 文章详情是否正常，例如 `/articles/1`；
- 作品列表是否正常；
- 作品详情是否正常；
- 管理员登录是否成功；
- 评论是否能提交；
- 联系表单是否能提交；
- AI 助手是否能返回内容；
- 后台网站设置是否能保存；
- 上传封面图是否能显示。

如果文章或作品详情页无法加载，检查：

```bash
curl http://127.0.0.1/api/articles
curl http://127.0.0.1/api/projects
```

如果管理员登录或提交失败，检查：

```bash
curl http://127.0.0.1/api/health
curl http://192.168.10.150/api/health
```

### 0.18 新虚拟机部署完成后的安全检查

部署完成后建议立刻做：

```bash
pm2 list
sudo nginx -t
curl http://127.0.0.1/api/health
curl -I http://127.0.0.1
```

并修改弱密码：

- 修改 SSH 密码；
- 修改后台管理员密码；
- 确认 `.env` 中 DeepSeek Key 是自己的；
- 不要把 `.env` 上传到公开仓库。

## 1. 当前部署信息

| 项目 | 内容 |
| --- | --- |
| 虚拟机地址 | `192.168.10.150` |
| SSH 用户 | `yang` |
| 网站访问地址 | `http://192.168.10.150` |
| 后端健康检查 | `http://192.168.10.150/api/health` |
| 前端服务端口 | `4321`，仅本机监听 |
| 后端服务端口 | `3000`，仅本机监听 |
| Web 服务器 | Nginx |
| 进程管理 | PM2 |
| 后端数据库 | SQLite + Prisma |
| 前端技术栈 | Astro + React Islands |
| 后端技术栈 | NestJS + Prisma + SQLite |

## 2. 服务器目录结构

项目部署在：

```bash
/var/www/Company_internship_person_web
```

主要目录：

```bash
/var/www/Company_internship_person_web
├── code_src
│   ├── client          # Astro 前端
│   └── server          # NestJS 后端
├── doc                 # 文档
└── README.md
```

前端目录：

```bash
/var/www/Company_internship_person_web/code_src/client
```

后端目录：

```bash
/var/www/Company_internship_person_web/code_src/server
```

后端环境变量：

```bash
/var/www/Company_internship_person_web/code_src/server/.env
```

SQLite 数据目录：

```bash
/var/www/Company_internship_person_web/code_src/server/data
```

Nginx 配置：

```bash
/etc/nginx/sites-available/personal-planet
/etc/nginx/sites-enabled/personal-planet
```

PM2 配置目录：

```bash
/home/yang/.pm2
```

## 3. Nginx 代理关系

当前 Nginx 负责把外部 80 端口请求转发给前后端服务。

```txt
用户浏览器
  ↓
http://192.168.10.150
  ↓
Nginx: 80
  ├── /api/  →  http://127.0.0.1:3000/api/
  └── /      →  http://127.0.0.1:4321/
```

也就是说：

- 前端页面访问：`http://192.168.10.150`
- 后端接口访问：`http://192.168.10.150/api/...`

## 4. 常用 PM2 命令

查看服务状态：

```bash
pm2 list
```

查看实时日志：

```bash
pm2 logs
```

查看后端日志：

```bash
pm2 logs personal-planet-api
```

查看前端日志：

```bash
pm2 logs personal-planet-web
```

重启后端：

```bash
pm2 restart personal-planet-api
```

重启前端：

```bash
pm2 restart personal-planet-web
```

同时重启全部服务：

```bash
pm2 restart all
```

停止后端：

```bash
pm2 stop personal-planet-api
```

停止前端：

```bash
pm2 stop personal-planet-web
```

保存当前 PM2 进程列表，保证重启虚拟机后自动恢复：

```bash
pm2 save
```

## 5. 常用 Nginx 命令

检查 Nginx 配置是否正确：

```bash
sudo nginx -t
```

重新加载 Nginx：

```bash
sudo systemctl reload nginx
```

重启 Nginx：

```bash
sudo systemctl restart nginx
```

查看 Nginx 状态：

```bash
sudo systemctl status nginx
```

查看 Nginx 错误日志：

```bash
sudo tail -n 100 /var/log/nginx/error.log
```

查看 Nginx 访问日志：

```bash
sudo tail -n 100 /var/log/nginx/access.log
```

## 6. 更新项目代码后的部署流程

如果你修改了本地代码，并上传/同步到了虚拟机，需要在虚拟机中执行以下流程。

进入项目目录：

```bash
cd /var/www/Company_internship_person_web/code_src
```

安装或更新依赖：

```bash
npm install --cache .npm-cache
```

生成 Prisma Client：

```bash
npx prisma generate --schema=server/prisma/schema.prisma
```

构建前后端：

```bash
npm run build
```

重启服务：

```bash
pm2 restart personal-planet-api
pm2 restart personal-planet-web
pm2 save
```

验证：

```bash
curl http://127.0.0.1:3000/api/health
curl -I http://127.0.0.1:4321
curl http://127.0.0.1/api/health
```

浏览器访问：

```txt
http://192.168.10.150
```

## 7. 只修改前端时的更新流程

如果只修改了前端页面、样式、组件：

```bash
cd /var/www/Company_internship_person_web/code_src
npm run build --workspace=client
pm2 restart personal-planet-web
pm2 save
```

## 8. 只修改后端时的更新流程

如果只修改了后端接口、数据库读写、AI 服务：

```bash
cd /var/www/Company_internship_person_web/code_src
npx prisma generate --schema=server/prisma/schema.prisma
npm run build --workspace=server
pm2 restart personal-planet-api
pm2 save
```

## 9. 修改 `.env` 后必须重启后端

后端启动时会读取：

```bash
/var/www/Company_internship_person_web/code_src/server/.env
```

如果修改了以下配置：

- `DATABASE_URL`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `ADMIN_INITIAL_PASSWORD`
- AI 相关限流配置

必须重启后端：

```bash
pm2 restart personal-planet-api
```

否则运行中的后端仍然使用旧配置。

检查后端是否正常：

```bash
curl http://127.0.0.1/api/health
```

## 10. API 地址规则

前端 API 配置文件：

```bash
code_src/client/src/lib/api.ts
```

当前规则：

| 环境 | API 地址 |
| --- | --- |
| 本地浏览器开发 | `http://localhost:3000/api` |
| 生产浏览器访问 | `/api` |
| Astro 服务端渲染 | `http://127.0.0.1:3000/api` |

这样可以同时保证：

- 管理员登录、评论、联系表单在浏览器中正常提交；
- 文章详情、作品详情在 Astro 服务端渲染时能正常读取后端数据。

## 11. 数据库与备份

SQLite 数据库文件位于：

```bash
/var/www/Company_internship_person_web/code_src/server/data
```

查看数据库文件：

```bash
ls -lh /var/www/Company_internship_person_web/code_src/server/data
```

备份数据库：

```bash
cd /var/www/Company_internship_person_web/code_src/server/data
cp personal-planet-prisma.db personal-planet-prisma.backup-$(date +%Y%m%d%H%M%S).db
```

如果实际使用的数据库文件名不是 `personal-planet-prisma.db`，以 `.env` 中 `DATABASE_URL` 指向的文件为准。

查看 `.env` 中数据库配置：

```bash
cd /var/www/Company_internship_person_web/code_src/server
grep DATABASE_URL .env
```

## 12. 上传图片目录

后台上传封面图会保存到项目根目录的独立上传目录：

```bash
/var/www/Company_internship_person_web/uploads/images
```

查看上传图片：

```bash
find /var/www/Company_internship_person_web/uploads/images -type f | head
```

后端上传成功后会返回类似下面的图片地址：

```txt
/uploads/images/articles/article-cover-xxxx.png
/uploads/images/projects/project-cover-xxxx.png
```

Nginx 需要配置 `/uploads/` 静态映射：

```nginx
location /uploads/ {
    alias /var/www/Company_internship_person_web/uploads/;
    access_log off;
    expires 30d;
}
```

注意：如果后续重新上传整个项目，不要误删 `/var/www/Company_internship_person_web/uploads` 目录，否则后台上传的图片会丢失。

## 13. 常见问题排查

### 13.1 管理员登录失败 / 评论发送失败 / 联系发送失败

先检查后端：

```bash
curl http://127.0.0.1/api/health
curl http://192.168.10.150/api/health
```

如果本机正常、浏览器不正常，检查 Nginx：

```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -n 100 /var/log/nginx/error.log
```

检查前端构建产物是否错误请求了 `localhost:3000`：

```bash
grep -R "localhost:3000/api" -n /var/www/Company_internship_person_web/code_src/client/dist/client || true
```

正常情况下，浏览器端构建产物不应该包含 `localhost:3000/api`。

### 13.2 文章或作品详情页显示“暂时无法加载”

检查后端内容接口：

```bash
curl http://127.0.0.1/api/articles
curl http://127.0.0.1/api/projects
```

检查文章详情页：

```bash
curl -I http://127.0.0.1/articles/1
```

检查作品详情页：

```bash
curl http://127.0.0.1/api/projects
```

拿到作品 `slug` 后访问：

```bash
curl -I http://127.0.0.1/projects/你的slug
```

如果 API 正常但页面不正常，重新构建前端：

```bash
cd /var/www/Company_internship_person_web/code_src
npm run build --workspace=client
pm2 restart personal-planet-web
```

### 13.3 AI 助手不可用

检查 `.env`：

```bash
cd /var/www/Company_internship_person_web/code_src/server
grep DEEPSEEK .env
```

修改 `DEEPSEEK_API_KEY` 后，必须重启后端：

```bash
pm2 restart personal-planet-api
```

查看后端日志：

```bash
pm2 logs personal-planet-api
```

### 13.4 修改后台网站设置后前台没有变化

检查公开设置接口：

```bash
curl http://127.0.0.1/api/settings
curl http://192.168.10.150/api/settings
```

如果接口返回已更新，但前端没变：

```bash
pm2 restart personal-planet-web
```

浏览器强制刷新：

```txt
Ctrl + F5
```

### 13.5 PM2 服务异常

查看状态：

```bash
pm2 list
```

查看日志：

```bash
pm2 logs personal-planet-api
pm2 logs personal-planet-web
```

重启：

```bash
pm2 restart all
```

## 14. 安全建议

当前只是虚拟机内网部署，后续如果开放公网，建议完成以下事项：

- 修改 SSH 密码，不要继续使用简单密码；
- 修改管理员密码，不要继续使用 `123456`；
- `.env` 不要提交到 GitHub；
- DeepSeek API Key 只放服务器 `.env`；
- 配置 HTTPS；
- 定期备份 SQLite 数据库；
- 定期备份上传图片目录；
- 如果访问量增大，考虑把 SQLite 迁移到 PostgreSQL 或 MySQL。

## 15. 一键常用命令速查

```bash
# 进入项目
cd /var/www/Company_internship_person_web/code_src

# 查看服务
pm2 list

# 查看日志
pm2 logs

# 重启后端
pm2 restart personal-planet-api

# 重启前端
pm2 restart personal-planet-web

# 重启全部
pm2 restart all

# 重新构建全部
npm run build

# 重新构建前端
npm run build --workspace=client

# 重新构建后端
npm run build --workspace=server

# 生成 Prisma Client
npx prisma generate --schema=server/prisma/schema.prisma

# 检查后端
curl http://127.0.0.1/api/health

# 检查网站
curl -I http://127.0.0.1

# 检查外部访问
curl -I http://192.168.10.150

# 检查 Nginx
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```
