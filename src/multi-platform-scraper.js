/**
 * Car Scout - Multi-Platform Data Scraper
 * 
 * 功能：
 *   1. 从多个平台抓取车辆数据
 *   2. 标准化不同平台的数据格式
 *   3. 保存为统一的市场估价数据源
 *   4. 支持自定义数据源配置
 * 
 * 支持的平台：
 *   - TradeMe
 *   - Facebook Marketplace
 *   - 自定义网站
 * 
 * 用法：
 *   node src/multi-platform-scraper.js
 *   node src/multi-platform-scraper.js --platform=trademe
 *   node src/multi-platform-scraper.js --update-config
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

// ─── 配置 ───
const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'scraper_config.json');
const OUTPUT_PATH = path.join(DATA_DIR, `market_valuation_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.json`);

// ─── 平台配置 ───
const DEFAULT_PLATFORMS = {
  trademe: {
    name: 'TradeMe',
    enabled: true,
    url: 'https://www.trademe.co.nz/a/motors/cars/search?year_min=2005&price_max=8000&odometer_max=160000&listing_type=private',
    selectors: {
      cards: '[class*="ListingCard"], [class*="tm-search-card"], .tm-motors-search-card',
      link: 'a[href*="/listing/"]',
      title: 'h3, [class*="title"], h2',
      price: '[class*="price"], [class*="Price"], .o-price',
      details: '[class*="details"], [class*="subtitle"]',
      location: '[class*="location"]'
    },
    weight: 1.0
  },
  facebook: {
    name: 'Facebook Marketplace',
    enabled: true,
    url: 'https://www.facebook.com/marketplace/auckland/search/?query=toyota%20corolla&minPrice=2500&maxPrice=8000&category_id=807311116002604',
    selectors: {
      cards: '[class*="x9f619"], [class*="x78zum5"]',
      link: 'a[href*="/marketplace/item/"]',
      title: '[class*="x1lliihq"], [class*="x13fuv20"]',
      price: '[class*="x193iq5w"], [class*="x6ikm8r"]',
      details: '[class*="x1gslohp"], [class*="x1a2a7pz"]',
      location: '[class*="x1lliihq"], [class*="x6ikm8r"]'
    },
    weight: 0.8
  }
};

// ─── 工具函数 ───
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomDelay(min, max) {
  return delay(min + Math.random() * (max - min));
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.log('⚠️ 配置文件不存在，使用默认配置');
    const defaultConfig = {
      platforms: DEFAULT_PLATFORMS,
      customSites: [],
      maxListingsPerPlatform: 50,
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function extractModel(title) {
  const models = [
    'Corolla', 'Vitz', 'RAV4', 'Honda Fit', 'Swift', 'Demio', 'Aqua', 'Prius', 
    'Axela', 'Civic', 'Tiida', 'Wish', 'Yaris', 'Camry', 'Altis', 'Focus', 
    'Mazda3', 'Mazda6', 'Auris', 'Avensis', 'Polo', 'Golf', 'Passat', 'Accent',
    'i30', 'Cerato', 'Sonata', 'Elantra', 'Matrix', 'Estima', 'Previa', 'Sienta',
    'Highlander', '4Runner', 'Hilux', 'Land Cruiser', 'Prado', 'Outback', 'Forester'
  ];
  for (const model of models) {
    if (title.toLowerCase().includes(model.toLowerCase())) {
      return model;
    }
  }
  return 'Other';
}

function extractYear(text) {
  const yearMatch = text.match(/\b(20\d{2}|19\d{2})\b/);
  return yearMatch ? parseInt(yearMatch[1]) : null;
}

function extractMileage(text) {
  const kmMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*km/i);
  if (kmMatch) {
    return parseInt(kmMatch[1].replace(/,/g, ''));
  }
  return null;
}

function extractPrice(text) {
  const priceMatch = text.match(/\$(\d{1,3}(?:,\d{3})*)/);
  if (priceMatch) {
    return parseInt(priceMatch[1].replace(/,/g, ''));
  }
  return null;
}

// ─── 平台爬取器 ───
async function scrapeTradeMe(page, config) {
  console.log('🔍 抓取 TradeMe...');
  
  try {
    await page.goto(config.platforms.trademe.url, {
      waitUntil: 'networkidle2',
      timeout: config.timeout
    });
    await randomDelay(3000, 5000);

    const listings = await page.evaluate((selectors) => {
      const results = [];
      const cards = document.querySelectorAll(selectors.cards);
      
      cards.forEach(card => {
        try {
          const linkEl = card.querySelector(selectors.link) || card.closest(selectors.link);
          if (!linkEl) return;
          
          const href = linkEl.getAttribute('href');
          const url = href.startsWith('http') ? href : 'https://www.trademe.co.nz' + href;
          
          const titleEl = card.querySelector(selectors.title);
          const title = titleEl ? titleEl.textContent.trim() : '';
          
          const priceEl = card.querySelector(selectors.price);
          const priceText = priceEl ? priceEl.textContent.trim() : '';
          const priceMatch = priceText.match(/\$(\d{1,3}(?:,\d{3})*)/);
          const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;
          
          const detailsEl = card.querySelector(selectors.details);
          const details = detailsEl ? detailsEl.textContent.trim() : '';
          
          const locationEl = card.querySelector(selectors.location);
          const location = locationEl ? locationEl.textContent.trim() : 'Auckland';
          
          results.push({
            url,
            title,
            price,
            details,
            location,
            platform: 'trademe'
          });
        } catch (e) {}
      });
      
      return results;
    }, config.platforms.trademe.selectors);

    return listings;
  } catch (e) {
    console.log('❌ TradeMe 抓取失败:', e.message);
    return [];
  }
}

async function scrapeFacebook(page, config) {
  console.log('🔍 抓取 Facebook Marketplace...');
  
  try {
    await page.goto(config.platforms.facebook.url, {
      waitUntil: 'networkidle2',
      timeout: config.timeout
    });
    await randomDelay(3000, 5000);

    const listings = await page.evaluate((selectors) => {
      const results = [];
      const cards = document.querySelectorAll(selectors.cards);
      
      cards.forEach(card => {
        try {
          const linkEl = card.querySelector(selectors.link) || card.closest(selectors.link);
          if (!linkEl) return;
          
          const href = linkEl.getAttribute('href');
          const url = href.startsWith('http') ? href : 'https://www.facebook.com' + href;
          
          const titleEl = card.querySelector(selectors.title);
          const title = titleEl ? titleEl.textContent.trim() : '';
          
          const priceEl = card.querySelector(selectors.price);
          const priceText = priceEl ? priceEl.textContent.trim() : '';
          const priceMatch = priceText.match(/\$(\d{1,3}(?:,\d{3})*)/);
          const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;
          
          const detailsEl = card.querySelector(selectors.details);
          const details = detailsEl ? detailsEl.textContent.trim() : '';
          
          const locationEl = card.querySelector(selectors.location);
          const location = locationEl ? locationEl.textContent.trim() : 'Auckland';
          
          results.push({
            url,
            title,
            price,
            details,
            location,
            platform: 'facebook'
          });
        } catch (e) {}
      });
      
      return results;
    }, config.platforms.facebook.selectors);

    return listings;
  } catch (e) {
    console.log('❌ Facebook 抓取失败:', e.message);
    return [];
  }
}

// ─── 主函数 ───
async function main() {
  console.log('🚀 多平台数据爬取开始...');
  
  const config = loadConfig();
  
  // 启动浏览器
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled'
    ],
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  const page = await browser.newPage();
  await page.setUserAgent(config.userAgent);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-NZ,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
  });

  let allListings = [];
  
  // 抓取 TradeMe
  if (config.platforms.trademe.enabled) {
    const trademeListings = await scrapeTradeMe(page, config);
    allListings = allListings.concat(trademeListings);
  }
  
  // 抓取 Facebook
  if (config.platforms.facebook.enabled) {
    const facebookListings = await scrapeFacebook(page, config);
    allListings = allListings.concat(facebookListings);
  }
  
  // 抓取自定义网站
  for (const site of config.customSites) {
    if (site.enabled) {
      console.log(`🔍 抓取自定义网站: ${site.name}...`);
      // 这里可以添加自定义网站的抓取逻辑
    }
  }
  
  await browser.close();
  
  // 数据处理和标准化
  console.log(`\n📊 处理 ${allListings.length} 条数据...`);
  const processedListings = [];
  
  for (const listing of allListings) {
    if (!listing.price || listing.price < 2500 || listing.price > 8000) continue;
    
    const model = extractModel(listing.title);
    const year = extractYear(listing.title + ' ' + listing.details);
    const km = extractMileage(listing.title + ' ' + listing.details);
    
    if (!model || !year || !km) continue;
    
    processedListings.push({
      model,
      year,
      km,
      price: listing.price,
      sellerType: listing.platform === 'trademe' ? 'private' : 'private',
      location: listing.location,
      platform: listing.platform,
      url: listing.url,
      scrapedAt: new Date().toISOString()
    });
  }
  
  console.log(`✅ 处理完成，保留 ${processedListings.length} 条有效数据`);
  
  // 去重
  const uniqueListings = [];
  const seenUrls = new Set();
  
  for (const listing of processedListings) {
    if (!seenUrls.has(listing.url)) {
      seenUrls.add(listing.url);
      uniqueListings.push(listing);
    }
  }
  
  console.log(`✅ 去重后剩余 ${uniqueListings.length} 条数据`);
  
  // 保存数据
  const output = {
    createdAt: new Date().toISOString(),
    source: 'multi-platform',
    platforms: Object.keys(config.platforms).filter(key => config.platforms[key].enabled),
    totalListings: uniqueListings.length,
    listings: uniqueListings
  };
  
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`💾 数据已保存到: ${OUTPUT_PATH}`);
  
  console.log('\n🎉 多平台数据爬取完成！');
  console.log(`📊 统计：`);
  console.log(`   - 总抓取数: ${allListings.length}`);
  console.log(`   - 有效数据: ${processedListings.length}`);
  console.log(`   - 去重后: ${uniqueListings.length}`);
  console.log(`   - 保存文件: ${OUTPUT_PATH}`);
}

// ─── 命令行参数处理 ───
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--update-config')) {
    const config = loadConfig();
    console.log('📝 当前配置:');
    console.log(JSON.stringify(config, null, 2));
    process.exit(0);
  }
  
  main().catch(e => {
    console.error('❌ 抓取失败:', e);
    process.exit(1);
  });
}

module.exports = {
  main,
  loadConfig,
  saveConfig
};