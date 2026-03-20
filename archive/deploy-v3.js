/**
 * 部署 v3.1 优化版评分系统到 Car Scout
 */

const fs = require('fs');
const path = require('path');

const CAR_SCOUT_DIR = 'C:\\Users\\Zhong\\.openclaw\\workspace\\skills\\car-scout';
const SOURCE_DIR = 'C:\\Users\\Zhong\\Documents\\trae_projects\\Agent Car Scout';

console.log('🚀 部署 v3.1 优化版评分系统');
console.log('========================================\n');

// 1. 复制评分系统
console.log('📦 步骤1: 复制评分系统...');
const scoringSource = path.join(SOURCE_DIR, 'scoring-fixed-v3.js');
const scoringTarget = path.join(CAR_SCOUT_DIR, 'src', 'scoring-v3.js');

try {
  fs.copyFileSync(scoringSource, scoringTarget);
  console.log(`   ✅ 已复制: scoring-v3.js`);
} catch (e) {
  console.log(`   ❌ 复制失败: ${e.message}`);
}

// 2. 复制价格预测模型
console.log('\n📦 步骤2: 复制价格预测模型...');
const predictorSource = path.join(SOURCE_DIR, 'advanced-price-predictor.js');
const predictorTarget = path.join(CAR_SCOUT_DIR, 'src', 'advanced-price-predictor.js');

try {
  fs.copyFileSync(predictorSource, predictorTarget);
  console.log(`   ✅ 已复制: advanced-price-predictor.js`);
} catch (e) {
  console.log(`   ❌ 复制失败: ${e.message}`);
}

// 3. 复制训练好的模型
console.log('\n📦 步骤3: 复制训练好的模型...');
const modelSource = path.join(SOURCE_DIR, 'data', 'advanced_price_predictor.json');
const modelTarget = path.join(CAR_SCOUT_DIR, 'data', 'advanced_price_predictor.json');

try {
  fs.copyFileSync(modelSource, modelTarget);
  console.log(`   ✅ 已复制: advanced_price_predictor.json`);
} catch (e) {
  console.log(`   ❌ 复制失败: ${e.message}`);
}

// 4. 创建新的run-flip-v3.js
console.log('\n📦 步骤4: 创建运行脚本...');
const runFlipV3 = `/**
 * Run flip scoring v3.1 - 优化版
 */
const fs = require('fs');
const path = require('path');
const { scoreVehicles } = require('./scoring-v3');
const { generateReport, generateShortReport } = require('./report');

const dataDir = path.join(__dirname, '..', 'data');

// Find latest vehicles file
const files = fs.readdirSync(dataDir)
  .filter(f => /^vehicles_\\d{8}\\.json$/.test(f))
  .sort()
  .reverse();

if (files.length === 0) {
  console.error('No vehicle data files found');
  process.exit(1);
}

const latestFile = files[0];
console.log('Loading:', latestFile);

const dateMatch = latestFile.match(/(\\d{8})/);
const dateStr = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0].replace(/-/g, '');

const data = JSON.parse(fs.readFileSync(path.join(dataDir, latestFile), 'utf8'));
console.log('Input vehicles:', data.vehicles.length);

// Score with v3.1
const scored = scoreVehicles(data.vehicles);
console.log('Qualified after flip filter:', scored.length);

scored.forEach(function(v, i) {
  console.log('  ' + v.flipGrade + ' | ' + v.year + ' ' + v.model +
    ' | $' + v.price + ' | profit $' + v.estimatedNetProfit +
    ' (' + v.profitMargin + '%) | turnover ' + v.turnoverGrade +
    ' | flip ' + v.flipScore + ' | bid $' + v.suggestedBid);
});

// Save scored data
const scoredPath = path.join(dataDir, 'scored_' + dateStr + '_flip_v3.json');
fs.writeFileSync(scoredPath, JSON.stringify({
  scoredDate: new Date().toISOString(),
  version: '3.1-flip-optimized',
  totalScanned: data.vehicles.length,
  totalQualified: scored.length,
  vehicles: scored
}, null, 2));
console.log('Saved:', scoredPath);

// Generate reports
const fullReport = generateReport(scored);
const shortReport = generateShortReport(scored);

const fullPath = path.join(dataDir, 'report_' + dateStr + '_flip_v3_full.md');
const shortPath = path.join(dataDir, 'report_' + dateStr + '_flip_v3_short.md');
fs.writeFileSync(fullPath, fullReport);
fs.writeFileSync(shortPath, shortReport);

console.log('\\n========== SHORT REPORT ==========');
console.log(shortReport);
`;

const runFlipTarget = path.join(CAR_SCOUT_DIR, 'src', 'run-flip-v3.js');

try {
  fs.writeFileSync(runFlipTarget, runFlipV3);
  console.log(`   ✅ 已创建: run-flip-v3.js`);
} catch (e) {
  console.log(`   ❌ 创建失败: ${e.message}`);
}

console.log('\n========================================');
console.log('✅ 部署完成!');
console.log('========================================\n');

console.log('📋 部署文件清单:');
console.log('   - src/scoring-v3.js (v3.1优化版评分系统)');
console.log('   - src/advanced-price-predictor.js (价格预测模型)');
console.log('   - data/advanced_price_predictor.json (训练好的模型)');
console.log('   - src/run-flip-v3.js (运行脚本)');
console.log('');

console.log('🚀 运行测试:');
console.log('   cd C:\\Users\\Zhong\\.openclaw\\workspace\\skills\\car-scout');
console.log('   node src/run-flip-v3.js');
console.log('');
