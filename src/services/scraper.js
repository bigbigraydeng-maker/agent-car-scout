/**
 * TradeMe 爬虫 — 针对 3 款精品车型优化
 *
 * 与旧版的区别:
 *   - 价格范围按车型正确设置 (Alphard/Vellfire $20k-90k, Prius $6k-38k)
 *   - 解析 grade/年份/里程更准确
 *   - 结果直接写入 Supabase listings 表
 *   - 无 Supabase 时写入本地 JSON 文件 (data/scraped_*.json)
 *
 * 使用 Puppeteer + stealth 插件绕过基础爬虫检测。
 * TradeMe 有反爬机制，建议频率: 每次间隔 3-5s，每天最多 2-3 轮。
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');
const { supabaseAdmin, TABLES } = require('../config/supabase');
const { VEHICLES } = require('../data/vehicles');

puppeteer.use(StealthPlugin());

const DATA_DIR = path.join(__dirname, '../../data');

// ─── TradeMe 搜索 URL 构造 ────────────────────────────────────
function buildSearchUrl(vehicle, pageNum = 1) {
  const { priceMin, priceMax, yearMin, query } = vehicle.trademeSearch;
  const base = 'https://www.trademe.co.nz/a/motors/cars/toyota/search';
  const params = new URLSearchParams({
    q:            query,
    price_min:    priceMin,
    price_max:    priceMax,
    year_min:     yearMin,
    sort_order:   'expirydesc',
    rows:         '60',
    page:         pageNum,
  });
  return `${base}?${params.toString()}`;
}

// ─── 浏览器管理 ───────────────────────────────────────────────
async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,900',
    ],
  });
}

// ─── 单页抓取 ─────────────────────────────────────────────────
async function scrapePage(page, url, modelName) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForTimeout(2500 + Math.random() * 1500);

  // 滚动加载懒加载内容
  await page.evaluate(async () => {
    for (let i = 0; i < 4; i++) {
      window.scrollBy(0, window.innerHeight * 0.8);
      await new Promise(r => setTimeout(r, 600));
    }
  });

  return page.evaluate((modelName) => {
    const results = [];

    // TradeMe 的 DOM 结构会变动，这里用多个选择器兜底
    const cards = document.querySelectorAll(
      '[class*="ListingCard"], [class*="listing-card"], [data-testid*="listing"], .tm-motors-search-card__body'
    );

    cards.forEach(card => {
      try {
        const linkEl = card.querySelector('a[href*="/listing/"]') || card.closest('a[href*="/listing/"]');
        const href = linkEl?.getAttribute('href') || '';
        if (!href) return;

        const url = href.startsWith('http') ? href : `https://www.trademe.co.nz${href}`;

        // 价格
        const priceText = card.querySelector('[class*="price"], [class*="Price"]')?.textContent || '';
        const priceMatch = priceText.replace(/,/g, '').match(/\$?([\d]+)/);
        const price = priceMatch ? parseInt(priceMatch[1]) : null;
        if (!price || price < 1000) return;

        // 标题
        const title = card.querySelector('h2, h3, [class*="title"]')?.textContent?.trim() || '';

        // 详情行 (年份、里程、变速箱)
        const detailText = card.textContent || '';

        // 年份: 4位数字
        const yearMatch = title.match(/20\d{2}/) || detailText.match(/\b(200[5-9]|20[1-2]\d)\b/);
        const year = yearMatch ? parseInt(yearMatch[0]) : null;

        // 里程: 数字 + km
        const kmMatch = detailText.match(/([\d,]+)\s*km/i);
        const km = kmMatch ? parseInt(kmMatch[1].replace(/,/g, '')) : null;

        // 卖家类型
        const isDealer = /dealer|motors|auto|cars\s+ltd|ltd|limited/i.test(detailText);
        const sellerType = isDealer ? 'dealer' : 'private';

        // 地点
        const locationEl = card.querySelector('[class*="location"], [class*="suburb"]');
        const location = locationEl?.textContent?.trim() || '';

        // 从标题猜配置
        const gradeMatch = title.match(/executive\s+lounge|ex\s+lounge|ZG|ZR|ZGE|S\s+A\s+package|A\s+premium\s+tss|A\s+premium|G\s+L|G\s+F|\bZR\b|\bZG\b|\bZR\b|\b[GS]\b/i);
        const grade = gradeMatch ? gradeMatch[0].trim() : null;

        // 型号代码
        const codeMatch = title.match(/[AG](?:Y|G)H30W|ZVW[35][015]|[A-Z]{3}\d{2}[A-Z]/i);
        const modelCode = codeMatch ? codeMatch[0].toUpperCase() : null;

        results.push({
          url,
          title,
          price,
          year,
          km,
          sellerType,
          location,
          grade,
          modelCode,
          model: modelName,
          platform: 'trademe',
          scrapedAt: new Date().toISOString(),
        });
      } catch (_) { /* skip bad card */ }
    });

    return results;
  }, modelName);
}

