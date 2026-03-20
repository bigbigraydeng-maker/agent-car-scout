/**
 * 使用 Playwright 抓取 TradeMe 数据
 * 模拟真人操作，规避反爬机制
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
  maxPrice: 15000,
  outputDir: path.join(__dirname, 'data'),
  delay: 2000
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeWithPlaywright() {
  console.log('🚗 使用 Playwright 抓取 TradeMe 数据');
  console.log('========================================');
  
  // 确保输出目录存在
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  let allVehicles = [];
  
  const browser = await chromium.launch({
    headless: false, // 设置为 true 可隐藏浏览器
    slowMo: 100 // 减慢操作速度，更像真人
  });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    // 遍历所有车型和地区
    for (const model of CONFIG.models.slice(0, 2)) { // 先测试前2个车型
      for (const location of CONFIG.locations.slice(0, 1)) { // 先测试 Auckland
        const url = `https://www.trademe.co.nz/a/motors/cars/${model.make}/${model.model}/search?price_min=${CONFIG.minPrice}&price_max=${CONFIG.maxPrice}&year_min=${CONFIG.minYear}&odometer_max=${CONFIG.maxMileage}&seller_type=private&region=${location.regionId}`;
        
        console.log(`\n🔍 抓取: ${model.make} ${model.model} - ${location.name}`);
        console.log(`URL: ${url}`);
        
        try {
          // 访问页面
          await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
          
          // 等待页面加载
          await page.waitForTimeout(5000);
          
          // 截图查看页面状态
          await page.screenshot({ 
            path: path.join(CONFIG.outputDir, `screenshot_${model.model}_${location.name}.png`),
            fullPage: true 
          });
          
          // 检查是否有结果
          const resultCount = await page.evaluate(() => {
            // 尝试多种方式查找结果数量
            const countElements = document.querySelectorAll('.tm-search-results-count, .search-results-count, .results-count, [class*="count"]');
            for (const el of countElements) {
              const text = el.textContent;
              if (text && text.match(/\d+/)) {
                return text;
              }
            }
            return null;
          });
          
          if (resultCount) {
            console.log(`📊 找到结果: ${resultCount}`);
          }
          
          // 尝试查找车辆列表
          const vehicles = await page.evaluate(() => {
            const items = [];
            
            // 查找所有可能包含车辆信息的元素
            const allElements = document.querySelectorAll('*');
            
            for (const el of allElements) {
              const text = el.textContent;
              // 检查是否包含价格和年份模式
              if (text && text.includes('$') && text.match(/20\d{2}/)) {
                const parent = el.closest('a, div, article, li');
                if (parent) {
                  const link = parent.querySelector('a[href*="listing"]') || parent.closest('a[href*="listing"]');
                  if (link) {
                    items.push({
                      text: text.substring(0, 200),
                      href: link.href
                    });
                  }
                }
              }
            }
            
            return items;
          });
          
          console.log(`✅ 找到 ${vehicles.length} 个潜在车辆元素`);
          
          if (vehicles.length > 0) {
            console.log('样例数据:');
            console.log(vehicles.slice(0, 3));
          }
          
          // 滚动加载更多
          for (let i = 0; i < 3; i++) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await delay(3000);
          }
          
          await delay(CONFIG.delay);
          
        } catch (error) {
          console.error(`❌ 抓取失败: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ 浏览器错误:', error.message);
  } finally {
    await browser.close();
  }
  
  console.log('\n✅ 测试完成');
  console.log('请查看截图文件了解页面实际情况');
}

// 运行
scrapeWithPlaywright().catch(console.error);
