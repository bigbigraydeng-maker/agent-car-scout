/**
 * 多平台新西兰二手车数据抓取
 * 支持 TradeMe, Facebook Marketplace, AutoTrader 等平台
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  models: [
    { make: 'toyota', model: 'corolla' },
    { make: 'toyota', model: 'vitz' },
    { make: 'toyota', model: 'wish' },
    { make: 'toyota', model: 'rav4' },
    { make: 'honda', model: 'fit' },
    { make: 'mazda', model: 'demio' },
    { make: 'toyota', model: 'aqua' },
    { make: 'suzuki', model: 'swift' },
    { make: 'toyota', model: 'prius' },
    { make: 'mazda', model: 'axela' },
    { make: 'honda', model: 'civic' },
    { make: 'nissan', model: 'tiida' }
  ],
  locations: ['Auckland', 'Waikato'],
  minYear: 2006,
  maxMileage: 180000,
  minPrice: 2000,
  maxPrice: 7500,
  outputDir: path.join(__dirname, 'data'),
  delay: 3000
};

// 平台配置
const PLATFORMS = {
  trademe: {
    name: 'TradeMe',
    baseUrl: 'https://www.trademe.co.nz/a/motors/cars',
    enabled: true
  },
  facebook: {
    name: 'Facebook Marketplace',
    baseUrl: 'https://www.facebook.com/marketplace',
    enabled: true
  },
  autotrader: {
    name: 'AutoTrader NZ',
    baseUrl: 'https://www.autotrader.co.nz',
    enabled: false // 需要进一步研究
  }
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 抓取 TradeMe 数据
 */
async function scrapeTradeMe(page, make, model, location) {
  console.log(`   📱 TradeMe: ${make} ${model} - ${location}`);
  
  const regionMap = { 'Auckland': '1', 'Waikato': '14' };
  const url = `${PLATFORMS.trademe.baseUrl}/${make}/${model}/search?price_min=${CONFIG.minPrice}&price_max=${CONFIG.maxPrice}&year_min=${CONFIG.minYear}&odometer_max=${CONFIG.maxMileage}&seller_type=private&region=${regionMap[location]}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await delay(3000);
    
    // 滚动加载
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(2000);
    }
    
    const vehicles = await page.evaluate(() => {
      const items = [];
      const seenUrls = new Set();
      
      const links = document.querySelectorAll('a[href*="listing"]');
      for (const link of links) {
        const href = link.href;
        if (seenUrls.has(href)) continue;
        seenUrls.add(href);
        
        const parent = link.closest('div, article, li, section');
        if (parent) {
          const text = parent.textContent;
          if (text.includes('$') && text.match(/20\d{2}/)) {
            items.push({
              text: text.substring(0, 500),
              href: href
            });
          }
        }
      }
      
      return items;
    });
    
    return vehicles.map(v => ({
      id: v.href.match(/listing\/(\d+)/)?.[1] || `tm_${Date.now()}`,
      make: make,
      model: model,
      year: v.text.match(/\b(20\d{2})\b/)?.[1] ? parseInt(v.text.match(/\b(20\d{2})\b/)[1]) : null,
      price: v.text.match(/\$([\d,]+)/)?.[1] ? parseInt(v.text.match(/\$([\d,]+)/)[1].replace(/,/g, '')) : null,
      mileage: v.text.match(/(\d{1,3},?\d{3})\s*km/i)?.[1] ? parseInt(v.text.match(/(\d{1,3},?\d{3})\s*km/i)[1].replace(/,/g, '')) : null,
      location: location,
      listingUrl: v.href,
      platform: 'trademe',
      scrapedAt: new Date().toISOString()
    })).filter(v => 
      v.year && v.year >= CONFIG.minYear &&
      v.mileage && v.mileage <= CONFIG.maxMileage &&
      v.price && v.price >= CONFIG.minPrice &&
      v.price <= CONFIG.maxPrice
    );
    
  } catch (error) {
    console.error(`   ❌ TradeMe 抓取失败: ${error.message}`);
    return [];
  }
}

/**
 * 抓取 Facebook Marketplace 数据
 */
async function scrapeFacebook(page, make, model, location) {
  console.log(`   📘 Facebook: ${make} ${model} - ${location}`);
  
  const url = `${PLATFORMS.facebook.baseUrl}/search?${new URLSearchParams({
    q: `${make} ${model}`,
    location: location,
    minPrice: CONFIG.minPrice,
    maxPrice: CONFIG.maxPrice,
    condition: 'used',
    category: 'vehicles'
  })}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await delay(5000);
    
    // 滚动加载
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(3000);
    }
    
    const vehicles = await page.evaluate(() => {
      const items = [];
      const seenUrls = new Set();
      
      const links = document.querySelectorAll('a[href*="/marketplace/item/"]');
      for (const link of links) {
        const href = link.href;
        if (seenUrls.has(href)) continue;
        seenUrls.add(href);
        
        const parent = link.closest('div, article, span');
        if (parent) {
          const text = parent.textContent;
          if (text.includes('$') && text.match(/20\d{2}/)) {
            items.push({
              text: text.substring(0, 500),
              href: href
            });
          }
        }
      }
      
      return items;
    });
    
    return vehicles.map(v => ({
      id: v.href.match(/item\/(\d+)/)?.[1] || `fb_${Date.now()}`,
      make: make,
      model: model,
      year: v.text.match(/\b(20\d{2})\b/)?.[1] ? parseInt(v.text.match(/\b(20\d{2})\b/)[1]) : null,
      price: v.text.match(/\$([\d,]+)/)?.[1] ? parseInt(v.text.match(/\$([\d,]+)/)[1].replace(/,/g, '')) : null,
      mileage: v.text.match(/(\d{1,3},?\d{3})\s*km/i)?.[1] ? parseInt(v.text.match(/(\d{1,3},?\d{3})\s*km/i)[1].replace(/,/g, '')) : null,
      location: location,
      listingUrl: v.href,
      platform: 'facebook',
      scrapedAt: new Date().toISOString()
    })).filter(v => 
      v.year && v.year >= CONFIG.minYear &&
      v.mileage && v.mileage <= CONFIG.maxMileage &&
      v.price && v.price >= CONFIG.minPrice &&
      v.price <= CONFIG.maxPrice
    );
    
  } catch (error) {
    console.error(`   ❌ Facebook 抓取失败: ${error.message}`);
    return [];
  }
}

