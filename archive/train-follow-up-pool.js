/**
 * 使用跟进池数据训练ML模型（演示版）
 * 注意：跟进池样本量小，主要用于演示18维特征
 */

const fs = require('fs');
const path = require('path');
const { AdvancedPricePredictor } = require('./advanced-price-predictor');

console.log('🚗 跟进池车辆ML模型训练');
console.log('========================================\n');

// 创建预测器实例
const predictor = new AdvancedPricePredictor();

// 加载跟进池数据
const followUpData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'follow_up_pool_20260304.json'), 'utf8')
);

console.log(`📊 跟进池车辆数量: ${followUpData.totalCount}`);
console.log('');

// 展示每辆车的18维特征
console.log('📋 跟进池车辆特征分析（18维）');
console.log('========================================\n');

for (const vehicle of followUpData.vehicles) {
  console.log(`🚗 ${vehicle.year} ${vehicle.make.toUpperCase()} ${vehicle.model}`);
  console.log(`   价格: $${vehicle.price.toLocaleString()}`);
  console.log(`   里程: ${vehicle.mileage.toLocaleString()}km`);
  console.log(`   WOF: ${vehicle.wof || 'N/A'} (剩余${predictor.parseMonthsRemaining(vehicle.wof)}个月)`);
  console.log(`   Rego: ${vehicle.rego || 'N/A'} (剩余${predictor.parseMonthsRemaining(vehicle.rego)}个月)`);
  console.log(`   Flip Score: ${vehicle.flipScore}`);
  
  // 提取特征
  const features = predictor.extractFeatures(vehicle);
  console.log('');
  console.log('   18维特征:');
  console.log(`   - 基础: year=${features.year}, mileage=${features.mileage}, age=${features.age}`);
  console.log(`   - WOF/REGO: wofMonths=${features.wofMonthsRemaining}, regoMonths=${features.regoMonthsRemaining}`);
  console.log(`   - WOF/REGO标志: hasWof=${features.hasWof}, hasRego=${features.hasRego}`);
  console.log(`   - 即将到期: wofExpiringSoon=${features.wofExpiringSoon}, regoExpiringSoon=${features.regoExpiringSoon}`);
  console.log(`   - 品牌: makeToyota=${features.makeToyota}, makeMazda=${features.makeMazda}`);
  console.log(`   - 车型: modelCorolla=${features.modelCorolla}, modelVitz=${features.modelVitz}, modelAxela=${features.modelAxela}`);
  console.log('');
  console.log('----------------------------------------\n');
}

// 检查样本量是否足够训练
console.log('⚠️  样本量检查');
console.log('========================================');
console.log(`跟进池车辆: ${followUpData.totalCount} 辆`);
console.log('');
console.log('⚠️  注意: 随机森林模型需要每层至少10条数据');
console.log('   当前跟进池样本量不足以独立训练模型');
console.log('');
console.log('💡 建议:');
console.log('   1. 合并历史数据 (nz_cars_*.json) 进行训练');
console.log('   2. 或等待收集更多成交数据');
console.log('   3. 使用现有模型 (advanced_price_predictor.json)');
console.log('');

// 加载现有模型并预测跟进池车辆
console.log('📊 使用现有模型预测跟进池车辆');
console.log('========================================\n');

try {
  const modelPath = path.join(__dirname, 'data', 'advanced_price_predictor.json');
  predictor.loadModel(modelPath);
  
  console.log('');
  console.log('🏆 跟进池车辆预测结果');
  console.log('========================================');
  
  for (const vehicle of followUpData.vehicles) {
    const prediction = predictor.predict(vehicle);
    const sellPrice = prediction.predictedPrice;
    const prepCost = 400; // 预估整备成本
    const netProfit = sellPrice - vehicle.price - prepCost;
    const profitMargin = ((netProfit / vehicle.price) * 100).toFixed(1);
    
    // 计算建议出价
    const targetNetProfit = sellPrice * 0.30;
    const maxBuyPrice = Math.round(sellPrice - prepCost - targetNetProfit);
    const baseBid = Math.round(prediction.priceRange.min * 0.90);
    const suggestedBid = Math.min(baseBid, Math.round(vehicle.price * 0.95), maxBuyPrice);
    
    console.log('');
    console.log(`🚗 ${vehicle.year} ${vehicle.make.toUpperCase()} ${vehicle.model}`);
    console.log(`   当前价格: $${vehicle.price.toLocaleString()}`);
    console.log(`   预测售价: $${sellPrice.toLocaleString()} (置信度 ${(prediction.confidence * 100).toFixed(1)}%)`);
    console.log(`   整备成本: $${prepCost}`);
    console.log(`   净利润: $${netProfit.toLocaleString()} (${profitMargin}%)`);
    console.log(`   最高买入价: $${maxBuyPrice.toLocaleString()}`);
    console.log(`   建议出价: $${suggestedBid.toLocaleString()}`);
    
    if (vehicle.price <= maxBuyPrice) {
      console.log(`   ✅ 建议: 当前价格可接受，可尝试砍价到 $${suggestedBid.toLocaleString()}`);
    } else {
      console.log(`   ⚠️  建议: 价格偏高，需砍价至 $${maxBuyPrice.toLocaleString()} 以下`);
    }
  }
  
  console.log('');
  console.log('========================================');
  console.log('✅ 跟进池车辆分析完成!');
  console.log('========================================\n');
  
} catch (e) {
  console.error(`❌ 模型加载失败: ${e.message}`);
  console.log('');
  console.log('请确保模型文件存在: data/advanced_price_predictor.json');
}
