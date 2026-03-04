/**
 * Car Scout 自动部署脚本
 * 把核心文件从 .openclaw 目录复制到当前工作目录
 */

const fs = require('fs');
const path = require('path');

const OPENCLAW_DIR = 'C:/Users/Zhong/.openclaw/workspace/skills/car-scout';
const TARGET_DIR = __dirname;

console.log('='.repeat(60));
console.log('🚗 Car Scout - 自动部署脚本');
console.log('='.repeat(60));

console.log('\n📂 源目录:', OPENCLAW_DIR);
console.log('📂 目标目录:', TARGET_DIR);
console.log('');

// 检查源目录是否存在
if (!fs.existsSync(OPENCLAW_DIR)) {
  console.error('❌ 错误：源目录不存在！');
  console.error('   ', OPENCLAW_DIR);
  process.exit(1);
}

console.log('✅ 源目录验证通过');

// 定义要复制的文件
const FILES_TO_COPY = {
  'src/scoring-v3.js': 'src/scoring-v3.js',
  'src/advanced-price-predictor.js': 'src/advanced-price-predictor.js',
  'src/market-valuation.js': 'src/market-valuation.js',
  'src/report.js': 'src/report.js',
  'src/fb-delta-scan.js': 'src/fb-delta-scan.js',
  'src/trademe-daily-scan.js': 'src/trademe-daily-scan.js',
  'src/send-feishu.js': 'src/send-feishu.js',
  'data/advanced_price_predictor.json': 'data/advanced_price_predictor.json',
  'data/vehicles_trademe_20260301.json': 'data/vehicles_trademe_20260301.json',
  'data/fb_search_all.json': 'data/fb_search_all.json',
  'package.json': 'package.json'
};

// 确保目标目录存在
const srcDir = path.join(TARGET_DIR, 'src');
const dataDir = path.join(TARGET_DIR, 'data');

if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

console.log('\n📋 开始复制文件...\n');

let copied = 0;
let skipped = 0;
let errors = 0;

for (const [srcRel, destRel] of Object.entries(FILES_TO_COPY)) {
  const srcPath = path.join(OPENCLAW_DIR, srcRel);
  const destPath = path.join(TARGET_DIR, destRel);
  
  console.log(`📄 ${srcRel}`);
  console.log(`   → ${destRel}`);
  
  if (!fs.existsSync(srcPath)) {
    console.log('   ⚠️  源文件不存在，跳过');
    skipped++;
    continue;
  }
  
  try {
    fs.copyFileSync(srcPath, destPath);
    console.log('   ✅ 已复制');
    copied++;
  } catch (e) {
    console.log('   ❌ 复制失败:', e.message);
    errors++;
  }
  console.log('');
}

console.log('='.repeat(60));
console.log('📊 部署总结：');
console.log('   已复制:', copied, '个文件');
console.log('   已跳过:', skipped, '个文件');
console.log('   失败:', errors, '个文件');
console.log('='.repeat(60));

if (copied > 0) {
  console.log('\n✅ 部署成功！现在可以编辑当前目录下的文件了。');
  console.log('\n💡 提示：');
  console.log('   • src/ 目录存放源代码');
  console.log('   • data/ 目录存放数据文件');
  console.log('   • 修改 src/scoring-v3.js 可以调整评分参数');
} else {
  console.log('\n⚠️  没有文件被复制，请检查源文件是否存在。');
}
console.log('='.repeat(60));
