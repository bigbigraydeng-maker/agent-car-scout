/**
 * 使用新模型分析当前市场机会
 * 输出带链接的评估报告
 */

const fs = require('fs');
const path = require('path');
const { AdvancedPricePredictor } = require('./advanced-price-predictor');

console.log('🚗 当前市场机会分析 (新模型v2)');
console.log('========================================\n');

const predictor = new AdvancedPricePredictor();

// 加载新模型
const modelPath = path.join(__dirname, 'data', 'advanced_price_predictor.json');
predictor.loadModel(modelPath);
console.log(`📊 模型准确率: ${predictor.modelPerformance.accuracy}%`);
console.log('');

// 加载FB数据
const fbData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'fb_search_all.json'), 'utf8')
);

// 筛选符合条件的车辆
const qualifiedVehicles = fbData.vehicles.filter(v => {
  const yearOk = v.year >= 2006;
  const mileageOk = v.mileage > 0 && v.mileage <= 180000;
  const priceOk = v.price >= 2000 && v.price <= 7500;
  const notDealer = !v.isDealer;
  return yearOk && mileageOk && priceOk && notDealer;
});

console.log(`📊 总车辆: ${fbData.vehicles.length}`);
console.log(`✅ 符合条件的车辆: ${qualifiedVehicles.length}`);
console.log('');

// 评估每辆车
const results = [];

for (const vehicle of qualifiedVehicles) {
  try {
    // 添加make字段
    const v = {
      ...vehicle,
      make: vehicle.model.toLowerCase() === 'corolla' || vehicle.model.toLowerCase() === 'vitz' || 
            vehicle.model.toLowerCase() === 'rav4' || vehicle.model.toLowerCase() === 'wish' ||
            vehicle.model.toLowerCase() === 'aqua' || vehicle.model.toLowerCase() === 'prius' ? 'toyota' :
            vehicle.model.toLowerCase() === 'fit' || vehicle.model.toLowerCase() === 'civic' ? 'honda' :
            vehicle.model.toLowerCase() === 'demio' || vehicle.model.toLowerCase() === 'axela' ? 'mazda' :
            vehicle.model.toLowerCase() === 'swift' ? 'suzuki' :
            vehicle.model.toLowerCase() === 'tiida' ? 'nissan' : 'toyota'
    };
    
    const prediction = predictor.predict(v);
    const sellPrice = prediction.predictedPrice;
    const prepCost = 400;
    const netProfit = sellPrice - v.price - prepCost;
    const profitMargin = ((netProfit / v.price) * 100);
    
    // 只保留净利润>500且利润率>20%的车
    if (netProfit >= 500 && profitMargin >= 20) {
      const targetNetProfit = sellPrice * 0.30;
      const maxBuyPrice = Math.round(sellPrice - prepCost - targetNetProfit);
      
      results.push({
        vehicle: v,
        prediction,
        sellPrice,
        netProfit,
        profitMargin,
        maxBuyPrice,
        url: v.listingUrl
      });
    }
  } catch (e) {
    // 预测失败跳过
  }
}

// 按净利润排序
results.sort((a, b) => b.netProfit - a.netProfit);

// 输出报告
console.log('🏆 TOP 市场机会 (新模型预测)');
console.log('========================================');
console.log(`找到 ${results.length} 辆高利润车辆\n`);

const top10 = results.slice(0, 10);

top10.forEach((r, idx) => {
  const rank = idx + 1;
  const v = r.vehicle;
  
  console.log(`${rank}. 🚗 ${v.year} ${v.make.toUpperCase()} ${v.model}`);
  console.log(`   💰 当前价格: $${v.price.toLocaleString()}`);
  console.log(`   📈 预测售价: $${r.sellPrice.toLocaleString()}`);
  console.log(`   💵 净利润: $${r.netProfit.toLocaleString()} (${r.profitMargin.toFixed(1)}%)`);
  console.log(`   🎯 最高买入: $${r.maxBuyPrice.toLocaleString()}`);
  console.log(`   📍 位置: ${v.location}`);
  console.log(`   🔗 链接: ${v.listingUrl}`);
  
  if (v.wof) console.log(`   📝 WOF: ${v.wof}`);
  if (v.description && v.description.length > 20) {
    console.log(`   📝 描述: ${v.description.substring(0, 100)}...`);
  }
  
  console.log('');
});

// 保存详细报告
const reportPath = path.join(__dirname, 'reports', `market_opportunities_${new Date().toISOString().split('T')[0]}.json`);
const report = {
  generatedAt: new Date().toISOString(),
  modelAccuracy: predictor.modelPerformance.accuracy,
  totalScanned: fbData.vehicles.length,
  qualified: qualifiedVehicles.length,
  opportunities: results.length,
  top10: top10.map(r => ({
    year: r.vehicle.year,
    make: r.vehicle.make,
    model: r.vehicle.model,
    price: r.vehicle.price,
    mileage: r.vehicle.mileage,
    predictedPrice: r.sellPrice,
    netProfit: r.netProfit,
    profitMargin: r.profitMargin,
    maxBuyPrice: r.maxBuyPrice,
    location: r.vehicle.location,
    url: r.vehicle.listingUrl,
    wof: r.vehicle.wof,
    rego: r.vehicle.rego,
    description: r.vehicle.description
  }))
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('========================================');
console.log('✅ 市场机会分析完成!');
console.log('========================================');
console.log('');
console.log(`📁 详细报告已保存: ${reportPath}`);
console.log('');
console.log('💡 建议行动:');
if (results.length > 0) {
  console.log(`   发现 ${results.length} 辆高利润车辆，建议优先联系前3辆`);
} else {
  console.log('   当前市场暂无高利润机会，建议继续等待');
}
console.log('');
