@echo off
REM Car Scout 每日自动任务 - 快速设置脚本

echo.
echo ========================================
echo    Car Scout 每日自动任务设置
echo ========================================
echo.

REM 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [警告] 需要管理员权限
    echo.
    echo 请右键点击此脚本，选择"以管理员身份运行"
    echo.
    pause
    exit /b 1
)

echo [信息] 正在设置定时任务...
echo.

REM 创建定时任务（每天早上9点运行）
schtasks /create /tn "CarScoutDaily" /tr "node C:\Users\Zhong\Documents\trae_projects\Agent Car Scout\daily-scrape.js" /sc daily /st 09:00 /f

if %errorLevel% equ 0 (
    echo.
    echo ========================================
    echo [成功] 定时任务创建成功！
    echo ========================================
    echo.
    echo 任务名称: CarScoutDaily
    echo 运行时间: 每天 09:00
    echo 执行脚本: daily-scrape.js
    echo.
    echo 管理命令:
    echo   查看任务: schtasks /query /tn "CarScoutDaily"
    echo   手动运行: schtasks /run /tn "CarScoutDaily"
    echo   删除任务: schtasks /delete /tn "CarScoutDaily" /f
    echo.
) else (
    echo.
    echo [错误] 创建定时任务失败
    echo.
)

pause
