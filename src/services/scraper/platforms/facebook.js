/**
 * Facebook Marketplace 平台爬取器
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

class FacebookScraper {
  constructor() {
    this.baseUrl = 'https://www.facebook.com';
    this.selectors = {
      cards: '[class*="x9f619"], [class*="x78zum5"]',
      link: 'a[href*="/marketplace/item/"]',
      title: '[class*="x1lliihq"], [class*="x13fuv20"]',
      price: '[class*="x193iq5w"], [class*="x6ikm8r"]',
      details: '[class*="x1gslohp"], [class*="x1a2a7pz"]',
      location: '[class*="x1lliihq"], [class*="x6ikm8r"]'
    };
  }

  async scrape(model, limit = 50) {
    console.log(`🔍 开始抓取 Facebook Marketplace - ${model}...`);
    
    const browser = await this.launchBrowser();
    const page = await browser.newPage();
    
    try {
      // 设置用户代理
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      
      // 导航到搜索页面
      const searchUrl = `${this.baseUrl}/marketplace/auckland/search/?query=${encodeURIComponent(model)}&minPrice=2500&maxPrice=8000&category_id=807311116002604`;
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      // 等待页面加载
      await page.waitForTimeout(3000);
      
      // 滚动页面加载更多内容
      await this.scrollPage(page, 3);
      
      // 提取数据
      const listings = await page.evaluate((selectors, model) => {
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
            
            // 提取年份和公里数
            const yearMatch = (title + ' ' + details).match(/\b(20\d{2}|19\d{2})\b/);
            const year = yearMatch ? parseInt(yearMatch[1]) : null;
            
            const kmMatch = (title + ' ' + details).match(/(\d{1,3}(?:,\d{3})*)\s*km/i);
            const km = kmMatch ? parseInt(kmMatch[1].replace(/,/g, '')) : null;
            
            if (price && year && km) {
              results.push({
                url,
                title,
                model: model,
                year,
                km,
                price,
                seller_type: 'private',
                location,
                platform: 'facebook',
                scraped_at: new Date().toISOString()
              });
            }
          } catch (e) {
            console.log('Error parsing Facebook listing:', e);
          }
        });
        
        return results;
      }, this.selectors, model);
      
      // 限制返回数量
      const limitedListings = listings.slice(0, limit);
      console.log(`✅ Facebook 抓取完成，获取 ${limitedListings.length} 条数据`);
      
      return limitedListings;
    } catch (error) {
      console.error('❌ Facebook 抓取失败:', error);
      return [];
    } finally {
      await browser.close();
    }
  }

  async launchBrowser() {
    return puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });
  }

  async scrollPage(page, scrollCount = 3) {
    for (let i = 0; i < scrollCount; i++) {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(2000);
    }
  }
}

module.exports = new FacebookScraper();