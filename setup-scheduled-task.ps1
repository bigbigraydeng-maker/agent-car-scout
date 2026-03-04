# Car Scout 每日自动任务 - Windows 定时任务脚本
# PowerShell 脚本

param(
    [string]$TaskName = "CarScoutDaily",
    [string]$ScriptPath = "C:\Users\Zhong\Documents\trae_projects\Agent Car Scout\daily-scrape.js",
    [string]$Time = "09:00"
)

Write-Host "🚗 Car Scout 每日自动任务设置" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 检查是否以管理员身份运行
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  需要管理员权限来创建定时任务" -ForegroundColor Yellow
    Write-Host "请以管理员身份重新运行此脚本" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "右键点击 PowerShell，选择'以管理员身份运行'，然后执行：" -ForegroundColor Cyan
    Write-Host "  .\setup-scheduled-task.ps1" -ForegroundColor White
    exit 1
}

# 获取 Node.js 路径
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source

if (-not $nodePath) {
    Write-Host "❌ 未找到 Node.js，请先安装 Node.js" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js 路径: $nodePath" -ForegroundColor Green
Write-Host "✅ 脚本路径: $ScriptPath" -ForegroundColor Green
Write-Host "✅ 运行时间: $Time" -ForegroundColor Green
Write-Host ""

# 创建任务动作
$action = New-ScheduledTaskAction `
    -Execute $nodePath `
    -Argument $ScriptPath `
    -WorkingDirectory "C:\Users\Zhong\Documents\trae_projects\Agent Car Scout"

# 创建任务触发器（每天指定时间运行）
$trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At $Time

# 创建任务设置
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

# 创建任务主体
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

# 注册定时任务
try {
    # 先删除已存在的任务
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    
    # 注册新任务
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Car Scout 每日数据抓取和模型训练" | Out-Null
    
    Write-Host "✅ 定时任务创建成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 任务详情:" -ForegroundColor Cyan
    Write-Host "   任务名称: $TaskName"
    Write-Host "   运行时间: 每天 $Time"
    Write-Host "   执行脚本: $ScriptPath"
    Write-Host ""
    
    # 验证任务
    $task = Get-ScheduledTask -TaskName $TaskName
    Write-Host "✅ 任务状态: $($task.State)" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "📝 管理命令:" -ForegroundColor Cyan
    Write-Host "   查看任务: Get-ScheduledTask -TaskName '$TaskName'"
    Write-Host "   手动运行: Start-ScheduledTask -TaskName '$TaskName'"
    Write-Host "   禁用任务: Disable-ScheduledTask -TaskName '$TaskName'"
    Write-Host "   删除任务: Unregister-ScheduledTask -TaskName '$TaskName'"
    Write-Host ""
    
    Write-Host "✅ 设置完成！任务将在每天 $Time 自动运行" -ForegroundColor Green
    
} catch {
    Write-Host "❌ 创建定时任务失败: $_" -ForegroundColor Red
    exit 1
}
