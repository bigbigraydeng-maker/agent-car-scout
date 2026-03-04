/**
 * 新西兰二手车数据抓取脚本
 * 优先抓取 car scout 目前抓取的车型
 * 条件：2006年以后，不超过18万公里
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// 配置
const CONFIG = {
  // 从 car scout 配置文件中提取的车型
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
  // 地区
  locations: [
    { name: 'Auckland', regionId: '1' },
    { name: 'Waikato', regionId: '14' }
  ],
  // 用户要求的条件
  minYear: 2006,
  maxMileage: 180000,
  minPrice: 2000,
  maxPrice: 15000,
  // 输出目录
  outputDir: path.join(__dirname, 'data'),
  // 延迟时间（避免被封禁）
  delay: 3000
};

/**
 * 生成 TradeMe 搜索 URL
 */
function generateTradeMeURL(make, model, regionId) {
  const baseUrl = `https://www.trademe.co.nz/a/motors/cars/${make}/${model}/search`;
  const params = new URLSearchParams({
    price_min: CONFIG.minPrice.toString(),
    price_max: CONFIG.maxPrice.toString(),
    year_min: CONFIG.minYear.toString(),
    odometer_max: CONFIG.maxMileage.toString(),
    seller_type: 'private' // 只抓取私人卖家
  });
  
  if (regionId) {
    params.set('region', regionId);
  }
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * 延迟函数
 */
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 抓取单个页面
 */
async function scrapePage(page, url) {
    console.log(`🔍 抓取: ${url}`);
    
    try {
      // 设置更真实的用户代理
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // 导航到页面
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 滚动加载更多结果（多次滚动）
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // 提取车辆数据
      const vehicles = await page.evaluate(() => {
        const items = [];
        
        // 尝试不同的选择器，更全面
        const selectors = [
          '.tm-motors-vehicle-card',
          '.listing-card',
          '.search-result__listing',
          '.o-card',
          '.l-search-results__listing',
          '.tm-search-card',
          '.trade-me-listing',
          '[data-testid="listing-card"]',
          '.card-listing',
          '.result-item'
        ];
        
        let cards = [];
        for (const selector of selectors) {
          const found = document.querySelectorAll(selector);
          if (found.length > 0) {
            cards = found;
            break;
          }
        }
        
        console.log(`Total cards found: ${cards.length}`);
        
        cards.forEach(card => {
          try {
            // 尝试不同的标题选择器
            const titleElement = card.querySelector('h2, h3, .title, .listing-title, .o-card__title, .tm-search-card__title, .trade-me-listing__title, .card-title, .result-title');
            // 尝试不同的价格选择器
            const priceElement = card.querySelector('.price, .listing-price, .o-card__price, .tm-search-card__price, .trade-me-listing__price, .card-price, .result-price');
            // 尝试不同的链接选择器
            const linkElement = card.querySelector('a[href*="listing"], a[href*="/a/motors/cars/"]');
            
            if (titleElement && priceElement && linkElement) {
              const title = titleElement.textContent.trim();
              const price = priceElement.textContent.trim();
              const url = linkElement.href;
              
              // 尝试获取位置和详情
              const locationElement = card.querySelector('.location, .listing-location, .o-card__location, .tm-search-card__location, .trade-me-listing__location, .card-location, .result-location');
              const detailsElement = card.querySelector('.details, .listing-details, .o-card__detail, .tm-search-card__details, .trade-me-listing__details, .card-details, .result-details');
              
              const location = locationElement ? locationElement.textContent.trim() : '';
              const details = detailsElement ? detailsElement.textContent.trim() : '';
              
              items.push({
                title,
                price,
                location,
                url,
                details
              });
            }
          } catch (error) {
            console.error('Error extracting vehicle:', error.message);
          }
        });
        
        // 如果没有找到车辆，尝试直接从页面文本中提取
        if (items.length === 0) {
          console.log('Trying alternative extraction method...');
          
          const pageText = document.body.textContent;
          const lines = pageText.split('\n').map(line => line.trim()).filter(line => line);
          
          let currentVehicle = null;
          lines.forEach((line, index) => {
            // 检查是否是价格行
            if (line.includes('$') && !line.includes('Price') && !line.includes('price')) {
              if (currentVehicle) {
                currentVehicle.price = line;
                items.push({...currentVehicle});
                currentVehicle = null;
              }
            }
            // 检查是否是标题行
            else if (line.length > 10 && !line.includes(' ')) {
              currentVehicle = {
                title: line,
                price: '',
                location: '',
                url: '',
                details: ''
              };
            }
          });
        }
        
        console.log(`Extracted ${items.length} vehicles`);
        return items;
      });
      
      console.log(`✅ 抓取到 ${vehicles.length} 辆车辆`);
      return vehicles;
    } catch (error) {
      console.error('❌ 抓取失败:', error.message);
      return [];
    }
  }

/**
 * 提取车辆 ID
 */
function extractVehicleId(url) {
  const match = url.match(/listing\/(\d+)/);
  return match ? `tm_${match[1]}` : null;
}

/**
 * 提取年份
 */
function extractYear(text) {
  const yearMatch = text.match(/\b(20\d{2})\b/);
  return yearMatch ? parseInt(yearMatch[1]) : null;
}

/**
 * 提取里程
 */
function extractMileage(text) {
  const patterns = [
    /(\d{1,3},\d{3})\s*km/i,
    /(\d{6})\s*km/i,
    /(\d{2,3})\s*,\s*(\d{3})\s*(km|kms|kilometers)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[0].replace(/[^\d]/g, '');
      const mileage = parseInt(numStr);
      if (mileage > 1000 && mileage <= CONFIG.maxMileage) {
        return mileage;
      }
    }
  }
  return null;
}

