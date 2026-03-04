/**
 * 模型性能监控系统
 * 定期评估模型性能并生成报告
 */

const fs = require('fs');
const path = require('path');
const { AdvancedPricePredictor } = require('./advanced-price-predictor');

class ModelMonitor {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.reportsDir = path.join(__dirname, 'reports');
    this.thresholds = {
      minAccuracy: 75,      // 最低准确率要求
      maxMae: 20,           // 最大平均误差要求
      maxPredictionVariance: 0.3  // 最大预测方差
    };
  }

  /**
   * 加载最新数据
   */
  loadLatestData() {
    const files = fs.readdirSync(this.dataDir)
      .filter(f => f.startsWith('nz_cars') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      throw new Error('没有找到数据文件');
    }

    const allVehicles = [];
    for (const file of files.slice(0, 5)) { // 最近5个文件
      const data = JSON.parse(fs.readFileSync(path.join(this.dataDir, file), 'utf8'));
      allVehicles.push(...data.vehicles);
    }

    return allVehicles;
  }

  /**
   * 加载模型
   */
  loadModel() {
    const modelPath = path.join(this.dataDir, 'advanced_price_predictor.json');
    if (!fs.existsSync(modelPath)) {
      throw new Error('模型文件不存在');
    }

    const predictor = new AdvancedPricePredictor();
    predictor.loadModel(modelPath);
    return predictor;
  }

  /**
   * 评估模型性能
   */
  evaluateModel(vehicles, predictor) {
    console.log('📊 评估模型性能...');
    
    const testData = vehicles.filter(v => 
      v.price > 0 && v.year > 0 && v.mileage > 0
    );

    const predictions = [];
    let totalError = 0;
    let totalAbsError = 0;
    const errors = [];

    for (const vehicle of testData) {
      try {
        const prediction = predictor.predict(vehicle);
        const error = prediction.predictedPrice - vehicle.price;
        const absError = Math.abs(error);
        const errorPercentage = (absError / vehicle.price) * 100;

        totalError += errorPercentage;
        totalAbsError += absError;
        errors.push(errorPercentage);

        predictions.push({
          actual: vehicle.price,
          predicted: prediction.predictedPrice,
          error: errorPercentage,
          confidence: prediction.confidence,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year
        });
      } catch (e) {
        console.log(`   ⚠️  预测失败: ${e.message}`);
      }
    }

    const mae = totalError / errors.length;
    const rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
    const accuracy = 100 - mae;
    const meanAbsError = totalAbsError / errors.length;

    // 按车型分析
    const modelErrors = {};
    for (const p of predictions) {
      const key = `${p.make} ${p.model}`;
      if (!modelErrors[key]) {
        modelErrors[key] = { errors: [], count: 0 };
      }
      modelErrors[key].errors.push(p.error);
      modelErrors[key].count++;
    }

    const modelPerformance = {};
    for (const [model, data] of Object.entries(modelErrors)) {
      const avgError = data.errors.reduce((a, b) => a + b, 0) / data.errors.length;
      modelPerformance[model] = {
        avgError: avgError.toFixed(2),
        count: data.count,
        accuracy: (100 - avgError).toFixed(2)
      };
    }

    return {
      overall: {
        mae: mae.toFixed(2),
        rmse: rmse.toFixed(2),
        accuracy: accuracy.toFixed(2),
        meanAbsError: meanAbsError.toFixed(0),
        sampleSize: errors.length
      },
      byModel: modelPerformance,
      predictions: predictions
    };
  }

  /**
   * 检查模型健康状况
   */
  checkHealth(metrics) {
    console.log('🏥 检查模型健康状况...');
    
    const issues = [];
    const warnings = [];

    // 检查准确率
    if (parseFloat(metrics.overall.accuracy) < this.thresholds.minAccuracy) {
      issues.push({
        type: 'error',
        message: `准确率过低: ${metrics.overall.accuracy}% (要求 >= ${this.thresholds.minAccuracy}%)`
      });
    } else if (parseFloat(metrics.overall.accuracy) < 85) {
      warnings.push({
        type: 'warning',
        message: `准确率偏低: ${metrics.overall.accuracy}% (建议 >= 85%)`
      });
    }

    // 检查误差
    if (parseFloat(metrics.overall.mae) > this.thresholds.maxMae) {
      issues.push({
        type: 'error',
        message: `平均误差过高: ${metrics.overall.mae}% (要求 <= ${this.thresholds.maxMae}%)`
      });
    }

    // 检查各车型性能
    for (const [model, perf] of Object.entries(metrics.byModel)) {
      if (parseFloat(perf.accuracy) < 70) {
        issues.push({
          type: 'error',
          message: `${model} 准确率过低: ${perf.accuracy}%`
        });
      }
    }

    return { issues, warnings };
  }

  /**
   * 生成监控报告
   */
  generateReport(metrics, health) {
    const timestamp = new Date().toISOString();
    const reportDate = timestamp.split('T')[0];

    const report = {
      timestamp,
      summary: {
        status: health.issues.length === 0 ? 'healthy' : 'unhealthy',
        overallAccuracy: metrics.overall.accuracy,
        overallMae: metrics.overall.mae,
        sampleSize: metrics.overall.sampleSize
      },
      metrics: metrics,
      health: health,
      recommendations: this.generateRecommendations(metrics, health)
    };

    // 确保报告目录存在
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }

    // 保存报告
    const reportPath = path.join(this.reportsDir, `model_monitor_${reportDate}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * 生成改进建议
   */
  generateRecommendations(metrics, health) {
    const recommendations = [];

    if (health.issues.length > 0) {
      recommendations.push({
        priority: 'high',
        action: '重新训练模型',
        reason: '模型性能不达标，需要重新训练'
      });
    }

    if (parseFloat(metrics.overall.accuracy) < 80) {
      recommendations.push({
        priority: 'high',
        action: '增加训练数据',
        reason: '准确率低于80%，需要更多数据'
      });
    }

    // 检查表现差的车型
    const poorModels = Object.entries(metrics.byModel)
      .filter(([_, perf]) => parseFloat(perf.accuracy) < 75)
      .map(([model, _]) => model);

    if (poorModels.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: '优化特定车型模型',
        reason: `以下车型表现较差: ${poorModels.join(', ')}`
      });
    }

    if (metrics.overall.sampleSize < 100) {
      recommendations.push({
        priority: 'medium',
        action: '增加测试样本',
        reason: `测试样本仅 ${metrics.overall.sampleSize} 条，建议至少 100 条`
      });
    }

    recommendations.push({
      priority: 'low',
      action: '定期监控',
      reason: '建议每周运行一次性能监控'
    });

    return recommendations;
  }

  /**
   * 打印报告
   */
  printReport(report) {
    console.log('');
    console.log('📊 模型性能监控报告');
    console.log('========================================');
    console.log(`时间: ${report.timestamp}`);
    console.log(`状态: ${report.summary.status === 'healthy' ? '✅ 健康' : '❌ 异常'}`);
    console.log('');

    console.log('📈 整体性能:');
    console.log(`   准确率: ${report.metrics.overall.accuracy}%`);
    console.log(`   平均误差: ${report.metrics.overall.mae}%`);
    console.log(`   均方根误差: ${report.metrics.overall.rmse}%`);
    console.log(`   平均绝对误差: $${report.metrics.overall.meanAbsError}`);
    console.log(`   测试样本: ${report.metrics.overall.sampleSize}`);
    console.log('');

    if (report.health.issues.length > 0) {
      console.log('❌ 严重问题:');
      report.health.issues.forEach(issue => {
        console.log(`   - ${issue.message}`);
      });
      console.log('');
    }

    if (report.health.warnings.length > 0) {
      console.log('⚠️  警告:');
      report.health.warnings.forEach(warning => {
        console.log(`   - ${warning.message}`);
      });
      console.log('');
    }

    console.log('🚗 各车型性能:');
    Object.entries(report.metrics.byModel)
      .sort((a, b) => parseFloat(b[1].accuracy) - parseFloat(a[1].accuracy))
      .forEach(([model, perf]) => {
        const status = parseFloat(perf.accuracy) >= 80 ? '✅' : 
                      parseFloat(perf.accuracy) >= 70 ? '⚠️' : '❌';
        console.log(`   ${status} ${model}: ${perf.accuracy}% (${perf.count} 辆)`);
      });
    console.log('');

    console.log('💡 改进建议:');
    report.recommendations.forEach((rec, i) => {
      const priority = rec.priority === 'high' ? '🔴' : 
                      rec.priority === 'medium' ? '🟡' : '🟢';
      console.log(`   ${priority} ${i + 1}. ${rec.action}`);
      console.log(`      ${rec.reason}`);
    });
    console.log('');

    console.log(`💾 报告已保存: reports/model_monitor_${report.timestamp.split('T')[0]}.json`);
  }

  /**
   * 运行完整监控流程
   */
  async run() {
    console.log('🔍 模型性能监控系统');
    console.log('========================================');
    console.log('');

    try {
      // 加载数据
      console.log('📂 加载数据...');
      const vehicles = this.loadLatestData();
      console.log(`   ✅ 加载了 ${vehicles.length} 条记录`);
      console.log('');

      // 加载模型
      console.log('🧠 加载模型...');
      const predictor = this.loadModel();
      console.log('   ✅ 模型加载成功');
      console.log('');

      // 评估性能
      const metrics = this.evaluateModel(vehicles, predictor);

      // 检查健康状态
      const health = this.checkHealth(metrics);

      // 生成报告
      const report = this.generateReport(metrics, health);

      // 打印报告
      this.printReport(report);

      return report;

    } catch (error) {
      console.error('❌ 监控失败:', error.message);
      throw error;
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const monitor = new ModelMonitor();
  await monitor.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ModelMonitor };
