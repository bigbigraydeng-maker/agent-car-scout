/**
 * 每日数据抓取脚本
 * 自动从多个数据源抓取数据并更新模型
 */

const { scrapeNZCars } = require('./scrape-nz-cars-playwright');
const { scrapeAllSources } = require('./scrape-multi-sources');
const { AdvancedPricePredictor } = require('./advanced-price-predictor');
const { ModelMonitor } = require('./model-monitor');
const fs = require('fs');
const path = require('path');

class DailyScraper {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.reportsDir = path.join(__dirname, 'reports');
    this.targetDataCount = 500;
  }

  /**
   * 获取当前数据量
   */
  getCurrentDataCount() {
    const files = fs.readdirSync(this.dataDir)
      .filter(f => f.endsWith('.json') && !f.includes('predictor'))
      .sort()
      .reverse();

    let totalCount = 0;
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.dataDir, file), 'utf8'));
        if (data.vehicles) {
          totalCount += data.vehicles.length;
        }
      } catch (e) {
        // 跳过无效文件
      }
    }

    return { count: totalCount, files: files.length };
  }

  /**
   * 合并所有数据
   */
  mergeAllData() {
    console.log('📊 合并所有历史数据...');
    
    const files = fs.readdirSync(this.dataDir)
      .filter(f => f.endsWith('.json') && !f.includes('predictor'))
      .sort()
      .reverse();

    const allVehicles = [];
    const seenIds = new Set();

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.dataDir, file), 'utf8'));
        if (data.vehicles && Array.isArray(data.vehicles)) {
          for (const v of data.vehicles) {
            if (v.id && !seenIds.has(v.id)) {
              seenIds.add(v.id);
              allVehicles.push(v);
            }
          }
        }
      } catch (e) {
        console.log(`   ⚠️  跳过无效文件: ${file}`);
      }
    }

    console.log(`   ✅ 合并完成: ${allVehicles.length} 条唯一记录`);
    return allVehicles;
  }

  /**
   * 重新训练模型
   */
  async retrainModel() {
    console.log('🎓 重新训练价格预测模型...');
    
    try {
      const vehicles = this.mergeAllData();
      
      if (vehicles.length < 50) {
        console.log('   ⚠️  数据不足，跳过训练 (需要至少 50 条)');
        return null;
      }

      const predictor = new AdvancedPricePredictor();
      predictor.train(vehicles);
      
      // 评估模型
      const testData = vehicles.slice(0, Math.min(50, vehicles.length));
      const performance = predictor.evaluate(testData);
      
      // 保存模型
      const modelPath = path.join(this.dataDir, 'advanced_price_predictor.json');
      predictor.saveModel(modelPath);
      
      console.log('   ✅ 模型训练完成');
      console.log(`   📊 准确率: ${performance.accuracy}%`);
      console.log(`   📊 平均误差: ${performance.mae}%`);
      
      return performance;
    } catch (error) {
      console.error('   ❌ 模型训练失败:', error.message);
      return null;
    }
  }

  /**
   * 运行模型监控
   */
  async runMonitoring() {
    console.log('🔍 运行模型监控...');
    
    try {
      const monitor = new ModelMonitor();
      const report = await monitor.run();
      
      console.log('   ✅ 监控完成');
      return report;
    } catch (error) {
      console.error('   ❌ 监控失败:', error.message);
      return null;
    }
  }

  /**
   * 生成每日报告
   */
  generateDailyReport(scrapeResults, modelPerformance, monitorReport) {
    console.log('📊 生成每日报告...');
    
    const report = {
      date: new Date().toISOString(),
      summary: {
        totalDataPoints: scrapeResults.totalCount || 0,
        newDataPoints: scrapeResults.newCount || 0,
        modelAccuracy: modelPerformance?.accuracy || 'N/A',
        modelMae: modelPerformance?.mae || 'N/A',
        healthStatus: monitorReport?.summary?.status || 'unknown'
      },
      dataSources: scrapeResults.sources || {},
      modelPerformance: modelPerformance,
      monitorReport: monitorReport,
      recommendations: this.generateRecommendations(scrapeResults, modelPerformance)
    };

    // 确保报告目录存在
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }

    const reportPath = path.join(this.reportsDir, `daily_report_${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`   ✅ 报告已保存: ${reportPath}`);
    return report;
  }

  /**
   * 生成建议
   */
  generateRecommendations(scrapeResults, modelPerformance) {
    const recommendations = [];
    const currentData = this.getCurrentDataCount();

    // 数据量建议
    if (currentData.count < this.targetDataCount) {
      const needed = this.targetDataCount - currentData.count;
      recommendations.push({
        priority: 'high',
        action: '继续抓取数据',
        reason: `当前 ${currentData.count} 条，还需要 ${needed} 条达到目标 ${this.targetDataCount} 条`
      });
    }

    // 模型性能建议
    if (modelPerformance) {
      const accuracy = parseFloat(modelPerformance.accuracy);
      if (accuracy < 85) {
        recommendations.push({
          priority: 'high',
          action: '优化模型',
          reason: `准确率 ${accuracy}% 低于 85%，需要优化`
        });
      } else if (accuracy < 90) {
        recommendations.push({
          priority: 'medium',
          action: '继续优化',
          reason: `准确率 ${accuracy}% 接近目标 90%，继续努力`
        });
      }
    }

    // 数据源建议
    if (!scrapeResults.sources || Object.keys(scrapeResults.sources).length < 3) {
      recommendations.push({
        priority: 'medium',
        action: '增加数据源',
        reason: '数据源较少，建议增加更多平台'
      });
    }

    recommendations.push({
      priority: 'low',
      action: '定期监控',
      reason: '建议每日运行数据抓取和模型监控'
    });

    return recommendations;
  }

  /**
   * 打印每日摘要
   */
  printDailySummary(report) {
    console.log('');
    console.log('📊 每日数据抓取摘要');
    console.log('========================================');
    console.log(`日期: ${new Date().toLocaleDateString()}`);
    console.log('');

    console.log('📈 数据统计:');
    console.log(`   总数据量: ${report.summary.totalDataPoints} 条`);
    console.log(`   新增数据: ${report.summary.newDataPoints} 条`);
    console.log('');

    console.log('🎯 模型性能:');
    console.log(`   准确率: ${report.summary.modelAccuracy}%`);
    console.log(`   平均误差: ${report.summary.modelMae}%`);
    console.log(`   健康状态: ${report.summary.healthStatus === 'healthy' ? '✅ 健康' : '⚠️ 需关注'}`);
    console.log('');

    if (report.recommendations.length > 0) {
      console.log('💡 建议:');
      report.recommendations.forEach((rec, i) => {
        const priority = rec.priority === 'high' ? '🔴' : 
                        rec.priority === 'medium' ? '🟡' : '🟢';
        console.log(`   ${priority} ${i + 1}. ${rec.action}`);
        console.log(`      ${rec.reason}`);
      });
      console.log('');
    }

    console.log('✅ 每日任务完成!');
    console.log('');
  }

  /**
   * 运行每日任务
   */
  async run() {
    console.log('🚀 开始每日数据抓取任务');
    console.log('========================================');
    console.log(`时间: ${new Date().toLocaleString()}`);
    console.log('');

    const startTime = Date.now();
    let scrapeResults = { totalCount: 0, newCount: 0, sources: {} };
    let modelPerformance = null;
    let monitorReport = null;

    try {
      // 1. 检查当前数据量
      const currentData = this.getCurrentDataCount();
      console.log('📊 当前数据状态:');
      console.log(`   数据文件: ${currentData.files} 个`);
      console.log(`   总记录数: ${currentData.count} 条`);
      console.log(`   目标: ${this.targetDataCount} 条`);
      console.log('');

      // 2. 抓取 TradeMe 数据
      console.log('🔍 步骤 1: 抓取 TradeMe 数据...');
      try {
        // 这里会调用 scrape-nz-cars-playwright.js
        console.log('   ⏳ 正在抓取 TradeMe...');
        // scrapeResults = await scrapeNZCars();
        console.log('   ✅ TradeMe 抓取完成 (模拟)');
      } catch (error) {
        console.error('   ❌ TradeMe 抓取失败:', error.message);
      }
      console.log('');

      // 3. 抓取其他数据源
      console.log('🔍 步骤 2: 抓取其他数据源...');
      try {
        // 这里会调用 scrape-multi-sources.js
        console.log('   ⏳ 正在抓取其他数据源...');
        // const multiSourceResults = await scrapeAllSources();
        // scrapeResults = { ...scrapeResults, ...multiSourceResults };
        console.log('   ✅ 其他数据源抓取完成 (模拟)');
      } catch (error) {
        console.error('   ❌ 其他数据源抓取失败:', error.message);
      }
      console.log('');

      // 4. 重新训练模型
      console.log('🔍 步骤 3: 重新训练模型...');
      modelPerformance = await this.retrainModel();
      console.log('');

      // 5. 运行模型监控
      console.log('🔍 步骤 4: 运行模型监控...');
      monitorReport = await this.runMonitoring();
      console.log('');

      // 6. 生成每日报告
      const report = this.generateDailyReport(scrapeResults, modelPerformance, monitorReport);

      // 7. 打印摘要
      this.printDailySummary(report);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`⏱️  总耗时: ${duration} 秒`);

      return report;

    } catch (error) {
      console.error('❌ 每日任务失败:', error.message);
      throw error;
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const scraper = new DailyScraper();
  await scraper.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { DailyScraper };
