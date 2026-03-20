/**
 * 验证新部署的评分系统 - 使用当前目录的文件
 */
const fs = require('fs');
const path = require('path');
const { scoreVehicles } = require('./src/scoring-v3');
const { generateReport, generateShortReport } = require('./src/report');

console.log('='.repeat(60));
console.log('🚗 Car Scout - 验证部署（当前目录）');
console.log('='.repeat(60));

const dataDir = path.join(__dirname, 'data');
const vehiclesPath = path.join(dataDir, 'vehicles_trademe_20260301.json');

console.log('\n📂 加载车辆数据...');
const data = JSON.parse(fs.readFileSync(vehiclesPath, 'utf8'));
const vehicles = data.vehicles || data;
console.log('   车辆数量:', vehicles.length);

console.log('\n🔍 开始评分（最低利润率：10%）...');
const scored = scoreVehicles(vehicles);
console.log('   合格车辆:', scored.length);

console.log('\n🏆 TOP 10:');
scored.slice(0, 10).forEach((v, i) => {
  console.log(`${i + 1}. ${v.flipGrade} | ${v.year} ${v.model} | $${v.price} | 净赚$${v.estimatedNetProfit}(${v.profitMargin}%)`);
});

console.log('\n📋 生成报告...');
const shortReport = generateShortReport(scored);
console.log('\n========== SHORT REPORT ==========');
console.log(shortReport);

// 保存结果
const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
const scoredPath = path.join(dataDir, `scored_${dateStr}_deployed.json`);
fs.writeFileSync(scoredPath, JSON.stringify({
  scoredDate: new Date().toISOString(),
  version: '3.1-deployed',
  minProfitMargin: 0.10,
  totalScanned: vehicles.length,
  totalQualified: scored.length,
  vehicles: scored
}, null, 2));
console.log('\n💾 已保存:', scoredPath);

console.log('='.repeat(60));
console.log('✅ 验证完成！当前目录的文件可以正常使用！');
console.log('='.repeat(60));
