/**
 * 初始化黑名单 - 添加已知无效车辆
 */
const { addToBlacklist } = require('./vehicle-status-check');

console.log('='.repeat(60));
console.log('🚗 Car Scout - 初始化黑名单');
console.log('='.repeat(60));

const vehiclesToAdd = [
  {
    id: '5786836792',
    listingUrl: 'https://www.trademe.co.nz/a/motors/cars/nissan/tiida/listing/5786836792',
    model: 'Tiida',
    year: 2005,
    price: 3100,
    reason: '链接跳转到列表页'
  },
  {
    id: '5791406127',
    listingUrl: 'https://www.trademe.co.nz/a/motors/cars/toyota/corolla/listing/5791406127',
    model: 'Corolla',
    year: 2007,
    price: 2830,
    reason: '页面显示已售'
  },
  {
    id: '5804167283',
    listingUrl: 'https://www.trademe.co.nz/a/motors/cars/honda/fit/listing/5804167283',
    model: 'Honda Fit',
    year: 2006,
    price: 2890,
    reason: '页面显示已售'
  }
];

console.log('\n📋 准备添加', vehiclesToAdd.length, '辆车到黑名单...\n');

vehiclesToAdd.forEach((v, i) => {
  console.log(`${i + 1}. 添加: ${v.year} ${v.model}`);
  console.log('   ID:', v.id);
  console.log('   原因:', v.reason);
  addToBlacklist(v);
  console.log('');
});

console.log('✅ 黑名单初始化完成!');
console.log('\n💡 这些车辆现在会被自动过滤，不会再被推送');
