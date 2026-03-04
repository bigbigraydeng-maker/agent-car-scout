/**
 * 使用新模型(v2)评估跟进池车辆
 */

const fs = require('fs');
const path = require('path');
const { AdvancedPricePredictor } = require('./advanced-price-predictor');

console.log('🚗 新模型(v2)跟进池车辆评估');
console.log('========================================\n');

const predictor = new AdvancedPricePredictor();

// 加载新模型
const modelPath = path.join(__dirname, 'data', 'advanced_price_predictor_v2.json');
predictor.loadModel(modelPath);

// 加载跟进池数据
const followUpData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'follow_up_pool_20260304.json'), 'utf8')
);

console.log('');
console.log('🏆 新模型(v2)预测结果 - 18维特征');
console.log('========================================');
console.log('');

const results = [];

for (const vehicle of followUpData.vehicles) {
  const prediction = predictor.predict(vehicle);
  const sellPrice = prediction.predictedPrice;
  const prepCost = 400;
  const netProfit = sellPrice - vehicle.price - prepCost;
  const profitMargin = ((netProfit / vehicle.price) * 100).toFixed(1);
  
  // 计算建议出价
  const targetNetProfit = sellPrice * 0.30;
  const maxBuyPrice = Math.round(sellPrice - prepCost - targetNetProfit);
  const baseBid = Math.round(prediction.priceRange.min * 0.90);
  const suggestedBid = Math.min(baseBid, Math.round(vehicle.price * 0.95), maxBuyPrice);
  
  // WOF/REGO分析
  const wofMonths = predictor.parseMonthsRemaining(vehicle.wof);
  const regoMonths = predictor.parseMonthsRemaining(vehicle.rego);
  
  results.push({
    vehicle,
    prediction,
    sellPrice,
    netProfit,
    profitMargin,
    maxBuyPrice,
    suggestedBid,
    wofMonths,
    regoMonths
  });
  
  console.log(`🚗 ${vehicle.year} ${vehicle.make.toUpperCase()} ${vehicle.model}`);
  console.log(`   当前价格: $${vehicle.price.toLocaleString()}`);
  console.log(`   WOF: ${vehicle.wof || 'N/A'} (剩余${wofMonths}个月)`);
  console.log(`   Rego: ${vehicle.rego || 'N/A'} (剩余${regoMonths}个月)`);
  console.log(`   预测售价: $${sellPrice.toLocaleString()} (置信度 ${(prediction.confidence * 100).toFixed(1)}%)`);
  console.log(`   净利润: $${netProfit.toLocaleString()} (${profitMargin}%)`);
  console.log(`   最高买入价: $${maxBuyPrice.toLocaleString()}`);
  console.log(`   建议出价: $${suggestedBid.toLocaleString()}`);
  
  if (vehicle.price <= maxBuyPrice) {
    console.log(`   ✅ 建议: 当前价格可接受`);
  } else {
    console.log(`   ⚠️  建议: 需砍价至 $${maxBuyPrice.toLocaleString()} 以下`);
  }
  console.log('');
}

// 排名
console.log('========================================');
console.log('📊 跟进池车辆利润排名 (新模型)');
console.log('========================================');
console.log('');

results.sort((a, b) => b.netProfit - a.netProfit);

results.forEach((r, idx) => {
  const rank = idx + 1;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
  console.log(`${medal} ${r.vehicle.year} ${r.vehicle.make.toUpperCase()} ${r.vehicle.model}`);
  console.log(`    价格: $${r.vehicle.price.toLocaleString()} → 预测售价: $${r.sellPrice.toLocaleString()}`);
  console.log(`    净利润: $${r.netProfit.toLocaleString()} (${r.profitMargin}%)`);
  console.log('');
});

console.log('========================================');
console.log('✅ 新模型评估完成!');
console.log('========================================');
console.log('');
console.log('📊 模型对比:');
console.log('   v1 (旧): 准确率 89.59%, 基于50条数据');
console.log('   v2 (新): 准确率 85.42%, 基于171条数据 + 18维特征');
console.log('');
console.log('💡 v2模型优势:');
console.log('   - 包含WOF/REGO时间特征');
console.log('   - 数据量更大 (171条 vs 50条)');
console.log('   - 覆盖更多车型和价格区间');
console.log('');
