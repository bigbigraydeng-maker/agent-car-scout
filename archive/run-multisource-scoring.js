const fs = require('fs');
const path = require('path');
const { scoreVehicles } = require('./src/scoring-v3');
const { generateReport, generateShortReport } = require('./src/report');

console.log('='.repeat(60));
console.log('🚗 Car Scout - 最新多平台数据评分 (2026-03-02)');
console.log('='.repeat(60));

const dataDir = path.join(__dirname, 'data');

// Step 1: 加载最新的多平台数据
console.log('\n📂 Step 1: 加载最新多平台数据...');
const vehiclesPath = path.join(dataDir, 'nz_cars_20260302.json');
const data = JSON.parse(fs.readFileSync(vehiclesPath, 'utf8'));
let vehicles = data.vehicles || [];

console.log(`   数据来源: ${data.config?.locations?.map(l => l.name) || ['多平台']}`);
console.log(`   原始车辆数: ${vehicles.length}`);

// Step 2: 标准化车型名称并去重，过滤广告车
console.log('\n🔧 Step 2: 标准化车型数据，过滤广告车并去重...');
const seenIds = new Set();
const seenSignatures = new Set();
vehicles = vehicles.filter(v => {
  // 过滤广告车
  if (v.title && (v.title.includes('Advertisement') || v.title.includes('advertisement'))) {
    return false;
  }
  
  // 按ID去重
  if (!v.id || seenIds.has(v.id)) return false;
  seenIds.add(v.id);
  
  // 按特征去重（防止相同车重复）
  const signature = `${v.make}_${v.model}_${v.year}_${v.price}_${v.mileage}`;
  if (seenSignatures.has(signature)) return false;
  seenSignatures.add(signature);
  
  return true;
});

vehicles = vehicles.map(v => {
  let modelName = v.model;
  if (modelName) {
    modelName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
  }
  return {
    ...v,
    model: modelName,
    seller: 'Private',
    description: v.title || ''
  };
});

console.log(`   过滤广告车和去重后: ${vehicles.length} 辆车`);

// Step 3: 运行评分（含黑名单过滤和三级混合估价）
console.log('\n🔍 Step 3: 运行评分（v3.1 三级混合估价模型）...');
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
const scoredPath = path.join(dataDir, `scored_${dateStr}_multisource_final.json`);
const shortReportPath = path.join(dataDir, `report_${dateStr}_multisource_short.md`);
const fullReportPath = path.join(dataDir, `report_${dateStr}_multisource_full.md`);

fs.writeFileSync(scoredPath, JSON.stringify({
  scoredDate: new Date().toISOString(),
  version: '3.1-multisource',
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
console.log('✅ 多平台数据评分完成！');
console.log('='.repeat(60));
