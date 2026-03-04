/**
 * 黑名单管理工具
 */
const fs = require('fs');
const path = require('path');
const { loadBlacklist, saveBlacklist, addToBlacklist, isBlacklisted } = require('./vehicle-status-check');

const DATA_DIR = 'C:/Users/Zhong/.openclaw/workspace/skills/car-scout/data';

console.log('='.repeat(60));
console.log('🚗 Car Scout - 黑名单管理工具');
console.log('='.repeat(60));

const blacklist = loadBlacklist();

console.log('\n📊 当前黑名单状态:');
console.log('   车辆数量:', blacklist.vehicles.length);
console.log('   最后更新:', blacklist.lastUpdated || '从未更新');

if (blacklist.vehicles.length > 0) {
  console.log('\n📋 黑名单车辆列表:');
  blacklist.vehicles.forEach((v, i) => {
    console.log(`   ${i + 1}. [${v.id}] ${v.year} ${v.model} - $${v.price}`);
    console.log(`      原因: ${v.reason}`);
    console.log(`      添加时间: ${v.addedAt}`);
  });
}

console.log('\n✅ 加载完成!');
console.log('\n💡 可用操作:');
console.log('   1. 手动添加车辆: addToBlacklist({ id, listingUrl, model, year, price, reason })');
console.log('   2. 查看黑名单: loadBlacklist()');
console.log('   3. 检查是否在黑名单: isBlacklisted(listingId)');
console.log('\n使用方法: 在其他脚本中导入 vehicle-status-check 模块');
