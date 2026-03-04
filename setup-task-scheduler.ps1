# Car Scout - 自动训练任务计划设置脚本
# 此脚本会在 Windows 任务计划程序中创建一个每日自动训练任务

$TaskName = "Car Scout Auto Training"
$TaskDescription = "每天自动执行 Car Scout 多平台数据爬取和市场估价模型训练"
$TaskPath = "\Car Scout"
$ActionPath = "C:\Users\Zhong\Documents\trae_projects\Agent Car Scout\run-auto-train.bat"
$TriggerTime = "08:00"

# 检查任务是否已存在
$existingTask = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "任务已存在，正在更新..."
    # 删除现有任务
    Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false
}

# 创建任务动作
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c $ActionPath"

# 创建每日触发器
$Trigger = New-ScheduledTaskTrigger -Daily -At $TriggerTime

# 设置任务设置
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# 创建任务
$Task = New-ScheduledTask -Action $Action -Trigger $Trigger -Settings $Settings -Description $TaskDescription

# 注册任务
Register-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -InputObject $Task -User $env:USERNAME

Write-Host "任务计划已创建: $TaskPath\$TaskName"
Write-Host "触发时间: 每天 $TriggerTime"
Write-Host "执行文件: $ActionPath"
Write-Host ""
Write-Host "任务计划设置完成！系统将每天自动执行 Car Scout 训练流程。"
