/**
 * 详细预测计算思路展示
 */

const fs = require('fs');
const path = require('path');
const { AdvancedPricePredictor } = require('./advanced-price-predictor');

console.log('🚗 详细预测计算思路展示');
console.log('========================================\n');

// 加载价格预测模型
const pricePredictor = new AdvancedPricePredictor();
const modelPath = path.join(__dirname, 'data', 'advanced_price_predictor.json');

if (fs.existsSync(modelPath)) {
  pricePredictor.loadModel(modelPath);
  console.log('');
} else {
  console.log('⚠️  未找到模型文件\n');
  process.exit(1);
}

// 测试车辆（来自昨天的报告）
const testVehicles = [
  {
    title: '2007 RAV4',
    make: 'toyota',
    model: 'RAV4',
    year: 2007,
    price: 2750,
    mileage: 88000,
    location: 'Albany, Auckland',
    sellerType: 'private',
    prepCost: 500
  },
  {
    title: '2007 Corolla',
    make: 'toyota',
    model: 'Corolla',
    year: 2007,
    price: 2750,
    mileage: 153000,
    location: 'Palmerston North',
    sellerType: 'private',
    prepCost: 300,
    urgentSignals: ['ono']
  },
  {
    title: '2009 Vitz',
    make: 'toyota',
    model: 'Vitz',
    year: 2009,
    price: 4800,
    mileage: 148000,
    location: 'Auckland City',
    sellerType: 'private',
    prepCost: 300,
    urgentSignals: ['ono']
  }
];