/**
 * 提取价格
 */
function extractPrice(text) {
  const priceMatch = text.match(/\$([\d,]+)/);
  if (priceMatch) {
    return parseInt(priceMatch[1].replace(/,/g, ''));
  }
  return null;
}

/**
 * 主抓取函数
 */
async function scrapeCars() {
  console.log('🚗 新西兰二手车数据抓取');
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
  let browser;
  
  try {
    // 启动浏览器
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // 遍历所有车型和地区
    for (const model of CONFIG.models) {
      for (const location of CONFIG.locations) {
        const url = generateTradeMeURL(model.make, model.model, location.regionId);
        const vehicles = await scrapePage(page, url);
        
        // 处理抓取到的车辆数据
        const processedVehicles = vehicles.map(vehicle => {
          const id = extractVehicleId(vehicle.url);
          const year = extractYear(vehicle.title);
          const mileage = extractMileage(vehicle.details);
          const price = extractPrice(vehicle.price);
          
          return {
            id: id || `tm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            make: model.make,
            model: model.model,
            title: vehicle.title,
            year: year || CONFIG.minYear,
            price: price || 0,
            mileage: mileage || 0,
            location: vehicle.location,
            description: vehicle.details,
            listingUrl: vehicle.url,
            platform: 'trademe',
            scrapedAt: new Date().toISOString()
          };
        }).filter(vehicle => {
          // 过滤符合条件的车辆
          return vehicle.year >= CONFIG.minYear &&
                 vehicle.mileage <= CONFIG.maxMileage &&
                 vehicle.price >= CONFIG.minPrice &&
                 vehicle.price <= CONFIG.maxPrice;
        });
        
        allVehicles = [...allVehicles, ...processedVehicles];
        
        // 延迟，避免被封禁
        await delay(CONFIG.delay);
      }
    }
    
  } catch (error) {
    console.error('❌ 抓取失败:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  // 保存数据
  const outputFile = path.join(CONFIG.outputDir, `nz_cars_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.json`);
  const outputData = {
    scrapeDate: new Date().toISOString(),
    totalCount: allVehicles.length,
    config: CONFIG,
    vehicles: allVehicles
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  
  console.log(`\n✅ 数据抓取完成!`);
  console.log(`💾 数据已保存到: ${outputFile}`);
  console.log(`📊 抓取到 ${allVehicles.length} 辆符合条件的车辆`);
  console.log('');
  
  return outputData;
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('========================================');
    console.log('新西兰二手车数据抓取');
    console.log('========================================\n');
    
    const result = await scrapeCars();
    
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
