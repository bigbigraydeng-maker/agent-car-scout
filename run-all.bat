@echo off
REM Car Scout 快速启动脚本

echo.
echo ========================================
echo    Car Scout 快速启动
echo ========================================
echo.

cd /d "C:\Users\Zhong\Documents\trae_projects\Agent Car Scout"

echo [1/3] 运行每日数据抓取...
echo.
node daily-scrape.js

echo.
echo ========================================
echo [2/3] 生成 Car Scout 报告...
echo.
node car-scout-integration.js

echo.
echo ========================================
echo [3/3] 任务完成！
echo.
echo 查看报告:
echo   - reports\car_scout_report_*.json
echo   - reports\feishu_message_*.txt
echo.

pause
