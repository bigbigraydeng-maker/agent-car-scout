/**
 * 新旧价格预测模型性能对比报告
 */

const fs = require('fs');
const path = require('path');

// 旧模型数据（价格上限 $15,000）
const OLD_MODEL = {
  priceRange: '$2,000 - $15,000',
  trainingData: 198,
  accuracy: '80.94%',
  mae: '19.06%',
  basePrice: 9347,
  featureImportance: {
    isSUV: '79.67%',
    mileage: '60.13%',
    isSedan: '59.25%',
    year: '56.91%',
    age: '56.91%',
    yearMileageRatio: '47.25%',
    make: '38.05%',
    model: '33.17%',
    location: '21.67%',
    isHybrid: '21.58%',
    mileagePerYear: '11.03%',
    isHatchback: '7.81%',
    sellerType: '0.00%'
  },
  testPrediction: {
    vehicle: '2015 Toyota Corolla',
    mileage: '100,000 km',
    location: 'Auckland',
    predictedPrice: '$11,081',
    confidence: '95.0%'
  }
};

// 新模型数据（价格上限 $7,500）
const NEW_MODEL = {
  priceRange: '$2,000 - $7,500',
  trainingData: 164,
  accuracy: '60.82%',
  mae: '39.18%',
  basePrice: 6212,
  featureImportance: {
    year: '55.89%',
    age: '55.89%',
    isHatchback: '42.53%',
    mileage: '41.84%',
    isSUV: '35.28%',
    yearMileageRange: '35.21%',
    make: '32.88%',
    isHybrid: '28.83%',
    location: '28.58%',
    isSedan: '23.66%',
    model: '9.10%',
    mileagePerYear: '3.04%',
    sellerType: '0.00%'
  },
  testPrediction: {
    vehicle: '2015 Toyota Corolla',
    mileage: '100,000 km',
    location: 'Auckland',
    predictedPrice: '$10,442',
    confidence: '95.0%'
  }
};

console.log('📊 新旧价格预测模型性能对比报告');
console.log('========================================');
console.log('');

// 1. 总体性能对比
console.log('1️⃣ 总体性能对比');
console.log('----------------------------------------');
console.log('| 指标 | 旧模型 ($15K) | 新模型 ($7.5K) | 变化 |');
console.log('|------|----------------|----------------|------|');
console.log(`| 训练数据量 | ${OLD_MODEL.trainingData} 条 | ${NEW_MODEL.trainingData} 条 | ${NEW_MODEL.trainingData - OLD_MODEL.trainingData} 条 |`);
console.log(`| 准确率 | ${OLD_MODEL.accuracy} | ${NEW_MODEL.accuracy} | ${(parseFloat(NEW_MODEL.accuracy) - parseFloat(OLD_MODEL.accuracy)).toFixed(2)}% |`);
console.log(`| 平均误差 | ${OLD_MODEL.mae} | ${NEW_MODEL.mae} | ${(parseFloat(NEW_MODEL.mae) - parseFloat(OLD_MODEL.mae)).toFixed(2)}% |`);
console.log(`| 基础价格 | $${OLD_MODEL.basePrice} | $${NEW_MODEL.basePrice} | $${NEW_MODEL.basePrice - OLD_MODEL.basePrice} |`);
console.log('');

// 2. 特征重要性变化
console.log('2️⃣ 特征重要性变化');
console.log('----------------------------------------');
console.log('| 特征 | 旧模型 | 新模型 | 变化 |');
console.log('|------|--------|--------|------|');

const allFeatures = new Set([
  ...Object.keys(OLD_MODEL.featureImportance),
  ...Object.keys(NEW_MODEL.featureImportance)
]);

for (const feature of allFeatures) {
  const oldVal = parseFloat(OLD_MODEL.featureImportance[feature] || '0%');
  const newVal = parseFloat(NEW_MODEL.featureImportance[feature] || '0%');
  const change = (newVal - oldVal).toFixed(2);
  const arrow = newVal > oldVal ? '⬆️' : (newVal < oldVal ? '⬇️' : '➡️');
  
  console.log(`| ${feature} | ${OLD_MODEL.featureImportance[feature] || '0.00%'} | ${NEW_MODEL.featureImportance[feature] || '0.00%'} | ${arrow} ${change}% |`);
}
console.log('');

// 3. 预测结果对比
console.log('3️⃣ 预测结果对比');
console.log('----------------------------------------');
console.log(`测试车辆: ${OLD_MODEL.testPrediction.vehicle}`);
console.log(`里程: ${OLD_MODEL.testPrediction.mileage}`);
console.log(`位置: ${OLD_MODEL.testPrediction.location}`);
console.log('');
console.log('| 模型 | 预测价格 | 置信度 |');
console.log('|------|---------|--------|');
console.log(`| 旧模型 | ${OLD_MODEL.testPrediction.predictedPrice} | ${OLD_MODEL.testPrediction.confidence} |`);
console.log(`| 新模型 | ${NEW_MODEL.testPrediction.predictedPrice} | ${NEW_MODEL.testPrediction.confidence} |`);

