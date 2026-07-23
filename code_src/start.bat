@echo off
chcp 65001 >nul
echo ================================================
echo   Personal Planet 一键启动脚本
echo ================================================
echo.

:: 设置项目路径
set "PROJECT_DIR=d:\Project_WorkSpace\VScode_workspace\Company_internship_person_web\code_src"
set "BACKEND_DIR=%PROJECT_DIR%\server"
set "FRONTEND_DIR=%PROJECT_DIR%\client"

echo [1/3] 检查 Node.js 版本...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js 未安装！请先安装 https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1-2" %%a in ('node -v') do set NODE_VER=%%a
echo       Node.js 版本: %NODE_VER%

echo.
echo [2/3] 启动后端服务（端口 3000）...
start "Personal Planet - Backend" powershell -Command "cd '%BACKEND_DIR%'; npx prisma generate; npx prisma migrate deploy; npm run start:dev"

echo       等待后端启动中...
timeout /t 5 /nobreak >nul

echo.
echo [3/3] 启动前端服务（端口 4321）...
start "Personal Planet - Frontend" powershell -Command "cd '%FRONTEND_DIR%'; npm run dev"

echo.
echo ================================================
echo   启动完成！
echo ================================================
echo.
echo   前端地址: http://localhost:4321
echo   后端API:  http://localhost:3000/api
echo   后台管理: http://localhost:4321/admin
echo.
echo   按任意键打开浏览器...
pause >nul
start http://localhost:4321
