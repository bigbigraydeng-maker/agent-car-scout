/**
 * Car Scout - Auto Training System
 * 
 * 功能：
 *   1. 自动执行多平台数据爬取
 *   2. 处理和融合不同平台的数据
 *   3. 更新市场估价模型
 *   4. 生成训练报告
 *   5. 支持定时执行
 * 
 * 用法：
 *   node src/auto-train.js              # 执行一次训练
 *   node src/auto-train.js --schedule    # 启动定时训练
 *   node src/auto-train.js --report      # 生成训练报告
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── 配置 ───
const DATA_DIR = path.join(__dirname, '..', 'data');
const LOG_DIR = path.join(DATA_DIR, 'training_logs');
const REPORT_DIR = path.join(DATA_DIR, 'reports');
const SCHEDULE_INTERVAL = 24 * 60 * 60 * 1000; // 24小时

// ─── 工具函数 ───
function ensureDirectories() {
  const dirs = [DATA_DIR, LOG_DIR, REPORT_DIR];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  console.log(logMessage);
  
  // 确保日志目录存在
  ensureDirectories();
  
  // 写入日志文件
  const logFile = path.join(LOG_DIR, `auto-train_${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage + '\n');
}

function runCommand(command, cwd = __dirname) {
  log(`执行命令: ${command}`);
  try {
    const output = execSync(command, { cwd, encoding: 'utf8', timeout: 600000 }); // 10分钟超时
    log(`命令执行成功: ${output.trim()}`);
    return output;
  } catch (error) {
    log(`命令执行失败: ${error.message}`, 'error');
    throw error;
  }
}

function generateReport() {
  log('生成训练报告...');
  
  try {
    // 读取最新的市场数据
    const dataFiles = fs.readdirSync(DATA_DIR)
      .filter(f => f.startsWith('market_valuation_') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (dataFiles.length === 0) {
      log('无市场数据可生成报告', 'warning');
      return null;
    }
    
    const latestData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, dataFiles[0]), 'utf8'));
    
    // 统计数据
    const stats = {
      totalListings: latestData.listings.length,
      platforms: latestData.platforms || [],
      createdAt: latestData.createdAt,
      modelDistribution: {},
      yearDistribution: {},
      priceDistribution: {
        min: Infinity,
        max: 0,
        average: 0
      }
    };
    
    let totalPrice = 0;
    latestData.listings.forEach(listing => {
      // 车型分布
      stats.modelDistribution[listing.model] = (stats.modelDistribution[listing.model] || 0) + 1;
      
      // 年份分布
      stats.yearDistribution[listing.year] = (stats.yearDistribution[listing.year] || 0) + 1;
      
      // 价格统计
      if (listing.price < stats.priceDistribution.min) stats.priceDistribution.min = listing.price;
      if (listing.price > stats.priceDistribution.max) stats.priceDistribution.max = listing.price;
      totalPrice += listing.price;
    });
    
    stats.priceDistribution.average = Math.round(totalPrice / latestData.listings.length);
    
    // 平台分布
    const platformDistribution = {};
    latestData.listings.forEach(listing => {
      platformDistribution[listing.platform] = (platformDistribution[listing.platform] || 0) + 1;
    });
    
    // 生成报告
    const report = {
      reportId: `report_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      dataSource: dataFiles[0],
      statistics: stats,
      platformDistribution,
      summary: {
        totalListings: stats.totalListings,
        uniqueModels: Object.keys(stats.modelDistribution).length,
        averagePrice: stats.priceDistribution.average,
        dataAge: calculateDataAge(latestData.createdAt),
        healthStatus: assessDataHealth(stats)
      }
    };
    
    // 保存报告
    const reportPath = path.join(REPORT_DIR, `training_report_${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    log(`训练报告已生成: ${reportPath}`);
    return report;
  } catch (error) {
    log(`生成报告失败: ${error.message}`, 'error');
    return null;
  }
}

function calculateDataAge(createdAt) {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return Math.round(ageMs / (1000 * 60 * 60 * 24));
}

function assessDataHealth(stats) {
  if (stats.totalListings < 20) return 'poor';
  if (stats.totalListings < 50) return 'fair';
  if (Object.keys(stats.platformDistribution).length < 2) return 'fair';
  return 'good';
}

function cleanupOldData() {
  log('清理旧数据...');
  
  try {
    const files = fs.readdirSync(DATA_DIR)
      .filter(f => f.startsWith('market_valuation_') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    // 保留最近7天的数据
    const keepCount = 7;
    if (files.length > keepCount) {
      const filesToDelete = files.slice(keepCount);
      filesToDelete.forEach(file => {
        const filePath = path.join(DATA_DIR, file);
        fs.unlinkSync(filePath);
        log(`已删除旧数据文件: ${file}`);
      });
    }
  } catch (error) {
    log(`清理旧数据失败: ${error.message}`, 'error');
  }
}

// ─── 主训练函数 ───
async function runTraining() {
  log('🚀 开始自动训练流程...');
  
  try {
    ensureDirectories();
    
    // 1. 执行多平台数据爬取
    log('📡 执行多平台数据爬取...');
    runCommand('node multi-platform-scraper.js', __dirname);
    
    // 2. 清理旧数据
    cleanupOldData();
    
    // 3. 生成训练报告
    const report = generateReport();
    
    // 4. 验证数据质量
    if (report && report.summary.healthStatus === 'poor') {
      log('⚠️ 数据质量较差，建议检查数据源', 'warning');
    }
    
    log('🎉 自动训练流程完成！');
    return true;
  } catch (error) {
    log(`❌ 训练流程失败: ${error.message}`, 'error');
    return false;
  }
}

// ─── 定时任务 ───
function startScheduledTraining() {
  log('⏰ 启动定时训练任务...');
  
  // 立即执行一次
  runTraining();
  
  // 设置定时执行
  setInterval(() => {
    log('⏰ 执行定时训练...');
    runTraining();
  }, SCHEDULE_INTERVAL);
  
  log(`定时训练已启动，每 ${SCHEDULE_INTERVAL / (1000 * 60 * 60)} 小时执行一次`);
}

// ─── 命令行参数处理 ───
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--schedule')) {
    startScheduledTraining();
  } else if (args.includes('--report')) {
    generateReport();
  } else {
    runTraining();
  }
}

module.exports = {
  runTraining,
  startScheduledTraining,
  generateReport
};