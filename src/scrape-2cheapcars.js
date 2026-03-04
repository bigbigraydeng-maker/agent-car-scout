/**
 * 2CheapCars Scraper
 * 抓取 2cheapcars.co.nz 的车商售价数据
 * 
 * 用途：获取车商售价参考，了解市场行情
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const DATA_DIR = path.join(__dirname, '..', 'data');

const SEARCH_URLS = [
  'https://www.2cheapcars.co.nz/used-cars/toyota',
  'https://www.2cheapcars.co.nz/used-cars/honda',
  'https://www.2cheapcars.co.nz/used-cars/nissan',
  'https://www.2cheapcars.co.nz/used-cars/mazda'
];

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function scrape2CheapCars() {
  console.log('🚗 2CheapCars 抓取开始...');
  console.log(`⏰ ${new Date().toLocaleString('zh-CN')}`);
  console.log('');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const allVehicles = [];

  for (const url of SEARCH_URLS) {
    const brand = url.split('/').pop();
    console.log(`🔍 扫描 ${brand.toUpperCase()}...`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(3000);

      const vehicles = await page.evaluate(() => {
        const results = [];
        
        // 2CheapCars 车辆卡片选择器
        const cards = document.querySelectorAll('.vehicle-card, .car-card, [class*="vehicle"], [class*="car-item"]');
        
        cards.forEach(card => {
          try {
            // 标题
            const titleEl = card.querySelector('h3, h2, .title, [class*="title"]');
            const title = titleEl ? titleEl.textContent.trim() : '';
            
            // 价格
            const priceEl = card.querySelector('.price, [class*="price"], .cost');
            let price = null;
            if (priceEl) {
              const priceText = priceEl.textContent.trim();
              const match = priceText.match(/\$?([\d,]+)/);
              if (match) {
                price = parseInt(match[1].replace(/,/g, ''));
              }
            }
            
            // 年份
            const yearMatch = title.match(/\b(20\d{2})\b/);
            const year = yearMatch ? parseInt(yearMatch[1]) : null;
            
            // 里程
            const kmMatch = title.match(/(\d{1,3}(?:,\d{3})*)\s*km/i);
            const mileage = kmMatch ? parseInt(kmMatch[1].replace(/,/g, '')) : null;
            
            // 链接
            const linkEl = card.querySelector('a');
            const url = linkEl ? linkEl.href : '';
            
            if (title && price) {
              results.push({
                title,
                price,
                year,
                mileage,
                url,
                platform: '2cheapcars',
                sellerType: 'dealer',
                scrapedAt: new Date().toISOString()
              });
            }
          } catch (e) {}
        });
        
        return results;
      });

      console.log(`   ✅ 找到 ${vehicles.length} 辆车`);
      allVehicles.push(...vehicles);

    } catch (error) {
      console.error(`   ❌ 扫描失败: ${error.message}`);
    }

    await delay(2000);
  }

  await browser.close();

  // 保存数据
  const outputFile = path.join(DATA_DIR, `2cheapcars_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.json`);
  fs.writeFileSync(outputFile, JSON.stringify({
    platform: '2cheapcars',
    scrapedAt: new Date().toISOString(),
    count: allVehicles.length,
    vehicles: allVehicles
  }, null, 2));

  console.log('');
  console.log(`💾 数据已保存: ${outputFile}`);
  console.log(`📊 总计: ${allVehicles.length} 辆车`);
  
  // 统计
  if (allVehicles.length > 0) {
    const avgPrice = Math.round(allVehicles.reduce((a, b) => a + b.price, 0) / allVehicles.length);
    console.log(`💰 平均价格: $${avgPrice.toLocaleString()}`);
  }

  console.log('✅ 2CheapCars 抓取完成!');
  return allVehicles;
}

// 运行
if (require.main === module) {
  scrape2CheapCars().catch(console.error);
}

module.exports = { scrape2CheapCars };
