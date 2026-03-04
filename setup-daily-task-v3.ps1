# Car Scout v3.1 每日Flip报告定时任务
# 使用PowerShell创建

$TaskName = "CarScout-DailyFlip-v3"
$ScriptDir = "C:\Users\Zhong\.openclaw\workspace\skills\car-scout"
$Time = "08:00"

Write-Host "========================================"
Write-Host " Car Scout v3.1 - 每日Flip报告定时任务"
Write-Host "========================================"
Write-Host ""

# 删除旧任务(如果存在)
schtasks /delete /tn $TaskName /f 2>$null

# 创建新任务
$Action = New-ScheduledTaskAction -Execute "node" -Argument "src/run-flip-v3.js" -WorkingDirectory $ScriptDir
$Trigger = New-ScheduledTaskTrigger -Daily -At $Time
$Settings = New-ScheduledTaskSettings -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -RunLevel Highest -Force

Write-Host ""
Write-Host "✅ 任务已创建: $TaskName"
Write-Host "   频率: 每天 $Time"
Write-Host "   版本: v3.1优化版 (价格预测模型)"
Write-Host ""
Write-Host "管理命令:"
Write-Host "   查看:   schtasks /query /tn `"$TaskName`""
Write-Host "   手动跑: schtasks /run /tn `"$TaskName`""
Write-Host "   停用:   schtasks /change /tn `"$TaskName`" /disable"
Write-Host "   删除:   schtasks /delete /tn `"$TaskName`" /f"
Write-Host ""
