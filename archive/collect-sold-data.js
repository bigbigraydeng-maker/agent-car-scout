/**
 * 收集成交数据用于训练模型
 */
const fs = require('fs');
const path = require('path');

const SOLD_DATA_PATH = 'C:/Users/Zhong/.openclaw/workspace/skills/car-scout/data/sold_vehicles.json';

const newSoldData = [
  {
    id: '5791406127',
    model: 'Corolla',
    year: 2007,
    price: 4115,
    mileage: 152692,
    location: 'Palmerston North',
    seller: 'Dealer',
    soldDate: '2026-03-02',
    platform: 'trademe'
  },
  {
    id: '5804167283',
    model: 'Honda Fit',
    year: 2006,
    price: 2890,
    mileage: null,
    location: 'Auckland',
    seller: 'Dealer',
    soldDate: '2026-03-02',
    platform: 'trademe'
  }
];

console.log('📋 加载现有成交数据...');
let soldData = [];
try {
  if (fs.existsSync(SOLD_DATA_PATH)) {
    soldData = JSON.parse(fs.readFileSync(SOLD_DATA_PATH, 'utf8'));
    console.log(`   已加载 ${soldData.length} 条历史成交记录`);
  }
} catch (e) {
  console.log(`   无历史成交数据，新建`);
}

console.log('\n📋 添加新成交数据...');
const existingIds = new Set(soldData.map(d => d.id));
let added = 0;
newSoldData.forEach(d => {
  if (!existingIds.has(d.id)) {
    soldData.push(d);
    added++;
    console.log(`   ✅ 添加: ${d.year} ${d.model} - $${d.price}`);
  } else {
    console.log(`   ⏭️ 已存在: ${d.year} ${d.model} - $${d.price}`);
  }
});

console.log(`\n💾 保存成交数据 (共 ${soldData.length} 条)...`);
fs.writeFileSync(SOLD_DATA_PATH, JSON.stringify(soldData, null, 2));
console.log(`   已保存: ${SOLD_DATA_PATH}`);

console.log('\n✅ 成交数据收集完成!');
