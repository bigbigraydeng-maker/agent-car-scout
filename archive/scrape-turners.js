/**
 * Turners 拍卖行数据抓取
 * 获取拍卖车辆的历史成交数据
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
  locations: ['Auckland', 'Christchurch', 'Wellington'],
  minYear: 2006,
  maxMileage: 180000,
  minPrice: 2000,
  maxPrice: 7500,
  outputDir: path.join(__dirname, 'data'),
  delay: 3000
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 抓取 Turners 拍卖数据
 */
async function scrapeTurners(page, make, model, location) {
  console.log(`   🏛️ Turners: ${make} ${model} - ${location}`);
  
  // Turners 搜索 URL
  const baseUrl = 'https://www.turners.co.nz/Cars/Used-Cars-for-Sale';
  const params = new URLSearchParams({
    make: make.charAt(0).toUpperCase() + make.slice(1),
    model: model.charAt(0).toUpperCase() + model.slice(1),
    yearfrom: CONFIG.minYear.toString(),
    yearto: '2026',
    pricefrom: CONFIG.minPrice.toString(),
    priceto: CONFIG.maxPrice.toString()
  });
  
  const url = `${baseUrl}/?${params.toString()}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await delay(3000);
    
    // 滚动加载
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(2000);
    }
    
    // 提取车辆数据
    const vehicles = await page.evaluate(() => {
      const items = [];
      const seenUrls = new Set();
      
      // Turners 的车辆卡片选择器
      const cards = document.querySelectorAll('.vehicle-card, .car-card, .listing-item, [data-vehicle]');
      
      for (const card of cards) {
        try {
          const titleEl = card.querySelector('h2, h3, .title, .vehicle-title');
          const priceEl = card.querySelector('.price, .vehicle-price, [class*="price"]');
          const linkEl = card.querySelector('a[href*="/Cars/"]');
          const mileageEl = card.querySelector('.mileage, .odometer, [class*="mileage"]');
          const yearEl = card.querySelector('.year, [class*="year"]');
          
          if (titleEl && priceEl) {
            const title = titleEl.textContent.trim();
            const priceText = priceEl.textContent.trim();
            const price = priceText.match(/\$([\d,]+)/)?.[1] ? 
              parseInt(priceText.match(/\$([\d,]+)/)[1].replace(/,/g, '')) : null;
            
            const mileageText = mileageEl ? mileageEl.textContent : '';
            const mileage = mileageText.match(/(\d{1,3},?\d{3})\s*km/i)?.[1] ?
              parseInt(mileageText.match(/(\d{1,3},?\d{3})\s*km/i)[1].replace(/,/g, '')) : null;
            
            const yearText = yearEl ? yearEl.textContent : title;
            const year = yearText.match(/\b(20\d{2})\b/)?.[1] ?
              parseInt(yearText.match(/\b(20\d{2})\b/)[1]) : null;
            
            const url = linkEl ? linkEl.href : '';
            
            if (price && year) {
              items.push({
                title,
                price,
                mileage,
                year,
                url,
                text: card.textContent.substring(0, 300)
              });
            }
          }
        } catch (error) {
          console.error('Error extracting vehicle:', error.message);
        }
      }
      
      return items;
    });
    
    console.log(`   ✅ 找到 ${vehicles.length} 辆车辆`);
    
    return vehicles.map(v => ({
      id: v.url ? `turners_${v.url.match(/\/(\d+)\/?$/)?.[1] || Date.now()}` : `turners_${Date.now()}`,
      make: make,
      model: model,
      year: v.year,
      price: v.price,
      mileage: v.mileage || 0,
      location: location,
      title: v.title,
      description: v.text,
      listingUrl: v.url || '',
      platform: 'turners',
      sellerType: 'auction', // 拍卖行
      scrapedAt: new Date().toISOString()
    })).filter(v => 
      v.year && v.year >= CONFIG.minYear &&
      v.mileage <= CONFIG.maxMileage &&
      v.price && v.price >= CONFIG.minPrice &&
      v.price <= CONFIG.maxPrice
    );
    
  } catch (error) {
    console.error(`   ❌ Turners 抓取失败: ${error.message}`);
    return [];
  }
}

/**
 * 抓取 CarJam 车辆历史数据
 */
async function scrapeCarJam(page, make, model) {
  console.log(`   📋 CarJam: ${make} ${model}`);
  
  // CarJam 搜索 URL
  const url = `https://www.carjam.co.nz/car-search/?make=${make}&model=${model}&year_from=${CONFIG.minYear}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await delay(3000);
    
    // 提取数据
    const vehicles = await page.evaluate(() => {
      const items = [];
      const rows = document.querySelectorAll('.search-result, .vehicle-row, tr');
      
      for (const row of rows) {
        const text = row.textContent;
        if (text.includes('$') && text.match(/20\d{2}/)) {
          const priceMatch = text.match(/\$([\d,]+)/);
          const yearMatch = text.match(/\b(20\d{2})\b/);
          
          if (priceMatch && yearMatch) {
            items.push({
              text: text.substring(0, 200),
              price: parseInt(priceMatch[1].replace(/,/g, '')),
              year: parseInt(yearMatch[1])
            });
          }
        }
      }
      
      return items;
    });
    
    console.log(`   ✅ 找到 ${vehicles.length} 辆车辆`);
    
    return vehicles.map(v => ({
      id: `carjam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      make: make,
      model: model,
      year: v.year,
      price: v.price,
      mileage: 0,
      location: 'Unknown',
      title: `${v.year} ${make} ${model}`,
      description: v.text,
      listingUrl: '',
      platform: 'carjam',
      sellerType: 'unknown',
      scrapedAt: new Date().toISOString()
    })).filter(v => 
      v.year && v.year >= CONFIG.minYear &&
      v.price && v.price >= CONFIG.minPrice &&
      v.price <= CONFIG.maxPrice
    );
    
  } catch (error) {
    console.error(`   ❌ CarJam 抓取失败: ${error.message}`);
    return [];
  }
}

/**
 * 主抓取函数
 */
async function scrapeAuctionData() {
  console.log('🏛️ Turners 拍卖行 & CarJam 数据抓取');
  console.log('========================================');
  console.log('');
  console.log('📋 配置:');
  console.log(`   - 车型: ${CONFIG.models.map(m => m.make + ' ' + m.model).join(', ')}`);
  console.log(`   - 年份: >= ${CONFIG.minYear}`);
  console.log(`   - 里程: <= ${CONFIG.maxMileage} km`);
  console.log(`   - 价格: $${CONFIG.minPrice} - $${CONFIG.maxPrice}`);
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
    
    // 抓取 Turners
    console.log('🔍 抓取 Turners 拍卖行...');
    for (const model of CONFIG.models.slice(0, 3)) { // 先测试前3个车型
      for (const location of CONFIG.locations.slice(0, 1)) { // 先测试 Auckland
        const vehicles = await scrapeTurners(page, model.make, model.model, location);
        allVehicles = [...allVehicles, ...vehicles];
        await delay(CONFIG.delay);
      }
    }
    
    // 抓取 CarJam
    console.log('');
    console.log('🔍 抓取 CarJam...');
    for (const model of CONFIG.models.slice(0, 3)) {
      const vehicles = await scrapeCarJam(page, model.make, model.model);
      allVehicles = [...allVehicles, ...vehicles];
      await delay(CONFIG.delay);
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
  const outputFile = path.join(CONFIG.outputDir, `auction_cars_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.json`);
  const outputData = {
    scrapeDate: new Date().toISOString(),
    totalCount: uniqueVehicles.length,
    sources: ['turners', 'carjam'],
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
    console.log(`   ${platform}: ${count} 辆`);
  });
  
  console.log('');
  console.log('📈 车型分布:');
  Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([model, count]) => {
      console.log(`   ${model}: ${count} 辆`);
    });
  
  return outputData;
}

/**
 * 主函数
 */
async function main() {
  try {
    await scrapeAuctionData();
    
    console.log('');
    console.log('✅ 任务完成!');
    
  } catch (error) {
    console.error('❌ 任务失败:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { scrapeAuctionData };
