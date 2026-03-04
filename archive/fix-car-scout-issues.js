/**
 * Car Scout 问题修复脚本
 * 
 * 修复内容：
 * 1. 过滤掉净利润为负的车辆
 * 2. 优化建议出价算法（不再都是2420）
 * 3. 提示需要实时更新拍卖价格
 * 
 * 使用方法：
 * 1. 将此文件中的修复内容手动应用到 C:\Users\Zhong\.openclaw\workspace\skills\car-scout\src\scoring.js
 * 2. 或者直接替换整个 scoring.js 文件
 */

console.log('🚗 Car Scout 问题修复');
console.log('========================================\n');
console.log('📋 问题列表：');
console.log('   1. ❌ 利润显示负数的车辆还在列表里');
console.log('   2. ❌ 建议出价都是2420，很奇怪');
console.log('   3. ❌ 拍卖车辆价格没有实时更新\n');

console.log('✅ 修复方案：');
console.log('   1. 添加净利润检查，负数直接过滤');
console.log('   2. 优化建议出价算法：');
console.log('      - 低价车 (<$3500): 80% 折扣');
console.log('      - 中价车 ($3500-$6000): 88% 折扣');
console.log('      - 高价车 (>$6000): 90% 折扣');
console.log('      - 急售信号: 额外降低至 82%');
console.log('   3. 需要添加实时价格更新功能\n');

console.log('📁 需要修改的文件：');
console.log('   C:\\Users\\Zhong\\.openclaw\\workspace\\skills\\car-scout\\src\\scoring.js\n');

console.log('🔧 修复内容 (apply to scoring.js:292-347)：\n');
console.log(`
/**
 * 计算 Flip Score
 */
function calculateFlipScore(vehicle) {
  // 硬约束检查
  if (vehicle.mileage > 160000) return null;
  if (vehicle.year < 2005) return null;
  if (vehicle.price < 2500 || vehicle.price > 8000) return null;
  if (hasMechanicalIssue(vehicle.description)) return null;
  // 排除 Dealer
  if (vehicle.seller && vehicle.seller.toLowerCase() === 'dealer') return null;

  const sellPrice = estimateSellPrice(vehicle.model, vehicle.year, vehicle.mileage, vehicle.location);
  if (!sellPrice) return null;

  const prepCost = estimatePrepCost(vehicle);
  const netProfit = sellPrice - vehicle.price - prepCost;
  const profitMargin = netProfit / vehicle.price;
  
  // 新增：净利润为负的直接排除
  if (netProfit < 0) return null;
  
  const urgentSignals = detectUrgentSignals(vehicle.description);
  const daysListed = getDaysListed(vehicle.postedDate);

  // 4 维度评分
  const scores = {
    profitMargin: scoreProfitMargin(vehicle.price, sellPrice, prepCost),
    turnover: scoreTurnover(vehicle.model, vehicle.location),
    prepCost: scorePrepCost(prepCost),
    negotiation: scoreNegotiation(vehicle)
  };

  const total = scores.profitMargin + scores.turnover + scores.prepCost + scores.negotiation;

  // Flip Grade
  let flipGrade;
  if (total >= 80) flipGrade = 'S';
  else if (total >= 65) flipGrade = 'A';
  else if (total >= 50) flipGrade = 'B';
  else flipGrade = 'C';

  // 周转等级
  const loc = (vehicle.location || '').toLowerCase();
  const region = loc.includes('auckland') ? 'auckland' :
                 loc.includes('waikato') || loc.includes('hamilton') ? 'waikato' : 'other';
  const turnoverGrade = TURNOVER[\`\${vehicle.model}_\${region}\`] || 'D';

  // 优化建议出价算法
  // 根据价格区间和急售信号动态调整折扣，而不是固定88%
  let bidDiscount = 0.88; // 默认88%
  if (urgentSignals.length > 0) {
    bidDiscount = 0.82; // 急售可以砍更多
  }
  if (vehicle.price < 3500) {
    bidDiscount = 0.80; // 低价车砍价空间大
  } else if (vehicle.price > 6000) {
    bidDiscount = 0.90; // 高价车砍价空间小
  }
  
  return {
    total,
    flipGrade,
    breakdown: scores,
    sellPrice,
    prepCost,
    netProfit,
    profitMargin: Math.round(profitMargin * 100),
    turnoverGrade,
    daysListed,
    urgentSignals,
    suggestedMaxBuy: Math.round(sellPrice * 0.7 - prepCost),
    suggestedBid: Math.round(vehicle.price * bidDiscount)
  };
}
`);

console.log('\n✅ 修复脚本准备完成！');
console.log('请手动将上述代码应用到 scoring.js 文件中。');
