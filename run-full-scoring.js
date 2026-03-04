/**
 * 完整的评分流程：
 * 1. 加载车辆数据
 * 2. 运行v3.1评分（含黑名单过滤和三级混合模型）
 * 3. 生成报告
 */

const fs = require('fs');
const path = require('path');
const { scoreVehicles } = require('./src/scoring-v3');
const { generateReport, generateShortReport } = require('./src/report');

console.log('='.repeat(60));
console.log('🚗 Car Scout - 完整评分流程（v3.1 三级混合模型）');
console.log('='.repeat(60));

const dataDir = path.join(__dirname, 'data');

// Step 1: 加载车辆数据
console.log('\n📂 Step 1: 加载车辆数据...');
const vehiclesPath = path.join(dataDir, 'vehicles_trademe_20260301.json');
const data = JSON.parse(fs.readFileSync(vehiclesPath, 'utf8'));
let vehicles = data.vehicles || data;
console.log('   原始车辆数:', vehicles.length);

// Step 2: 运行评分（scoring-v3.js 内部已包含黑名单过滤）
console.log('\n🔍 Step 2: 运行评分（最低利润率：10%，三级混合估价模型）...');
const scored = scoreVehicles(vehicles);
console.log('   合格车辆数:', scored.length);

// Step 4: 显示结果
console.log('\n🏆 TOP 10:');
scored.slice(0, 10).forEach((v, i) => {
  console.log(`${i + 1}. ${v.flipGrade} | ${v.year} ${v.model} | $${v.price} | 净赚$${v.estimatedNetProfit}(${v.profitMargin}%) | bid $${v.suggestedBid}`);
});

// Step 5: 生成报告
console.log('\n📋 Step 5: 生成报告...');
const shortReport = generateShortReport(scored);
const fullReport = generateReport(scored);

console.log('\n========== SHORT REPORT ==========');
console.log(shortReport);

// Step 6: 保存结果
const dateStr = '20260303';
const scoredPath = path.join(dataDir, `scored_${dateStr}_final.json`);
const shortReportPath = path.join(dataDir, `report_${dateStr}_final_short.md`);
const fullReportPath = path.join(dataDir, `report_${dateStr}_final_full.md`);

fs.writeFileSync(scoredPath, JSON.stringify({
  scoredDate: new Date().toISOString(),
  version: '3.1-final',
  minProfitMargin: 0.10,
  blacklistApplied: true,
  blacklistCount: 5,
  totalScanned: vehicles.length,
  totalQualified: scored.length,
  vehicles: scored
}, null, 2));
fs.writeFileSync(shortReportPath, shortReport);
fs.writeFileSync(fullReportPath, fullReport);

console.log('\n💾 已保存:');
console.log('   •', scoredPath);
console.log('   •', shortReportPath);
console.log('   •', fullReportPath);

console.log('\n' + '='.repeat(60));
console.log('✅ 完整流程完成！');
console.log('='.repeat(60));
