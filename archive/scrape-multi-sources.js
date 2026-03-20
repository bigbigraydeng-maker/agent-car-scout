/**
 * 多数据源二手车抓取脚本
 * 支持: 2cheapcars, autotrader, nzcheapcars, kiwicheapcars
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
  minYear: 2006,
  maxMileage: 180000,
  minPrice: 2000,
  maxPrice: 7500,
  outputDir: path.join(__dirname, 'data'),
  delay: 3000
};

// 数据源配置
const SOURCES = {
  '2cheapcars': {
    name: '2 Cheap Cars',
    baseUrl: 'https://www.2cheapcars.co.nz/used-cars',
    searchParam: 'search',
    enabled: true
  },
  'autotrader': {
    name: 'Auto Trader NZ',
    baseUrl: 'https://autotrader.co.nz/used-cars-for-sale',
    searchParam: 'keyword',
    enabled: true
  },
  'nzcheapcars': {
    name: 'NZ Cheap Cars',
    baseUrl: 'https://www.nzcheapcars.co.nz/cars',
    searchParam: 'search',
    enabled: true
  },
  'kiwicheapcars': {
    name: 'Kiwi Cheap Cars',
    baseUrl: 'https://www.kiwicheapcars.co.nz/vehicles',
    searchParam: 'search',
    enabled: true
  }
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 抓取 2 Cheap Cars
 */
