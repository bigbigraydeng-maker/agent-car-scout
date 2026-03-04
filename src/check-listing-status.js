/**
 * check-listing-status.js
 * 检查车辆listing是否仍在售
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function checkListingStatus(url, timeout = 8000) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    
    // 等待页面加载
    await page.waitForTimeout(2000);
    
    // 检查是否已售或下架
    const pageContent = await page.content();
    const pageText = await page.evaluate(() => document.body.innerText);
    
    // 检查已售标记
    const soldIndicators = [
      'sold',
      'listing closed',
      'this listing has closed',
      'no longer available',
      'auction closed',
      'listing ended'
    ];
    
    const isSold = soldIndicators.some(indicator => 
      pageText.toLowerCase().includes(indicator)
    );
    
    // 检查是否是404或错误页面
    const isError = pageContent.includes('404') || 
                   pageText.toLowerCase().includes('page not found') ||
                   pageText.toLowerCase().includes('something went wrong');
    
    await browser.close();
    
    return {
      available: !isSold && !isError,
      sold: isSold,
      error: isError
    };
    
  } catch (error) {
    await browser.close();
    return {
      available: false,
      sold: false,
      error: true,
      message: error.message
    };
  }
}

async function checkListingsStatus(listings, maxConcurrent = 5) {
  const available = [];
  const unavailable = [];
  
  console.log(`Checking ${listings.length} listings...`);
  
  for (let i = 0; i < listings.length; i += maxConcurrent) {
    const batch = listings.slice(i, i + maxConcurrent);
    const results = await Promise.all(
      batch.map(async (listing) => {
        const status = await checkListingStatus(listing.url);
        return { listing, status };
      })
    );
    
    results.forEach(({ listing, status }) => {
      if (status.available) {
        available.push(listing);
      } else {
        unavailable.push({ ...listing, status });
      }
    });
    
    // 短暂延迟避免被封
    if (i + maxConcurrent < listings.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return { available, unavailable };
}

module.exports = {
  checkListingStatus,
  checkListingsStatus
};
