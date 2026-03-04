/**
 * 新西兰二手车数据抓取脚本 - Playwright 版本
 * 优先抓取 car scout 目前抓取的车型
 * 条件：2006年以后，不超过18万公里
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
  locations: [
    { name: 'Auckland', regionId: '1' },
    { name: 'Waikato', regionId: '14' }
  ],
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
 * 提取车辆信息
 */
function extractVehicleInfo(text, href) {
  const info = {
    id: null,
    make: '',
    model: '',
    year: null,
    price: null,
    mileage: null,
    location: '',
    title: '',
    listingUrl: href,
    platform: 'trademe',
    scrapedAt: new Date().toISOString()
  };

  // 从 URL 提取 listing ID
  const idMatch = href.match(/listing\/(\d+)/);
  if (idMatch) {
    info.id = `tm_${idMatch[1]}`;
  }

  // 提取年份 (2006-2026)
  const yearMatch = text.match(/\b(20[0-2]\d)\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year >= 2006 && year <= 2026) {
      info.year = year;
    }
  }

  // 提取价格
  const priceMatch = text.match(/\$([\d,]+)/);
  if (priceMatch) {
    info.price = parseInt(priceMatch[1].replace(/,/g, ''));
  }

  // 提取里程 (km)
  const mileageMatch = text.match(/(\d{1,3},?\d{3})\s*km/i);
  if (mileageMatch) {
    info.mileage = parseInt(mileageMatch[1].replace(/,/g, ''));
  }

  // 提取位置
  const locationPatterns = [
    /([A-Za-z\s]+,\s*(Auckland|Waikato|Wellington|Christchurch|Dunedin))/i,
    /(North Shore|Manukau|Waitakere|Hamilton|Rotorua)/i
  ];
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.location = match[0];
      break;
    }
  }

  // 提取标题（前100个字符）
  const lines = text.split('\n').filter(line => line.trim());
  for (const line of lines) {
    if (line.length > 10 && line.length < 100 && !line.includes('$')) {
      info.title = line.trim();
      break;
    }
  }

  return info;
}

/**
 * 抓取单个页面
 */
async function scrapePage(page, url, make, model) {
  console.log(`🔍 抓取: ${make} ${model}`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await delay(5000);
    
    // 检查是否有结果
    const resultText = await page.evaluate(() => {
      const countElements = document.querySelectorAll('.tm-search-results-count, .search-results-count, .results-count');
      for (const el of countElements) {
        return el.textContent;
      }
      return null;
    });
    
    if (resultText) {
      console.log(`   📊 ${resultText}`);
    }
    
    // 滚动加载更多
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(2000);
    }
    
    // 提取车辆数据
    const vehicles = await page.evaluate(() => {
      const items = [];
      const seenUrls = new Set();
      
      // 查找所有链接
      const links = document.querySelectorAll('a[href*="listing"]');
      
      for (const link of links) {
        const href = link.href;
        if (seenUrls.has(href)) continue;
        seenUrls.add(href);
        
        // 获取链接周围的文本
        const parent = link.closest('div, article, li, section');
        if (parent) {
          const text = parent.textContent;
          // 检查是否包含价格信息
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
    
    console.log(`   ✅ 找到 ${vehicles.length} 辆车辆`);
    
    // 处理车辆数据
    const processedVehicles = vehicles.map(v => {
      const info = extractVehicleInfo(v.text, v.href);
      info.make = make;
      info.model = model;
      return info;
    }).filter(v => {
      // 过滤符合条件的车辆
      return v.year && v.year >= CONFIG.minYear &&
             v.mileage && v.mileage <= CONFIG.maxMileage &&
             v.price && v.price >= CONFIG.minPrice &&
             v.price <= CONFIG.maxPrice;
    });
    
    console.log(`   ✅ 符合筛选条件: ${processedVehicles.length} 辆`);
    
    return processedVehicles;
    
  } catch (error) {
    console.error(`   ❌ 抓取失败: ${error.message}`);
    return [];
  }
}

/**
 * 主抓取函数
 */
async function scrapeCars() {
  console.log('🚗 新西兰二手车数据抓取 (Playwright)');
  console.log('========================================');
  console.log('');
  console.log('📋 配置:');
  console.log(`   - 车型: ${CONFIG.models.map(m => m.make + ' ' + m.model).join(', ')}`);
  console.log(`   - 地区: ${CONFIG.locations.map(l => l.name).join(', ')}`);
  console.log(`   - 年份: >= ${CONFIG.minYear}`);
  console.log(`   - 里程: <= ${CONFIG.maxMileage} km`);
  console.log(`   - 价格: $${CONFIG.minPrice} - $${CONFIG.maxPrice}`);
  console.log('');
  
  // 确保输出目录存在
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
    
    // 遍历所有车型和地区
    for (const model of CONFIG.models) {
      for (const location of CONFIG.locations) {
        const url = `https://www.trademe.co.nz/a/motors/cars/${model.make}/${model.model}/search?price_min=${CONFIG.minPrice}&price_max=${CONFIG.maxPrice}&year_min=${CONFIG.minYear}&odometer_max=${CONFIG.maxMileage}&seller_type=private&region=${location.regionId}`;
        
        const vehicles = await scrapePage(page, url, model.make, model.model);
        allVehicles = [...allVehicles, ...vehicles];
        
        await delay(CONFIG.delay);
      }
    }
    
  } catch (error) {
    console.error('❌ 浏览器错误:', error.message);
  } finally {
    await browser.close();
  }
  
  // 去重（基于 ID）
  const uniqueVehicles = [];
  const seenIds = new Set();
  for (const v of allVehicles) {
    if (v.id && !seenIds.has(v.id)) {
      seenIds.add(v.id);
      uniqueVehicles.push(v);
    }
  }
  
  // 保存数据
  const outputFile = path.join(CONFIG.outputDir, `nz_cars_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.json`);
  const outputData = {
    scrapeDate: new Date().toISOString(),
    totalCount: uniqueVehicles.length,
    config: CONFIG,
    vehicles: uniqueVehicles
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  
  console.log('');
  console.log('✅ 数据抓取完成!');
  console.log(`💾 数据已保存到: ${outputFile}`);
  console.log(`📊 抓取到 ${uniqueVehicles.length} 辆符合条件的车辆`);
  console.log('');
  
  // 显示统计
  const modelCounts = {};
  for (const v of uniqueVehicles) {
    const key = `${v.make} ${v.model}`;
    modelCounts[key] = (modelCounts[key] || 0) + 1;
  }
  
  console.log('📈 各车型数量:');
  for (const [model, count] of Object.entries(modelCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${model}: ${count} 辆`);
  }
  
  return outputData;
}

/**
 * 主函数
 */
async function main() {
  try {
    const result = await scrapeCars();
    
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

// 运行
if (require.main === module) {
  main();
}

module.exports = { scrapeCars };