async function scrape2CheapCars(page, make, model) {
  console.log(`   🚗 2 Cheap Cars: ${make} ${model}`);
  
  try {
    // 构建搜索URL
    const searchUrl = `https://www.2cheapcars.co.nz/used-cars?make=${make}&model=${model}&price_min=${CONFIG.minPrice}&price_max=${CONFIG.maxPrice}`;
    
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await delay(3000);
    
    // 滚动加载更多
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(2000);
    }
    
    // 提取车辆数据
    const vehicles = await page.evaluate(() => {
      const items = [];
      
      // 2 Cheap Cars 的车辆卡片选择器
      const cards = document.querySelectorAll('.car-item, .vehicle-card, .listing-item, [class*="car"], [class*="vehicle"]');
      
      for (const card of cards) {
        try {
          const titleEl = card.querySelector('h2, h3, .title, .car-title, .vehicle-title');
          const priceEl = card.querySelector('.price, .car-price, .vehicle-price, [class*="price"]');
          const linkEl = card.querySelector('a[href*="/used-cars/"]');
          const mileageEl = card.querySelector('.mileage, .odometer, [class*="mileage"], [class*="km"]');
          const yearEl = card.querySelector('.year, [class*="year"]');
          const locationEl = card.querySelector('.location, [class*="location"], [class*="branch"]');
          
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
            
            const location = locationEl ? locationEl.textContent.trim() : 'Unknown';
            const url = linkEl ? linkEl.href : '';
            
            if (price && year) {
              items.push({
                title,
                price,
                mileage,
                year,
                location,
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
      id: v.url ? `2cheapcars_${v.url.match(/\/(\d+)\/?$/)?.[1] || Date.now()}` : `2cheapcars_${Date.now()}`,
      make: make,
      model: model,
      year: v.year,
      price: v.price,
      mileage: v.mileage || 0,
      location: v.location || 'Unknown',
      title: v.title,
      description: v.text,
      listingUrl: v.url || '',
      platform: '2cheapcars',
      sellerType: 'dealer',
      scrapedAt: new Date().toISOString()
    })).filter(v => 
      v.year && v.year >= CONFIG.minYear &&
      v.mileage <= CONFIG.maxMileage &&
      v.price && v.price >= CONFIG.minPrice &&
      v.price <= CONFIG.maxPrice
    );
    
  } catch (error) {
    console.error(`   ❌ 2 Cheap Cars 抓取失败: ${error.message}`);
    return [];
  }
}

/**
 * 抓取 Auto Trader NZ
 */
async function scrapeAutoTrader(page, make, model) {
  console.log(`   🚗 Auto Trader: ${make} ${model}`);
  
  try {
    // 构建搜索URL
    const searchUrl = `https://autotrader.co.nz/used-cars-for-sale?keyword=${make}+${model}&price_min=${CONFIG.minPrice}&price_max=${CONFIG.maxPrice}`;
    
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await delay(3000);
    
    // 滚动加载更多
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(2000);
    }
    
    // 提取车辆数据
    const vehicles = await page.evaluate(() => {
      const items = [];
      
      // Auto Trader 的车辆卡片选择器
      const cards = document.querySelectorAll('.listing-item, .car-card, .vehicle-item, [data-listing]');
      
      for (const card of cards) {
        try {
          const titleEl = card.querySelector('h3, .title, .listing-title');
          const priceEl = card.querySelector('.price, .listing-price');
          const linkEl = card.querySelector('a[href*="/listing/"]');
          const mileageEl = card.querySelector('.odometer, .mileage');
          const yearEl = card.querySelector('.year');
          const locationEl = card.querySelector('.location');
          
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
            
            const location = locationEl ? locationEl.textContent.trim() : 'Unknown';
            const url = linkEl ? linkEl.href : '';
            
            if (price && year) {
              items.push({
                title,
                price,
                mileage,
                year,
                location,
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
      id: v.url ? `autotrader_${v.url.match(/\/(\d+)\/?$/)?.[1] || Date.now()}` : `autotrader_${Date.now()}`,
      make: make,
      model: model,
      year: v.year,
      price: v.price,
      mileage: v.mileage || 0,
      location: v.location || 'Unknown',
      title: v.title,
      description: v.text,
      listingUrl: v.url || '',
      platform: 'autotrader',
      sellerType: 'dealer',
      scrapedAt: new Date().toISOString()
    })).filter(v => 
      v.year && v.year >= CONFIG.minYear &&
      v.mileage <= CONFIG.maxMileage &&
      v.price && v.price >= CONFIG.minPrice &&
      v.price <= CONFIG.maxPrice
    );
    
  } catch (error) {
    console.error(`   ❌ Auto Trader 抓取失败: ${error.message}`);
    return [];
  }
}

/**
 * 抓取 NZ Cheap Cars
 */
async function scrapeNZCheapCars(page, make, model) {
  console.log(`   🚗 NZ Cheap Cars: ${make} ${model}`);
  
  try {
    // 构建搜索URL
    const searchUrl = `https://www.nzcheapcars.co.nz/cars?search=${make}+${model}&price_min=${CONFIG.minPrice}&price_max=${CONFIG.maxPrice}`;
    
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await delay(3000);
    
    // 滚动加载更多
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(2000);
    }
    
    // 提取车辆数据
    const vehicles = await page.evaluate(() => {
      const items = [];
      
      // NZ Cheap Cars 的车辆卡片选择器
      const cards = document.querySelectorAll('.vehicle-item, .car-item, .listing');
      
      for (const card of cards) {
        try {
          const titleEl = card.querySelector('h2, h3, .title');
          const priceEl = card.querySelector('.price');
          const linkEl = card.querySelector('a');
          const mileageEl = card.querySelector('.mileage, .odometer');
          const yearEl = card.querySelector('.year');
          const locationEl = card.querySelector('.location');
          
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
            
            const location = locationEl ? locationEl.textContent.trim() : 'Unknown';
            const url = linkEl ? linkEl.href : '';
            
            if (price && year) {
              items.push({
                title,
                price,
                mileage,
                year,
                location,
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
      id: v.url ? `nzcheapcars_${v.url.match(/\/(\d+)\/?$/)?.[1] || Date.now()}` : `nzcheapcars_${Date.now()}`,
      make: make,
      model: model,
      year: v.year,
      price: v.price,
      mileage: v.mileage || 0,
      location: v.location || 'Unknown',
      title: v.title,
      description: v.text,
      listingUrl: v.url || '',
      platform: 'nzcheapcars',
      sellerType: 'dealer',
      scrapedAt: new Date().toISOString()
    })).filter(v => 
      v.year && v.year >= CONFIG.minYear &&
      v.mileage <= CONFIG.maxMileage &&
      v.price && v.price >= CONFIG.minPrice &&
      v.price <= CONFIG.maxPrice
    );
    
  } catch (error) {
    console.error(`   ❌ NZ Cheap Cars 抓取失败: ${error.message}`);
    return [];
  }
}

/**
 * 抓取 Kiwi Cheap Cars
 */
async function scrapeKiwiCheapCars(page, make, model) {
  console.log(`   🚗 Kiwi Cheap Cars: ${make} ${model}`);
  
  try {
    // 构建搜索URL
    const searchUrl = `https://www.kiwicheapcars.co.nz/vehicles?search=${make}+${model}&price_min=${CONFIG.minPrice}&price_max=${CONFIG.maxPrice}`;
    
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await delay(3000);
    
    // 滚动加载更多
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(2000);
    }
    
    // 提取车辆数据
    const vehicles = await page.evaluate(() => {
      const items = [];
      
      // Kiwi Cheap Cars 的车辆卡片选择器
      const cards = document.querySelectorAll('.vehicle-card, .car-item, .listing-item');
      
      for (const card of cards) {
        try {
          const titleEl = card.querySelector('h2, h3, .title, .vehicle-title');
          const priceEl = card.querySelector('.price, .vehicle-price');
          const linkEl = card.querySelector('a');
          const mileageEl = card.querySelector('.mileage, .odometer');
          const yearEl = card.querySelector('.year');
          const locationEl = card.querySelector('.location, .branch');
          
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
            
            const location = locationEl ? locationEl.textContent.trim() : 'Unknown';
            const url = linkEl ? linkEl.href : '';
            
            if (price && year) {
              items.push({
                title,
                price,
                mileage,
                year,
                location,
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
      id: v.url ? `kiwicheapcars_${v.url.match(/\/(\d+)\/?$/)?.[1] || Date.now()}` : `kiwicheapcars_${Date.now()}`,
      make: make,
      model: model,
      year: v.year,
      price: v.price,
      mileage: v.mileage || 0,
      location: v.location || 'Unknown',
      title: v.title,
      description: v.text,
      listingUrl: v.url || '',
      platform: 'kiwicheapcars',
      sellerType: 'dealer',
      scrapedAt: new Date().toISOString()
    })).filter(v => 
      v.year && v.year >= CONFIG.minYear &&
      v.mileage <= CONFIG.maxMileage &&
      v.price && v.price >= CONFIG.minPrice &&
      v.price <= CONFIG.maxPrice
    );
    
  } catch (error) {
    console.error(`   ❌ Kiwi Cheap Cars 抓取失败: ${error.message}`);
    return [];
  }
}

/**
 * 主抓取函数
 */
async function scrapeAllSources() {
  console.log('🚗 多数据源二手车抓取');
  console.log('========================================');
  console.log('');
  console.log('📋 配置:');
  console.log(`   - 车型: ${CONFIG.models.length} 款`);
  console.log(`   - 年份: >= ${CONFIG.minYear}`);
  console.log(`   - 里程: <= ${CONFIG.maxMileage} km`);
  console.log(`   - 价格: $${CONFIG.minPrice} - $${CONFIG.maxPrice}`);
  console.log('');
  console.log('🌐 数据源:');
  Object.entries(SOURCES).forEach(([key, source]) => {
    console.log(`   ${source.enabled ? '✅' : '❌'} ${source.name}`);
  });
  console.log('');
  
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  let allVehicles = [];
  const stats = {
    '2cheapcars': 0,
    'autotrader': 0,
    'nzcheapcars': 0,
    'kiwicheapcars': 0
  };
  
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
    
    // 抓取 2 Cheap Cars
    if (SOURCES['2cheapcars'].enabled) {
      console.log('🔍 抓取 2 Cheap Cars...');
      for (const model of CONFIG.models.slice(0, 3)) { // 先测试前3个车型
        const vehicles = await scrape2CheapCars(page, model.make, model.model);
        allVehicles = [...allVehicles, ...vehicles];
        stats['2cheapcars'] += vehicles.length;
        await delay(CONFIG.delay);
      }
      console.log('');
    }
    
    // 抓取 Auto Trader
    if (SOURCES['autotrader'].enabled) {
      console.log('🔍 抓取 Auto Trader...');
      for (const model of CONFIG.models.slice(0, 3)) {
        const vehicles = await scrapeAutoTrader(page, model.make, model.model);
        allVehicles = [...allVehicles, ...vehicles];
        stats['autotrader'] += vehicles.length;
        await delay(CONFIG.delay);
      }
      console.log('');
    }
    
    // 抓取 NZ Cheap Cars
    if (SOURCES['nzcheapcars'].enabled) {
      console.log('🔍 抓取 NZ Cheap Cars...');
      for (const model of CONFIG.models.slice(0, 3)) {
        const vehicles = await scrapeNZCheapCars(page, model.make, model.model);
        allVehicles = [...allVehicles, ...vehicles];
        stats['nzcheapcars'] += vehicles.length;
        await delay(CONFIG.delay);
      }
      console.log('');
    }
    
    // 抓取 Kiwi Cheap Cars
    if (SOURCES['kiwicheapcars'].enabled) {
      console.log('🔍 抓取 Kiwi Cheap Cars...');
      for (const model of CONFIG.models.slice(0, 3)) {
        const vehicles = await scrapeKiwiCheapCars(page, model.make, model.model);
        allVehicles = [...allVehicles, ...vehicles];
        stats['kiwicheapcars'] += vehicles.length;
        await delay(CONFIG.delay);
      }
      console.log('');
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
  const outputFile = path.join(CONFIG.outputDir, `multi_source_cars_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.json`);
  const outputData = {
    scrapeDate: new Date().toISOString(),
    totalCount: uniqueVehicles.length,
    sources: Object.keys(SOURCES).filter(k => SOURCES[k].enabled),
    stats: stats,
    config: CONFIG,
    vehicles: uniqueVehicles
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  
  console.log('✅ 数据抓取完成!');
  console.log(`💾 数据已保存到: ${outputFile}`);
  console.log(`📊 抓取到 ${uniqueVehicles.length} 辆符合条件的车辆`);
  console.log('');
  
  // 统计
  console.log('📈 数据源分布:');
  Object.entries(stats).forEach(([source, count]) => {
    if (count > 0) {
      console.log(`   ${source}: ${count} 辆`);
    }
  });
  
  const modelCounts = {};
  for (const v of uniqueVehicles) {
    const key = `${v.make} ${v.model}`;
    modelCounts[key] = (modelCounts[key] || 0) + 1;
  }
  
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
    await scrapeAllSources();
    
    console.log('');
    console.log('✅ 任务完成!');
    
  } catch (error) {
    console.error('❌ 任务失败:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { scrapeAllSources };
