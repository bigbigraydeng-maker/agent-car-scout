/**
 * Daily Auto Training Pipeline
 * 每日自动训练流水线
 * 
 * 执行顺序：
 * 1. 采集已售车辆数据（目标50条/天）
 * 2. 合并到训练数据集
 * 3. 重新训练价格预测模型
 * 4. 评估模型性能
 * 5. 保存模型并生成报告
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * 记录日志
 */
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * 执行命令并返回输出
 */
function runCommand(cmd) {
  log(`执行: ${cmd}`);
  try {
    const output = execSync(cmd, { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: 'pipe' });
    return output;
  } catch (e) {
    log(`命令失败: ${e.message}`);
    return null;
  }
}

/**
 * 步骤1: 采集已售数据
 */
async function collectSoldData() {
  log('\n📋 步骤1: 采集已售车辆数据...');
  
  try {
    const collect = require('./collect-sold-data');
    const added = await collect.main();
    log(`✅ 采集完成: +${added} 条记录`);
    return added;
  } catch (e) {
    log(`❌ 采集失败: ${e.message}`);
    return 0;
  }
}

/**
 * 步骤2: 训练模型
 */
function trainModel() {
  log('\n🎓 步骤2: 训练价格预测模型...');
  
  try {
    const AdvancedPricePredictor = require('./advanced-price-predictor').AdvancedPricePredictor;
    
    // 加载训练数据
    const trainingFile = path.join(DATA_DIR, 'training_data_combined.json');
    if (!fs.existsSync(trainingFile)) {
      log('⚠️ 无训练数据文件');
      return null;
    }
    
    const data = JSON.parse(fs.readFileSync(trainingFile, 'utf8'));
    const vehicles = data.vehicles || [];
    
    if (vehicles.length < 50) {
      log(`⚠️ 训练数据不足: ${vehicles.length} 条（需要至少50条）`);
      return null;
    }
    
    log(`📊 训练数据: ${vehicles.length} 条`);
    
    // 分割训练/测试集
    const shuffled = [...vehicles].sort(() => Math.random() - 0.5);
    const trainSize = Math.floor(shuffled.length * 0.8);
    const trainData = shuffled.slice(0, trainSize);
    const testData = shuffled.slice(trainSize);
    
    // 训练模型
    const predictor = new AdvancedPricePredictor();
    predictor.train(trainData);
    
    // 评估
    log('\n📊 评估模型性能...');
    const performance = predictor.evaluate(testData);
    
    // 保存模型
    const modelPath = path.join(DATA_DIR, 'advanced_price_predictor.json');
    
    // 备份旧模型
    if (fs.existsSync(modelPath)) {
      const backupPath = path.join(DATA_DIR, `advanced_price_predictor_backup_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.json`);
      fs.copyFileSync(modelPath, backupPath);
      log(`💾 旧模型已备份: ${backupPath}`);
    }
    
    predictor.saveModel(modelPath);
    log(`✅ 新模型已保存: ${modelPath}`);
    
    return {
      trainingSamples: trainData.length,
      testSamples: testData.length,
      performance: performance
    };
    
  } catch (e) {
    log(`❌ 训练失败: ${e.message}`);
    return null;
  }
}

/**
 * 步骤3: 生成训练报告
 */
function generateReport(trainingResult) {
  log('\n📊 步骤3: 生成训练报告...');
  
  try {
    const report = {
      generatedAt: new Date().toISOString(),
      training: trainingResult,
      dataStats: getDataStats(),
      recommendations: generateRecommendations(trainingResult)
    };
    
    const reportPath = path.join(DATA_DIR, `daily_training_report_${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    log(`✅ 报告已保存: ${reportPath}`);
    return report;
    
  } catch (e) {
    log(`⚠️ 报告生成失败: ${e.message}`);
    return null;
  }
}

/**
 * 获取数据统计
 */
function getDataStats() {
  try {
    const soldFile = path.join(DATA_DIR, 'sold_vehicles.json');
    const trainingFile = path.join(DATA_DIR, 'training_data_combined.json');
    
    let soldCount = 0;
    let trainingCount = 0;
    
    if (fs.existsSync(soldFile)) {
      const sold = JSON.parse(fs.readFileSync(soldFile, 'utf8'));
      soldCount = sold.length;
    }
    
    if (fs.existsSync(trainingFile)) {
      const training = JSON.parse(fs.readFileSync(trainingFile, 'utf8'));
      trainingCount = training.vehicles?.length || 0;
    }
    
    return { soldCount, trainingCount };
    
  } catch (e) {
    return { soldCount: 0, trainingCount: 0 };
  }
}

/**
 * 生成改进建议
 */
function generateRecommendations(result) {
  const recommendations = [];
  
  if (!result) {
    recommendations.push('模型训练失败，请检查训练数据');
    return recommendations;
  }
  
  const accuracy = parseFloat(result.performance?.accuracy || 0);
  
  if (accuracy < 70) {
    recommendations.push('⚠️ 模型准确率偏低(<70%)，建议增加训练数据量');
  } else if (accuracy < 80) {
    recommendations.push('模型准确率有提升空间，建议补充更多品牌数据');
  } else {
    recommendations.push('✅ 模型准确率良好');
  }
  
  if (result.trainingSamples < 200) {
    recommendations.push(`训练数据量(${result.trainingSamples})偏少，建议持续收集已售数据`);
  }
  
  return recommendations;
}

/**
 * 主流程
 */
async function main() {
  console.log('\n' + '='.repeat(50));
  console.log('🚗 Car Scout - 每日自动训练流水线');
  console.log(`⏰ ${new Date().toLocaleString('zh-CN')}`);
  console.log('='.repeat(50) + '\n');
  
  const startTime = Date.now();
  
  // 步骤1: 采集数据
  const collected = await collectSoldData();
  
  // 步骤2: 训练模型
  const trainingResult = trainModel();
  
  // 步骤3: 生成报告
  const report = generateReport(trainingResult);
  
  // 总结
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(50));
  console.log('📋 训练总结');
  console.log('='.repeat(50));
  console.log(`采集数据: ${collected} 条`);
  console.log(`训练样本: ${trainingResult?.trainingSamples || 0} 条`);
  console.log(`模型准确率: ${trainingResult?.performance?.accuracy || 'N/A'}%`);
  console.log(`执行时间: ${duration} 秒`);
  
  if (report?.recommendations) {
    console.log('\n💡 建议:');
    report.recommendations.forEach(r => console.log(`  - ${r}`));
  }
  
  console.log('='.repeat(50));
  console.log('✅ 每日训练完成！\n');
}

// 运行
if (require.main === module) {
  main().catch(e => {
    console.error('❌ 训练流水线失败:', e);
    process.exit(1);
  });
}

module.exports = { main, collectSoldData, trainModel };
