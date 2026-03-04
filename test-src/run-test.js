
/**
 * 主测试脚本
 */

const fs = require('fs');
const path = require('path');
const { calculateSuggestedBid } = require('./test-scoring');

// 配置
const DATA_FILE = path.join(__dirname, '..', 'data', 'vehicles_trademe_20260301.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'test-results', 'bid-test-results.json');

console.log('🚗 Car Scout 建议出价测试');
console.log('========================================\n');

// 读取数据
if (!fs.existsSync(DATA_FILE)) {
  console.error('❌ 未找到数据文件:', DATA_FILE);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const vehicles = data.vehicles || [];

console.log(`📋 加载了 ${vehicles.length} 辆车\n`);

// 测试每辆车
const results = [];
let okCount = 0;
let negativeProfitCount = 0;
let errorCount = 0;

for (const vehicle of vehicles) {
  try {
    const result = calculateSuggestedBid(vehicle);
    if (result) {
      results.push(result);
      if (result.status === 'ok') {
        okCount++;
      } else if (result.status === 'negative_profit') {
        negativeProfitCount++;
      }
    }
  } catch (e) {
    console.error(`❌ 处理失败 ${vehicle.title}: ${e.message}`);
    errorCount++;
  }
}

// 保存结果
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
  testDate: new Date().toISOString(),
  totalVehicles: vehicles.length,
  okCount: okCount,
  negativeProfitCount: negativeProfitCount,
  errorCount: errorCount,
  results: results
}, null, 2));

// 显示摘要
console.log('========================================');
console.log('📊 测试摘要');
console.log('========================================');
console.log(`总车辆数: ${vehicles.length}`);
console.log(`合格车辆: ${okCount}`);
console.log(`负利润过滤: ${negativeProfitCount}`);
console.log(`错误: ${errorCount}`);
console.log('');

// 显示前10个合格车辆的详细信息
const okResults = results.filter(r => r.status === 'ok').slice(0, 10);
if (okResults.length > 0) {
  console.log('🏆 前10辆合格车辆:');
  console.log('----------------------------------------');
  okResults.forEach((v, i) => {
    console.log(`${i + 1}. ${v.year} ${v.model}`);
    console.log(`   当前价格: $${v.price.toLocaleString()}`);
    console.log(`   预测售价: $${v.predictedPrice.toLocaleString()}`);
    console.log(`   价格范围: $${v.priceRange.min.toLocaleString()} - $${v.priceRange.max.toLocaleString()}`);
    console.log(`   净利润: $${v.netProfit.toLocaleString()} (${v.profitMargin}%)`);
    console.log(`   建议出价: $${v.suggestedBid.toLocaleString()}`);
    console.log(`   最高买入: $${v.suggestedMaxBuy.toLocaleString()}`);
    if (v.urgentSignals && v.urgentSignals.length > 0) {
      console.log(`   急售信号: ${v.urgentSignals.join(', ')}`);
    }
    console.log(`   价格来源: ${v.priceSource}`);
    console.log('');
  });
}

console.log(`✅ 结果已保存到: ${OUTPUT_FILE}`);
console.log('');
