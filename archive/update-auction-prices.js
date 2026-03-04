/**
 * TradeMe 拍卖价格实时更新脚本
 * 
 * 功能：
 * 1. 检查之前收藏的拍卖车辆
 * 2. 获取最新的拍卖价格
 * 3. 更新数据文件中的价格
 * 
 * 使用方法：
 *   node update-auction-prices.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  dataDir: path.join(__dirname, '..', '.openclaw', 'workspace', 'skills', 'car-scout', 'data'),
  outputDir: path.join(__dirname, 'data'),
  delay: 2000
};

/**
 * 从 TradeMe listing URL 中提取拍卖价格
 */
async function getAuctionPrice(page, listingUrl) {
  try {
    console.log(`   🔍 检查: ${listingUrl}`);
    
    await page.goto(listingUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // 尝试多种价格选择器
    const priceSelectors = [
      '.listing-header__price',
      '[class*="price"]',
      '.tm-motors-listing-price',
      '.current-bid',
      '.bid-price',
      'span[class*="price"]'
    ];
    
    let priceText = null;
    for (const selector of priceSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          priceText = await element.innerText();
          if (priceText && priceText.includes('$')) {
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // 提取价格数字
    if (priceText) {
      const priceMatch = priceText.match(/\$?([\d,]+)/);
      if (priceMatch) {
        const price = parseInt(priceMatch[1].replace(/,/g, ''));
        console.log(`   ✅ 当前价格: $${price.toLocaleString()}`);
        return price;
      }
    }
    
    console.log('   ⚠️  未找到价格信息');
    return null;
    
  } catch (error) {
    console.log(`   ❌ 获取价格失败: ${error.message}`);
    return null;
  }
}

/**
 * 获取最近的数据文件
 */
function getLatestDataFile() {
  const files = fs.readdirSync(CONFIG.dataDir)
    .filter(f => /^vehicles_\d{8}\.json$/.test(f))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    return null;
  }
  
  return path.join(CONFIG.dataDir, files[0]);
}

/**
 * 主函数
 */
async function main() {
  console.log('🚗 TradeMe 拍卖价格实时更新');
  console.log('========================================\n');
  
  // 获取最新数据文件
  const dataFile = getLatestDataFile();
  if (!dataFile) {
    console.log('❌ 未找到数据文件');
    return;
  }
  
  console.log(`📁 使用数据文件: ${path.basename(dataFile)}`);
  console.log('');
  
  // 读取数据
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const vehicles = data.vehicles || [];
  
  // 筛选出 TradeMe 的车辆
  const tmVehicles = vehicles.filter(v => 
    v.listingUrl && v.listingUrl.includes('trademe')
  );
  
  console.log(`📋 找到 ${tmVehicles.length} 辆 TradeMe 车辆`);
  console.log('');
  
  if (tmVehicles.length === 0) {
    console.log('⚠️  没有需要更新的车辆');
    return;
  }
  
  // 启动浏览器
  const browser = await chromium.launch({
    headless: true,
    slowMo: 100
  });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    // 更新价格
    let updated = 0;
    for (const vehicle of tmVehicles) {
      const newPrice = await getAuctionPrice(page, vehicle.listingUrl);
      
      if (newPrice && newPrice !== vehicle.price) {
        console.log(`   🔄 价格更新: $${vehicle.price.toLocaleString()} → $${newPrice.toLocaleString()}`);
        vehicle.price = newPrice;
        vehicle.priceUpdatedAt = new Date().toISOString();
        updated++;
      }
      
      await page.waitForTimeout(CONFIG.delay);
      console.log('');
    }
    
    // 保存更新后的数据
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const outputFile = path.join(CONFIG.outputDir, `vehicles_${dateStr}_updated.json`);
    
    fs.writeFileSync(outputFile, JSON.stringify({
      ...data,
      updatedAt: new Date().toISOString(),
      vehicles: vehicles
    }, null, 2));
    
    console.log('========================================');
    console.log(`✅ 更新完成!`);
    console.log(`   更新车辆数: ${updated}`);
    console.log(`   保存文件: ${path.basename(outputFile)}`);
    console.log('');
    console.log('💡 下一步:');
    console.log('   1. 将更新后的文件复制到 Car Scout data 目录');
    console.log('   2. 重新运行 Flip Score 评分');
    console.log('');
    
  } finally {
    await browser.close();
  }
}

// 运行
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { getAuctionPrice };