for (const vehicle of testVehicles) {
  console.log('========================================');
  console.log(`🚗 ${vehicle.title}`);
  console.log('========================================\n');
  
  // 步骤1: 获取预测价格
  console.log('📊 步骤1: 价格预测计算');
  console.log('----------------------------------------');
  console.log('输入特征:');
  console.log(`   年份: ${vehicle.year}`);
  console.log(`   里程: ${vehicle.mileage.toLocaleString()} km`);
  console.log(`   位置: ${vehicle.location}`);
  console.log(`   卖家类型: ${vehicle.sellerType}`);
  
  const prediction = pricePredictor.predict(vehicle);
  
  console.log('\n预测结果:');
  console.log(`   预测售价: $${prediction.predictedPrice.toLocaleString()}`);
  console.log(`   价格范围: $${prediction.priceRange.min.toLocaleString()} - $${prediction.priceRange.max.toLocaleString()}`);
  console.log(`   置信度: ${(prediction.confidence * 100).toFixed(1)}%`);
  
  console.log('\n分层预测详情:');
  for (const tp of prediction.tierPredictions) {
    console.log(`   ${tp.tier}层: $${Math.round(tp.price).toLocaleString()} (${(tp.confidence * 100).toFixed(0)}% 置信度)`);
  }
  
  // 步骤2: 计算净利润和目标利润
  console.log('\n💰 步骤2: 利润计算');
  console.log('----------------------------------------');
  const sellPrice = prediction.predictedPrice;
  const prepCost = vehicle.prepCost;
  const currentPrice = vehicle.price;
  const netProfit = sellPrice - currentPrice - prepCost;
  const profitMargin = Math.round((netProfit / currentPrice) * 100);
  
  console.log(`   预测售价: $${sellPrice.toLocaleString()}`);
  console.log(`   减去当前价格: $${currentPrice.toLocaleString()}`);
  console.log(`   减去整备成本: $${prepCost.toLocaleString()}`);
  console.log(`   = 净利润: $${netProfit.toLocaleString()} (${profitMargin}%)`);
  
  const targetNetProfit = sellPrice * 0.30;
  const suggestedMaxBuy = Math.round(sellPrice - prepCost - targetNetProfit);
  
  console.log('\n   目标利润 (30%): $${targetNetProfit.toLocaleString()}');
  console.log(`   最高买入价 = 预测售价 - 整备成本 - 目标利润`);
  console.log(`   = $${sellPrice.toLocaleString()} - $${prepCost.toLocaleString()} - $${targetNetProfit.toLocaleString()}`);
  console.log(`   = $${suggestedMaxBuy.toLocaleString()}`);
  
  // 步骤3: 计算基础出价
  console.log('\n🎯 步骤3: 基础出价计算');
  console.log('----------------------------------------');
  const priceRange = prediction.priceRange;
  let baseBid = Math.round(priceRange.min * 0.90);
  
  console.log(`   价格范围下限: $${priceRange.min.toLocaleString()}`);
  console.log(`   基础出价 = 价格范围下限 × 90%`);
  console.log(`   = $${priceRange.min.toLocaleString()} × 0.90`);
  console.log(`   = $${baseBid.toLocaleString()}`);
  
  // 步骤4: 调整因素
  console.log('\n⚙️  步骤4: 调整因素');
  console.log('----------------------------------------');
  
  if (vehicle.urgentSignals && vehicle.urgentSignals.length > 0) {
    console.log(`   ✅ 急售信号: ${vehicle.urgentSignals.join(', ')} → 额外 5% 折扣`);
    baseBid = Math.round(baseBid * 0.95);
    console.log(`   → 调整后基础出价: $${baseBid.toLocaleString()}`);
  } else {
    console.log('   ⚪ 无急售信号');
  }
  
  const daysListed = vehicle.daysListed || 0;
  if (daysListed > 21) {
    console.log(`   ✅ 挂牌超过21天 → 额外 8% 折扣`);
    baseBid = Math.round(baseBid * 0.92);
    console.log(`   → 调整后基础出价: $${baseBid.toLocaleString()}`);
  } else if (daysListed > 14) {
    console.log(`   ✅ 挂牌超过14天 → 额外 5% 折扣`);
    baseBid = Math.round(baseBid * 0.95);
    console.log(`   → 调整后基础出价: $${baseBid.toLocaleString()}`);
  } else if (daysListed > 7) {
    console.log(`   ✅ 挂牌超过7天 → 额外 3% 折扣`);
    baseBid = Math.round(baseBid * 0.97);
    console.log(`   → 调整后基础出价: $${baseBid.toLocaleString()}`);
  } else {
    console.log('   ⚪ 无挂牌天数调整');
  }
  
  // 步骤5: 最终出价限制
  console.log('\n📋 步骤5: 最终出价限制');
  console.log('----------------------------------------');
  
  const maxBidFromCurrent = Math.round(currentPrice * 0.95);
  const minBidFromCurrent = Math.round(currentPrice * 0.70);
  
  console.log(`   限制1: 不超过当前价格的 95%`);
  console.log(`   = $${currentPrice.toLocaleString()} × 0.95 = $${maxBidFromCurrent.toLocaleString()}`);
  
  console.log(`\n   限制2: 不超过最高买入价`);
  console.log(`   = $${suggestedMaxBuy.toLocaleString()}`);
  
  console.log(`\n   限制3: 不低于当前价格的 70%`);
  console.log(`   = $${currentPrice.toLocaleString()} × 0.70 = $${minBidFromCurrent.toLocaleString()}`);
  
  // 步骤6: 计算最终建议出价
  console.log('\n✨ 步骤6: 最终建议出价');
  console.log('----------------------------------------');
  
  let suggestedBid = Math.min(baseBid, maxBidFromCurrent, suggestedMaxBuy);
  suggestedBid = Math.max(suggestedBid, minBidFromCurrent);
  
  console.log(`   候选出价1 (调整后基础出价): $${baseBid.toLocaleString()}`);
  console.log(`   候选出价2 (当前价格95%): $${maxBidFromCurrent.toLocaleString()}`);
  console.log(`   候选出价3 (最高买入价): $${suggestedMaxBuy.toLocaleString()}`);
  console.log(`\n   取最小值: $${Math.min(baseBid, maxBidFromCurrent, suggestedMaxBuy).toLocaleString()}`);
  console.log(`\n   与最低出价 (70%) 比较:`);
  console.log(`   min($${Math.min(baseBid, maxBidFromCurrent, suggestedMaxBuy).toLocaleString()}, $${minBidFromCurrent.toLocaleString()})`);
  console.log(`   → 最终建议出价: $${suggestedBid.toLocaleString()}`);
  
  // 总结
  console.log('\n📊 总结');
  console.log('----------------------------------------');
  console.log(`当前价格: $${currentPrice.toLocaleString()}`);
  console.log(`预测售价: $${sellPrice.toLocaleString()}`);
  console.log(`净利润: $${netProfit.toLocaleString()} (${profitMargin}%)`);
  console.log(`建议出价: $${suggestedBid.toLocaleString()}`);
  console.log(`最高买入: $${suggestedMaxBuy.toLocaleString()}`);
  console.log('');
}

console.log('========================================');
console.log('✅ 详细计算思路展示完成!');
console.log('========================================\n');

console.log('💡 核心算法要点:');
console.log('  1. 使用随机森林预测模型（12个维度，89.59%准确率）');
console.log('  2. 30%目标净利润为最高买入价上限');
console.log('  3. 基础出价基于预测价格范围下限×90%');
console.log('  4. 考虑急售信号和挂牌天数进行折扣调整');
console.log('  5. 最终出价不超过当前价格95%，不低于70%');
console.log('');
