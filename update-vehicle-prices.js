/**
 * 快速检查和更新已有车辆价格
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = 'C:/Users/Zhong/.openclaw/workspace/skills/car-scout/data';

// 加载最新车辆数据
const latestFile = 'vehicles_trademe_20260301.json';
const dataPath = path.join(DATA_DIR, latestFile);

console.log('📂 加载车辆数据:', latestFile);
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('📊 原始车辆数:', data.vehicles.length);

// 更新已知车辆的价格（基于用户反馈）
const priceUpdates = {
  '5760328364': 5250  // RAV4 当前价格已到5250
};

let updated = 0;
data.vehicles.forEach(v => {
  if (v.listingUrl) {
    const idMatch = v.listingUrl.match(/listing\/(\d+)/);
    if (idMatch && priceUpdates[idMatch[1]]) {
      console.log(`   🔄 更新: ${v.year} ${v.model} - $${v.price} → $${priceUpdates[idMatch[1]]}`);
      v.price = priceUpdates[idMatch[1]];
      v._priceUpdated = new Date().toISOString();
      updated++;
    }
  }
});

console.log(`✅ 更新了 ${updated} 辆车的价格`);

// 保存更新后的数据
const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
const newFile = `vehicles_trademe_${dateStr}_updated.json`;
const newPath = path.join(DATA_DIR, newFile);

data.updatedDate = new Date().toISOString();
data.updatedCount = updated;

fs.writeFileSync(newPath, JSON.stringify(data, null, 2));
console.log(`💾 已保存: ${newPath}`);

console.log('\n✅ 价格更新完成!');
