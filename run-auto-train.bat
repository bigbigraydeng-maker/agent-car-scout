@echo off

REM Car Scout - 自动训练批处理文件
REM 每天自动执行数据爬取和模型训练

cd /d "C:\Users\Zhong\Documents\trae_projects\Agent Car Scout"

echo 开始执行 Car Scout 自动训练...
date /t
time /t

REM 检查 Node.js 是否可用
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: Node.js 未安装或不在系统路径中
    pause
    exit /b 1
)

REM 执行自动训练
node src\auto-train.js

if %errorlevel% neq 0 (
    echo 训练执行失败
    pause
    exit /b 1
)

echo 训练执行完成
pause