/**
 * 主抓取函数
 */
async function scrapeAllPlatforms() {
  console.log('🚗 多平台新西兰二手车数据抓取');
  console.log('========================================');
  console.log('');
  console.log('📋 配置:');
  console.log(`   - 车型: ${CONFIG.models.map(m => m.make + ' ' + m.model).join(', ')}`);
  console.log(`   - 地区: ${CONFIG.locations.join(', ')}`);
  console.log(`   - 年份: >= ${CONFIG.minYear}`);
  console.log(`   - 里程: <= ${CONFIG.maxMileage} km`);
  console.log(`   - 价格: $${CONFIG.minPrice} - $${CONFIG.maxPrice}`);
  console.log('');
  console.log('🌐 启用平台:');
  Object.entries(PLATFORMS).forEach(([key, platform]) => {
    if (platform.enabled) {
      console.log(`   ✅ ${platform.name}`);
    } else {
      console.log(`   ⏸️  ${platform.name} (禁用)`);
    }
  });
  console.log('');
  
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  let allVehicles = [];
  
  const browser = await chromium.launch({
    headless: true,
    slowMo: 50
  });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    for (const model of CONFIG.models) {
      for (const location of CONFIG.locations) {
        console.log(`\n🔍 抓取: ${model.make} ${model.model} - ${location}`);
        
        let modelVehicles = [];
        
        if (PLATFORMS.trademe.enabled) {
          const trademeVehicles = await scrapeTradeMe(page, model.make, model.model, location);
          modelVehicles = [...modelVehicles, ...trademeVehicles];
          await delay(CONFIG.delay);
        }
        
        if (PLATFORMS.facebook.enabled) {
          const fbVehicles = await scrapeFacebook(page, model.make, model.model, location);
          modelVehicles = [...modelVehicles, ...fbVehicles];
          await delay(CONFIG.delay);
        }
        
        console.log(`   ✅ 总计: ${modelVehicles.length} 辆`);
        allVehicles = [...allVehicles, ...modelVehicles];
      }
    }
    
  } catch (error) {
    console.error('❌ 浏览器错误:', error.message);
  } finally {
    await browser.close();
  }
  
  // 去重
  const uniqueVehicles = [];
  const seenIds = new Set();
  for (const v of allVehicles) {
    if (v.id && !seenIds.has(v.id)) {
      seenIds.add(v.id);
      uniqueVehicles.push(v);
    }
  }
  
  // 保存数据
  const outputFile = path.join(CONFIG.outputDir, `nz_cars_multi_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.json`);
  const outputData = {
    scrapeDate: new Date().toISOString(),
    totalCount: uniqueVehicles.length,
    platforms: Object.keys(PLATFORMS).filter(key => PLATFORMS[key].enabled),
    config: CONFIG,
    vehicles: uniqueVehicles
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  
  console.log('');
  console.log('✅ 数据抓取完成!');
  console.log(`💾 数据已保存到: ${outputFile}`);
  console.log(`📊 抓取到 ${uniqueVehicles.length} 辆符合条件的车辆`);
  console.log('');
  
  // 统计
  const platformCounts = {};
  const modelCounts = {};
  
  for (const v of uniqueVehicles) {
    platformCounts[v.platform] = (platformCounts[v.platform] || 0) + 1;
    const modelKey = `${v.make} ${v.model}`;
    modelCounts[modelKey] = (modelCounts[modelKey] || 0) + 1;
  }
  
  console.log('📈 平台分布:');
  Object.entries(platformCounts).forEach(([platform, count]) => {
    const percentage = ((count / uniqueVehicles.length) * 100).toFixed(1);
    console.log(`   ${platform}: ${count} 辆 (${percentage}%)`);
  });
  
  console.log('');
  console.log('📈 车型分布:');
  Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([model, count]) => {
      const percentage = ((count / uniqueVehicles.length) * 100).toFixed(1);
      console.log(`   ${model}: ${count} 辆 (${percentage}%)`);
    });
  
  return outputData;
}

/**
 * 主函数
 */
async function main() {
  try {
    await scrapeAllPlatforms();
    
    console.log('');
    console.log('✅ 任务完成!');
    console.log('');
    console.log('💡 下一步:');
    console.log('   1. 分析抓取的数据');
    console.log('   2. 建立数据库存储');
    console.log('   3. 开发价格预测模型');
    
  } catch (error) {
    console.error('❌ 任务失败:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { scrapeAllPlatforms };