// ─── 主爬取函数 ───────────────────────────────────────────────
/**
 * 爬取单个车型 (可选多页)
 * @param {string} modelKey  - 'alphard' | 'vellfire' | 'prius'
 * @param {number} pages     - 爬取页数 (默认 2)
 */
async function scrapeModel(modelKey, pages = 2) {
  const vehicle = VEHICLES[modelKey];
  if (!vehicle) throw new Error(`Unknown model: ${modelKey}`);

  console.log(`🔍 [Scraper] ${vehicle.model} — ${pages} page(s)`);

  let browser;
  const allListings = [];

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 900 });

    for (let p = 1; p <= pages; p++) {
      const url = buildSearchUrl(vehicle, p);
      console.log(`   Page ${p}: ${url.split('?')[0]}?…`);

      try {
        const listings = await scrapePage(page, url, vehicle.model);
        console.log(`   → ${listings.length} listings`);
        allListings.push(...listings);

        if (p < pages) {
          await page.waitForTimeout(3000 + Math.random() * 2000);
        }
      } catch (pageErr) {
        console.warn(`   Page ${p} failed:`, pageErr.message);
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  // 去重 (同 URL)
  const seen = new Set();
  const unique = allListings.filter(l => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });

  console.log(`✅ [${vehicle.model}] ${unique.length} unique listings`);
  return unique;
}

/**
 * 爬取所有 3 款车型并存储
 * @param {string[]} models  - 默认全部
 * @param {number} pages
 */
async function scrapeAll(models = ['alphard', 'vellfire', 'prius'], pages = 2) {
  const results = {};

  for (const modelKey of models) {
    try {
      const listings = await scrapeModel(modelKey, pages);
      results[modelKey] = listings;
      await saveListings(modelKey, listings);
    } catch (err) {
      console.error(`❌ [${modelKey}] scrape failed:`, err.message);
      results[modelKey] = [];
    }
  }

  return results;
}

/**
 * 保存挂牌数据 → Supabase or local JSON
 */
async function saveListings(modelKey, listings) {
  if (listings.length === 0) return;

  if (supabaseAdmin) {
    // 写入 Supabase
    const rows = listings.map(l => ({
      model:       VEHICLES[modelKey].model,
      model_key:   modelKey,
      title:       l.title,
      price:       l.price,
      year:        l.year,
      km:          l.km,
      grade:       l.grade,
      model_code:  l.modelCode,
      seller_type: l.sellerType,
      location:    l.location,
      url:         l.url,
      platform:    l.platform,
      scraped_at:  l.scrapedAt,
    }));

    const { error } = await supabaseAdmin
      .from(TABLES.LISTINGS)
      .upsert(rows, { onConflict: 'url', ignoreDuplicates: false });

    if (error) {
      console.error('Supabase upsert error:', error.message);
    } else {
      console.log(`💾 Saved ${rows.length} rows to Supabase (${modelKey})`);
    }
  } else {
    // 写入本地 JSON (离线模式)
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const file = path.join(DATA_DIR, `scraped_${modelKey}_${date}.json`);
    fs.writeFileSync(file, JSON.stringify({ modelKey, listings, scrapedAt: new Date().toISOString() }, null, 2));
    console.log(`💾 Saved ${listings.length} listings to ${path.basename(file)}`);
  }
}

/**
 * 从本地 JSON 读取最近的离线数据 (无 Supabase 时的 fallback)
 */
function loadLocalListings(modelKey) {
  if (!fs.existsSync(DATA_DIR)) return [];
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith(`scraped_${modelKey}_`) && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return [];

  try {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, files[0]), 'utf8'));
    return data.listings || [];
  } catch (_) {
    return [];
  }
}

module.exports = { scrapeModel, scrapeAll, saveListings, loadLocalListings };
