/**
 * 保存车辆详情到训练数据
 */

const fs = require('fs');
const path = require('path');

// 新车辆数据（含完整WOF/REGO）
const newVehicle = {
  id: "fb_1236988861905530_detailed",
  make: "suzuki",
  model: "swift",
  year: 2009,
  price: 4990,
  mileage: 186000,
  location: "Hamilton",
  sellerType: "private",
  wof: "Oct 2025",
  rego: "Sep 2025",
  description: "1.2L Suzuki Swift. 186,000 kms. 6 Month Rego. 7 Month WOF. Aftermarket Head Unit (Bluetooth), Keyless Entry, Ice Cold AC",
  listingUrl: "https://www.facebook.com/marketplace/item/1236988861905530/",
  platform: "facebook",
  scrapedAt: new Date().toISOString(),
  // 标记为已验证数据（用于训练）
  _verified: true,
  _wofMonths: 7,
  _regoMonths: 6
};

// 保存到增强数据集
const enhancedDataPath = path.join(__dirname, 'data', 'enhanced_vehicles.json');

let enhancedData = { vehicles: [] };
if (fs.existsSync(enhancedDataPath)) {
  enhancedData = JSON.parse(fs.readFileSync(enhancedDataPath, 'utf8'));
}

// 检查是否已存在
const exists = enhancedData.vehicles.find(v => v.id === newVehicle.id);
if (!exists) {
  enhancedData.vehicles.push(newVehicle);
  fs.writeFileSync(enhancedDataPath, JSON.stringify(enhancedData, null, 2));
  console.log('✅ 车辆详情已保存到增强数据集');
} else {
  console.log('ℹ️  车辆已存在，跳过保存');
}

console.log('');
console.log('📊 增强数据集统计:');
console.log(`   总车辆数: ${enhancedData.vehicles.length}`);
console.log(`   有WOF数据: ${enhancedData.vehicles.filter(v => v.wof).length}`);
console.log(`   有REGO数据: ${enhancedData.vehicles.filter(v => v.rego).length}`);
console.log('');
console.log('💡 这些数据将用于:');
console.log('   1. 改进WOF/REGO特征权重');
console.log('   2. 优化里程对价格的影响计算');
console.log('   3. 提高模型对配置细节的敏感度');
console.log('');
