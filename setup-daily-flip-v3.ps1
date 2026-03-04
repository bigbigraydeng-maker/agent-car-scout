# Car Scout v3.1 每日Flip报告定时任务

$TaskName = "CarScout-DailyFlip-v3"
$ScriptDir = "C:\Users\Zhong\.openclaw\workspace\skills\car-scout"

Write-Host "========================================"
Write-Host " Car Scout v3.1 - 创建定时任务"
Write-Host "========================================"
Write-Host ""

# 删除旧任务
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# 创建任务 (简化版)
$Action = New-ScheduledTaskAction -Execute "node" -Argument "src/run-flip-v3.js" -WorkingDirectory $ScriptDir
$Trigger = New-ScheduledTaskTrigger -Daily -At "08:00"

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Force

Write-Host ""
Write-Host "✅ 定时任务已创建: $TaskName"
Write-Host "   频率: 每天 08:00"
Write-Host "   版本: v3.1优化版 (价格预测模型)"
Write-Host ""