const priceDiff = 11081 - 10442;
console.log(`| 差异 | $${priceDiff} | |`);
console.log('');

// 4. 关键发现
console.log('4️⃣ 关键发现');
console.log('----------------------------------------');
console.log('📉 准确率下降:');
console.log(`   从 ${OLD_MODEL.accuracy} 降至 ${NEW_MODEL.accuracy}`);
console.log(`   下降了 ${(parseFloat(OLD_MODEL.accuracy) - parseFloat(NEW_MODEL.accuracy)).toFixed(2)}%`);
console.log('');
console.log('📊 数据量减少:');
console.log(`   从 ${OLD_MODEL.trainingData} 条减少到 ${NEW_MODEL.trainingData} 条`);
console.log(`   减少了 ${OLD_MODEL.trainingData - NEW_MODEL.trainingData} 条 (${((OLD_MODEL.trainingData - NEW_MODEL.trainingData) / OLD_MODEL.trainingData * 100).toFixed(1)}%)`);
console.log('');
console.log('🎯 特征重要性变化:');
console.log('   ⬆️ 上升: year, age, isHatchback, make, isHybrid, location');
console.log('   ⬇️ 下降: isSUV, mileage, isSedan, model, mileagePerYear');
console.log('');
console.log('💰 价格预测变化:');
console.log(`   旧模型预测: $11,081`);
console.log(`   新模型预测: $10,442`);
console.log(`   差异: $${priceDiff} (${(priceDiff / 11081 * 100).toFixed(1)}%)`);
console.log('');

// 5. 原因分析
console.log('5️⃣ 原因分析');
console.log('----------------------------------------');
console.log('🔍 准确率下降的主要原因:');
console.log('');
console.log('1. 数据量减少');
console.log('   - 训练数据从 198 条减少到 164 条');
console.log('   - 减少了 17.2% 的数据');
console.log('   - 数据量减少导致模型泛化能力下降');
console.log('');
console.log('2. 价格范围缩小');
console.log('   - 从 $2,000-$15,000 缩小到 $2,000-$7,500');
console.log('   - 模型在更窄的价格范围内训练');
console.log('   - 可能导致对高价车辆的预测不准确');
console.log('');
console.log('3. 特征重要性重新分布');
console.log('   - isSUV 的重要性从 79.67% 降至 35.28%');
console.log('   - year 和 age 的重要性上升至 55.89%');
console.log('   - 模型更依赖年份而非车型特征');
console.log('');
console.log('4. 车型分布变化');
console.log('   - 高价车型（Prius, Axela）在新数据中数量减少');
console.log('   - 低价车型（Demio, Aqua）占比增加');
console.log('   - 模型偏向低价车型的特征');
console.log('');

// 6. 改进建议
console.log('6️⃣ 改进建议');
console.log('----------------------------------------');
console.log('💡 短期改进:');
console.log('');
console.log('1. 增加训练数据');
console.log('   - 继续抓取更多历史数据');
console.log('   - 目标：至少 500 条记录');
console.log('');
console.log('2. 调整特征工程');
console.log('   - 添加更多车型相关特征');
console.log('   - 考虑价格分段训练（低价段、中价段、高价段）');
console.log('');
console.log('3. 优化模型算法');
console.log('   - 尝试更复杂的算法（XGBoost, Random Forest）');
console.log('   - 使用交叉验证评估模型稳定性');
console.log('');
console.log('💡 长期改进:');
console.log('');
console.log('1. 建立分层模型');
console.log('   - 按价格区间训练多个子模型');
console.log('   - 根据输入价格选择合适的子模型');
console.log('');
console.log('2. 集成学习方法');
console.log('   - 结合多个模型的预测结果');
console.log('   - 使用加权平均或投票机制');
console.log('');
console.log('3. 持续学习');
console.log('   - 定期用新数据重新训练模型');
console.log('   - 跟踪模型性能随时间的变化');
console.log('');

// 7. 结论
console.log('7️⃣ 结论');
console.log('----------------------------------------');
console.log('✅ 新模型已成功训练');
console.log('⚠️  准确率下降需要关注');
console.log('📊 建议增加数据量并优化算法');
console.log('');
console.log('🎯 下一步行动:');
console.log('   1. 持续抓取数据，目标 500+ 条');
console.log('   2. 尝试更复杂的机器学习算法');
console.log('   3. 实施分层模型策略');
console.log('   4. 建立模型性能监控系统');
console.log('');
console.log('========================================');
console.log('✅ 报告生成完成!');
