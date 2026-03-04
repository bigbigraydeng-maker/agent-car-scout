/**
 * 定时训练任务调度器
 * 
 * 功能：
 *   1. 启动定时训练任务
 *   2. 监控训练状态
 *   3. 处理训练结果
 */

const trainingService = require('./index');

console.log('🚀 启动 Agent Car Scout 训练调度器...');

// 启动定时训练
trainingService.startScheduledTraining();

// 监控进程
process.on('SIGINT', () => {
  console.log('🔄 收到中断信号，正在停止服务...');
  trainingService.stopScheduledTraining();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🔄 收到终止信号，正在停止服务...');
  trainingService.stopScheduledTraining();
  process.exit(0);
});

// 防止进程退出
setInterval(() => {
  console.log('📡 训练调度器运行中...');
}, 60000);

console.log('✅ 训练调度器已启动');
console.log('📅 定时训练将按配置的时间间隔执行');
console.log('🔧 服务将持续运行，直到收到终止信号');
