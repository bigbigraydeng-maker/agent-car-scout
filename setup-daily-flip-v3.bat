@echo off
:: Car Scout v3.1 - 每日Flip评分报告定时任务
:: 运行方式: 以管理员身份运行此 .bat 文件
::
:: 功能:
::   1. 运行v3.1优化版评分系统
::   2. 发送飞书报告

set SCRIPT_DIR=%~dp0..
set NODE_PATH=node

echo ========================================
echo  Car Scout v3.1 - 每日Flip报告定时任务
echo ========================================
echo.

:: 创建每日Flip报告任务 (每天早上8点运行)
schtasks /create /tn "CarScout-DailyFlip-v3" /sc DAILY /st 08:00 /tr "cmd /c cd /d \"%SCRIPT_DIR%\" && %NODE_PATH% src/run-flip-v3.js >> data\flip_v3_output.log 2>&1 && %NODE_PATH% src/send-feishu-v3.js >> data\feishu_v3_output.log 2>&1" /f

if %errorlevel% equ 0 (
    echo.
    echo ✅ 任务已创建: CarScout-DailyFlip-v3
    echo    频率: 每天 08:00
    echo    版本: v3.1优化版 (价格预测模型)
    echo    日志: data\flip_v3_output.log, data\feishu_v3_output.log
    echo.
    echo 管理命令:
    echo   查看:   schtasks /query /tn "CarScout-DailyFlip-v3"
    echo   手动跑: schtasks /run /tn "CarScout-DailyFlip-v3"
    echo   停用:   schtasks /change /tn "CarScout-DailyFlip-v3" /disable
    echo   删除:   schtasks /delete /tn "CarScout-DailyFlip-v3" /f
) else (
    echo.
    echo ❌ 创建失败! 请以管理员身份运行此脚本
)

echo.
pause
