#!/bin/bash
# ========== Personal Planet 一键部署脚本（Ubuntu/Debian） ==========
# 使用方法：
#   1. 上传项目到服务器，或使用 git clone
#   2. 进入 code_src 目录：cd /path/to/code_src
#   3. 赋予执行权限：chmod +x deploy.sh
#   4. 运行：./deploy.sh

set -e

echo "============================================="
echo "  Personal Planet 生产环境部署脚本"
echo "============================================="

# ---------- Step 0: 检查 Node.js 和 npm ----------
echo ""
echo "[Step 0/6] 检查运行环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，正在安装 Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "✅ Node.js 版本: $(node -v)"
echo "✅ npm 版本: $(npm -v)"

# ---------- Step 1: 安装依赖 ----------
echo ""
echo "[Step 1/6] 安装项目依赖..."
if [ ! -d "node_modules" ]; then
    npm ci
else
    echo "依赖已存在，跳过安装"
fi

# ---------- Step 2: 配置环境变量 ----------
echo ""
echo "[Step 2/6] 检查环境变量..."
if [ ! -f "server/.env" ]; then
    echo "⚠️  server/.env 不存在，正在从 .env.example 创建..."
    cp server/.env.example server/.env
    echo "⚠️  请修改 server/.env 中的 ADMIN_INITIAL_PASSWORD 等配置后重新运行"
    echo "   编辑命令：nano server/.env"
    exit 1
fi
echo "✅ 环境变量文件已存在"

# 加载环境变量
set -a
source server/.env
set +a

# 检查管理员密码
if [ "$ADMIN_INITIAL_PASSWORD" = "change-this-before-production" ]; then
    echo "⚠️  警告：ADMIN_INITIAL_PASSWORD 使用默认值，请尽快修改！"
fi

# ---------- Step 3: 构建项目 ----------
echo ""
echo "[Step 3/6] 构建前后端项目..."
npm run build
echo "✅ 构建完成"

# ---------- Step 4: 初始化 Prisma 数据库 ----------
echo ""
echo "[Step 4/6] 初始化数据库..."
cd server
npx prisma generate
if [ ! -f "$(echo $DATABASE_URL | sed 's/file://')" ]; then
    echo "数据库文件不存在，执行初始化迁移..."
    npx prisma migrate deploy
fi
cd ..
echo "✅ 数据库就绪"

# ---------- Step 5: 安装 PM2 并启动服务 ----------
echo ""
echo "[Step 5/6] 启动应用服务..."
if ! command -v pm2 &> /dev/null; then
    echo "正在安装 PM2 进程管理器..."
    sudo npm install -g pm2
    pm2 startup systemd -u $USER --hp $HOME || true
fi

pm2 delete ecosystem.config.js --silent 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
echo "✅ 服务已启动"
echo ""
pm2 status

# ---------- Step 6: Nginx 配置提示 ----------
echo ""
echo "[Step 6/6] Nginx 配置提示"
echo "============================================="
echo ""
echo "部署完成！以下是后续步骤："
echo ""
echo "1️⃣  如果已安装 Nginx，复制配置："
echo "    sudo cp nginx.conf.example /etc/nginx/conf.d/personal-planet.conf"
echo "    sudo nano /etc/nginx/conf.d/personal-planet.conf  # 修改域名"
echo "    sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "2️⃣  配置 HTTPS（推荐）："
echo "    sudo apt install certbot python3-certbot-nginx -y"
echo "    sudo certbot --nginx -d your-domain.com -d www.your-domain.com"
echo ""
echo "3️⃣  当前服务状态："
echo "    - 前端 Astro SSR:  http://127.0.0.1:4321"
echo "    - 后端 NestJS API: http://127.0.0.1:3000"
echo "    - 管理员后台:      /admin"
echo "    - 默认管理员密码:  请查看 server/.env 中的 ADMIN_INITIAL_PASSWORD"
echo ""
echo "4️⃣  常用管理命令："
echo "    pm2 status          # 查看服务状态"
echo "    pm2 logs            # 查看实时日志"
echo "    pm2 reload all      # 重启所有服务"
echo "    pm2 stop all        # 停止所有服务"
echo ""
echo "============================================="
echo "🎉 部署完成！"
echo "============================================="
