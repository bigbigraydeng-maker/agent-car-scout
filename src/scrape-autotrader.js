/**
 * AutoTrader Scraper
 * 抓取 autotrader.co.nz 的私人卖家车辆数据
 * 
 * 用途：获取私人卖家挂牌价，补充TradeMe数据
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const DATA_DIR = path.join(__dirname, '..', 'data');

// AutoTrader 搜索URL（按品牌分类）
const SEARCH_URLS = [
  'https://www.autotrader.co.nz/used-cars-for-sale/toyota/',
  'https://www.autotrader.co.nz/used-cars-for-sale/honda/',
  'https://www.autotrader.co.nz/used-cars-for-sale/nissan/',
  'https://www.autotrader.co.nz/used-cars-for-sale/mazda/'
];

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function scrapeAutoTrader() {
  console.log('🚗 AutoTrader 抓取开始...');
  console.log(`⏰ ${new Date().toLocaleString('zh-CN')}`);
  console.log('');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  const allVehicles = [];

  for (const url of SEARCH_URLS) {
    const brand = url.split('/').slice(-2)[0];
    console.log(`🔍 扫描 ${brand.toUpperCase()}...`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(4000); // 等待页面加载

      // 可能需要点击"Load More"按钮
      let loadMoreClicked = 0;
      while (loadMoreClicked < 3) {
        try {
          const loadMoreBtn = await page.$('[class*="load-more"], button:has-text("Load"), button:has-text("More")');
          if (loadMoreBtn) {
            await loadMoreBtn.click();
            await delay(2000);
            loadMoreClicked++;
          } else {
            break;
          }
        } catch (e) {
          break;
        }
      }

      const vehicles = await page.evaluate(() => {
        const results = [];
        
        // AutoTrader 车辆卡片选择器
        const cards = document.querySelectorAll('.listing-card, .vehicle-card, .search-result, [class*="listing"], [class*="vehicle"]');
        
        cards.forEach(card => {
          try {
            // 标题
            const titleEl = card.querySelector('h2, h3, .title, [class*="title"]');
            const title = titleEl ? titleEl.textContent.trim() : '';
            
            // 价格
            const priceEl = card.querySelector('.price, [class*="price"], .amount');
            let price = null;
            if (priceEl) {
              const priceText = priceEl.textContent.trim();
              const match = priceText.match(/\$?([\d,]+)/);
              if (match) {
                price = parseInt(match[1].replace(/,/g, ''));
              }
            }
            
            // 年份
            const yearMatch = title.match(/\b(20\d{2}|19\d{2})\b/);
            const year = yearMatch ? parseInt(yearMatch[1]) : null;
            
            // 里程 - 查找包含km的元素
            let mileage = null;
            const kmEl = card.querySelector('*'); // 搜索所有文本
            if (kmEl) {
              const text = card.textContent;
              const kmMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*km/i);
              if (kmMatch) {
                mileage = parseInt(kmMatch[1].replace(/,/g, ''));
              }
            }
            
            // 链接
            const linkEl = card.querySelector('a[href*="/listing/"], a[href*="/car/"]') || card.closest('a');
            let url = '';
            if (linkEl) {
              const href = linkEl.getAttribute('href');
              url = href.startsWith('http') ? href : 'https://www.autotrader.co.nz' + href;
            }
            
            // 位置
            const locationEl = card.querySelector('[class*="location"], [class*="region"]');
            const location = locationEl ? locationEl.textContent.trim() : 'Auckland';
            
            if (title && price && year) {
              results.push({
                title,
                price,
                year,
                mileage,
                url,
                location,
                platform: 'autotrader',
                sellerType: 'private',
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

    await delay(3000); // 避免被封
  }

  await browser.close();

  // 保存数据
  const outputFile = path.join(DATA_DIR, `autotrader_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.json`);
  fs.writeFileSync(outputFile, JSON.stringify({
    platform: 'autotrader',
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
    const minPrice = Math.min(...allVehicles.map(v => v.price));
    const maxPrice = Math.max(...allVehicles.map(v => v.price));
    console.log(`💰 价格范围: $${minPrice.toLocaleString()} - $${maxPrice.toLocaleString()}`);
    console.log(`💰 平均价格: $${avgPrice.toLocaleString()}`);
  }

  console.log('✅ AutoTrader 抓取完成!');
  return allVehicles;
}

// 运行
if (require.main === module) {
  scrapeAutoTrader().catch(console.error);
}

module.exports = { scrapeAutoTrader };
