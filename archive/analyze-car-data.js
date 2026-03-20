/**
 * 分析抓取的车辆数据
 * 生成价格统计和报告
 */

const fs = require('fs');
const path = require('path');

// 读取数据文件
const dataDir = path.join(__dirname, 'data');
const files = fs.readdirSync(dataDir)
  .filter(f => f.startsWith('nz_cars_') && f.endsWith('.json'))
  .sort()
  .reverse();

if (files.length === 0) {
  console.log('❌ 没有找到数据文件');
  process.exit(1);
}

const latestFile = files[0];
const data = JSON.parse(fs.readFileSync(path.join(dataDir, latestFile), 'utf8'));

console.log('📊 新西兰二手车数据分析报告');
console.log('========================================');
console.log(`数据文件: ${latestFile}`);
console.log(`抓取时间: ${new Date(data.scrapeDate).toLocaleString()}`);
console.log(`总车辆数: ${data.totalCount}`);
console.log('');

// 1. 价格统计
const prices = data.vehicles.map(v => v.price).filter(p => p > 0);
if (prices.length > 0) {
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  
  console.log('💰 价格统计');
  console.log('----------------------------------------');
  console.log(`平均价格: $${avgPrice.toFixed(0)}`);
  console.log(`最低价格: $${minPrice}`);
  console.log(`最高价格: $${maxPrice}`);
  console.log('');
}

// 2. 年份统计
const years = data.vehicles.map(v => v.year).filter(y => y > 0);
if (years.length > 0) {
  const avgYear = years.reduce((a, b) => a + b, 0) / years.length;
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  
  console.log('📅 年份统计');
  console.log('----------------------------------------');
  console.log(`平均年份: ${avgYear.toFixed(0)}`);
  console.log(`最旧年份: ${minYear}`);
  console.log(`最新年份: ${maxYear}`);
  console.log('');
}

// 3. 里程统计
const mileages = data.vehicles.map(v => v.mileage).filter(m => m > 0);
if (mileages.length > 0) {
  const avgMileage = mileages.reduce((a, b) => a + b, 0) / mileages.length;
  const minMileage = Math.min(...mileages);
  const maxMileage = Math.max(...mileages);
  
  console.log('🛣️  里程统计');
  console.log('----------------------------------------');
  console.log(`平均里程: ${avgMileage.toFixed(0)} km`);
  console.log(`最低里程: ${minMileage} km`);
  console.log(`最高里程: ${maxMileage} km`);
  console.log('');
}

// 4. 车型分布
const modelCounts = {};
data.vehicles.forEach(v => {
  const key = `${v.make} ${v.model}`;
  modelCounts[key] = (modelCounts[key] || 0) + 1;
});

console.log('🚗 车型分布');
console.log('----------------------------------------');
Object.entries(modelCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([model, count]) => {
    const percentage = ((count / data.totalCount) * 100).toFixed(1);
    console.log(`${model}: ${count} 辆 (${percentage}%)`);
  });
console.log('');

// 5. 价格区间分布
const priceRanges = {
  'Under $5,000': 0,
  '$5,000 - $7,000': 0,
  '$7,000 - $10,000': 0,
  '$10,000 - $12,000': 0,
  'Over $12,000': 0
};

data.vehicles.forEach(v => {
  if (v.price < 5000) priceRanges['Under $5,000']++;
  else if (v.price < 7000) priceRanges['$5,000 - $7,000']++;
  else if (v.price < 10000) priceRanges['$7,000 - $10,000']++;
  else if (v.price < 12000) priceRanges['$10,000 - $12,000']++;
  else priceRanges['Over $12,000']++;
});

console.log('💵 价格区间分布');
console.log('----------------------------------------');
Object.entries(priceRanges).forEach(([range, count]) => {
  if (count > 0) {
    const percentage = ((count / data.totalCount) * 100).toFixed(1);
    console.log(`${range}: ${count} 辆 (${percentage}%)`);
  }
});
console.log('');

// 6. 各车型平均价格
console.log('💰 各车型平均价格');
console.log('----------------------------------------');
const modelPrices = {};
data.vehicles.forEach(v => {
  const key = `${v.make} ${v.model}`;
  if (!modelPrices[key]) {
    modelPrices[key] = { total: 0, count: 0 };
  }
  if (v.price > 0) {
    modelPrices[key].total += v.price;
    modelPrices[key].count++;
  }
});

Object.entries(modelPrices)
  .filter(([_, data]) => data.count > 0)
  .map(([model, data]) => ({
    model,
    avgPrice: data.total / data.count,
    count: data.count
  }))
  .sort((a, b) => a.avgPrice - b.avgPrice)
  .forEach(({ model, avgPrice, count }) => {
    console.log(`${model}: $${avgPrice.toFixed(0)} (${count} 辆)`);
  });
console.log('');

// 7. 推荐车辆（价格低于平均价）
console.log('⭐ 推荐车辆（价格低于平均价）');
console.log('----------------------------------------');
const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
const goodDeals = data.vehicles
  .filter(v => v.price > 0 && v.price < avgPrice * 0.9)
  .sort((a, b) => a.price - b.price)
  .slice(0, 10);

goodDeals.forEach((v, i) => {
  console.log(`${i + 1}. ${v.year} ${v.make} ${v.model} - $${v.price} (${v.mileage?.toLocaleString()} km)`);
  console.log(`   ${v.listingUrl}`);
});
console.log('');

console.log('✅ 分析完成!');
