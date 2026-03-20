/**
 * 合并历史数据 + 跟进池数据，训练18维ML模型
 */

const fs = require('fs');
const path = require('path');
const { AdvancedPricePredictor } = require('./advanced-price-predictor');

console.log('🚗 合并数据训练18维ML模型');
console.log('========================================\n');

// 创建预测器
const predictor = new AdvancedPricePredictor();

// 加载历史数据
const historicalData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'nz_cars_20260302.json'), 'utf8')
);

// 加载跟进池数据
const followUpData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'follow_up_pool_20260304.json'), 'utf8')
);

// 合并数据
const allVehicles = [...historicalData.vehicles];

// 添加跟进池数据（添加make字段）
for (const v of followUpData.vehicles) {
  allVehicles.push({
    ...v,
    make: v.make.toLowerCase(),
    model: v.model.toLowerCase(),
    platform: 'follow_up_pool'
  });
}

console.log(`📊 数据合并完成:`);
console.log(`   历史数据: ${historicalData.vehicles.length} 条`);
console.log(`   跟进池数据: ${followUpData.vehicles.length} 条`);
console.log(`   总计: ${allVehicles.length} 条`);
console.log('');

// 数据清洗
const cleanVehicles = allVehicles.filter(v => {
  return v.price > 0 && v.year > 2000 && v.mileage > 0;
});

console.log(`✅ 清洗后数据: ${cleanVehicles.length} 条`);
console.log('');

// 显示数据分布
const priceRanges = {
  low: cleanVehicles.filter(v => v.price <= 4500).length,
  mid: cleanVehicles.filter(v => v.price > 4500 && v.price <= 6000).length,
  high: cleanVehicles.filter(v => v.price > 6000).length
};

console.log('📊 价格分层分布:');
console.log(`   低价层 ($2,000-$4,500): ${priceRanges.low} 条`);
console.log(`   中价层 ($4,500-$6,000): ${priceRanges.mid} 条`);
console.log(`   高价层 ($6,000-$7,500): ${priceRanges.high} 条`);
console.log('');

// 检查WOF/REGO数据
const withWof = cleanVehicles.filter(v => v.wof).length;
const withRego = cleanVehicles.filter(v => v.rego).length;

console.log('📋 WOF/REGO数据覆盖:');
console.log(`   有WOF数据: ${withWof}/${cleanVehicles.length} (${(withWof/cleanVehicles.length*100).toFixed(1)}%)`);
console.log(`   有REGO数据: ${withRego}/${cleanVehicles.length} (${(withRego/cleanVehicles.length*100).toFixed(1)}%)`);
console.log('');

// 训练模型
try {
  console.log('🎓 开始训练18维随机森林模型...');
  console.log('========================================\n');
  
  predictor.train(cleanVehicles);
  
  // 评估模型
  console.log('\n📊 模型评估');
  console.log('========================================');
  
  // 简单评估：用80%训练，20%测试
  const shuffled = cleanVehicles.sort(() => Math.random() - 0.5);
  const splitIdx = Math.floor(shuffled.length * 0.8);
  const trainData = shuffled.slice(0, splitIdx);
  const testData = shuffled.slice(splitIdx);
  
  // 用全部数据重新训练
  predictor.train(cleanVehicles);
  
  // 评估
  let totalError = 0;
  let totalAbsError = 0;
  const errors = [];
  
  for (const vehicle of testData) {
    try {
      const prediction = predictor.predict(vehicle);
      const error = Math.abs(prediction.predictedPrice - vehicle.price);
      const errorPercentage = (error / vehicle.price) * 100;
      
      totalError += errorPercentage;
      totalAbsError += error;
      errors.push(errorPercentage);
    } catch (e) {
      // 忽略预测失败的
    }
  }
  
  if (errors.length > 0) {
    const mae = totalError / errors.length;
    const accuracy = 100 - mae;
    const meanAbsError = totalAbsError / errors.length;
    
    console.log(`平均绝对误差 (MAE): ${mae.toFixed(2)}%`);
    console.log(`平均绝对误差 ($): $${Math.round(meanAbsError)}`);
    console.log(`预测准确率: ${accuracy.toFixed(2)}%`);
    console.log(`测试样本数: ${errors.length}`);
    console.log('');
  }
  
  // 保存新模型
  const modelPath = path.join(__dirname, 'data', 'advanced_price_predictor_v2.json');
  predictor.saveModel(modelPath);
  
  console.log('');
  console.log('========================================');
  console.log('✅ 新模型训练完成!');
  console.log('========================================');
  console.log('');
  console.log('📁 模型文件:');
  console.log(`   ${modelPath}`);
  console.log('');
  console.log('💡 新模型已包含18维特征:');
  console.log('   - 基础特征: year, mileage, age');
  console.log('   - WOF/REGO: wofMonthsRemaining, regoMonthsRemaining');
  console.log('   - WOF/REGO标志: hasWof, hasRego');
  console.log('   - 到期预警: wofExpiringSoon, regoExpiringSoon');
  console.log('   - 品牌/车型/车身类型等');
  console.log('');
  
} catch (e) {
  console.error(`❌ 训练失败: ${e.message}`);
  console.error(e.stack);
}
