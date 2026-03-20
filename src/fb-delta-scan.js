/**
 * Car Scout — FB Marketplace 增量扫描
 *
 * 功能:
 *   1. 快速扫描 FB 搜索页，提取 listing ID + 价格 + 标题
 *   2. 与已知数据对比，识别 NEW / SOLD
 *   3. 仅对新 listing 抓取详情页
 *   4. 跟进池已售检测
 *   5. 热门新车即时推飞书
 *
 * 用法:
 *   node fb-delta-scan.js           正常增量扫描
 *   node fb-delta-scan.js --dry     只扫搜索页，不抓详情
 *   node fb-delta-scan.js --quiet   抑制飞书推送
 *
 * 设计: 每小时运行，Windows Task Scheduler 调度
 * 耗时: ~3-5分钟（搜索2-3min + 新车详情1-2min）
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { scoreVehicles, hasMechanicalIssue } = require('./scoring');

puppeteer.use(StealthPlugin());

// ─── CONFIG ───
const dataDir = path.join(__dirname, '..', 'data');
const FB_DATA_PATH = path.join(dataDir, 'fb_search_all.json');
const SCAN_STATE_PATH = path.join(dataDir, '.fb_scan_state.json');
const POOL_PATH = path.join(dataDir, 'follow_pool.json');
const LOG_PATH = path.join(dataDir, 'fb_scan_log.json');
const COOKIES_PATH = path.join(dataDir, 'fb_cookies.json');

const DRY_RUN = process.argv.includes('--dry');
const QUIET = process.argv.includes('--quiet');
const SOLD_ONLY = process.argv.includes('--sold-only');  // 仅检查跟进池已售状态

const APP_ID = 'cli_a917a9e3af391cbb';
const APP_SECRET = 'JbyS6Xdb1ZuMe6BmXbi9XbGByUkzW7HU';
const USER_OPEN_ID = 'ou_0d858408be4697d6e84aa225ed758373';

// Tier 1: 每次扫描 — 跟进池验证过的高 ROI 车型
const MODELS_T1 = [
  { name: 'Corolla', brand: 'toyota' },
  { name: 'Vitz', brand: 'toyota' },
  { name: 'Honda Fit', brand: 'honda' },
  { name: 'Swift', brand: 'suzuki' },
  { name: 'Demio', brand: 'mazda' },
  { name: 'Aqua', brand: 'toyota' },
];
// Tier 2: 每 3 次扫描 — 利润高但翻转慢
const MODELS_T2 = [
  { name: 'Prius', brand: 'toyota' },
  { name: 'Axela', brand: 'mazda' },
];
// Tier 3: 每 6 次扫描 — 低命中率，偶尔捡漏
const MODELS_T3 = [
  { name: 'RAV4', brand: 'toyota' },
  { name: 'Wish', brand: 'toyota' },
  { name: 'Civic', brand: 'honda' },
  { name: 'Tiida', brand: 'nissan' },
];

const LOCATIONS = ['auckland'];   // Waikato 命中率为 0，去掉省一半时间

const PRICE_MIN = 2500;
const PRICE_MAX = 8000;
const CATEGORY_ID = '807311116002604';  // FB vehicles category

// 飞书推送门槛
const ALERT_MIN_SCORE = 60;

// 总超时 7 分钟（防止进程卡死）
const GLOBAL_TIMEOUT_MS = 7 * 60 * 1000;

// ─── HELPERS ───

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(min, max) { return delay(min + Math.random() * (max - min)); }
function timestamp() { return new Date().toISOString(); }

function log(msg) {
  const ts = new Date().toLocaleTimeString('en-NZ', { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function buildSearchURL(model, location) {
  const query = encodeURIComponent(`${model.brand} ${model.name.toLowerCase()}`);
  // daysSinceListed=1 限制只看最近24h（增量扫描不需要历史）
  // sortBy=creation_time_descend 最新的排前面
  return `https://www.facebook.com/marketplace/${location}/search/?query=${query}&minPrice=${PRICE_MIN}&maxPrice=${PRICE_MAX}&category_id=${CATEGORY_ID}&daysSinceListed=1&sortBy=creation_time_descend`;
}

function getActiveModels(scanCount) {
  let models = [...MODELS_T1]; // 始终扫描 T1（6个）
  if (scanCount % 3 === 0) models.push(...MODELS_T2);  // 每3次加 T2（+2）
  if (scanCount % 6 === 0) models.push(...MODELS_T3);   // 每6次加 T3（+4）
  return models;
}

// ─── SEARCH PAGE SCRAPER ───

async function scrapeSearchPage(page, url, modelName) {
  try {
    // 用 domcontentloaded 替代 networkidle2 — FB 永远不会真正 idle
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await randomDelay(2500, 4000);  // 给 React 渲染时间

    // 单次滚动足够（daysSinceListed=1 结果少）
    await page.evaluate(() => window.scrollBy(0, 2000));
    await randomDelay(1500, 2500);

    // Extract listings from search results
    const listings = await page.evaluate((modelName) => {
      const results = [];
      const seen = new Set();

      // FB marketplace links contain /item/ or /marketplace/item/
      const links = document.querySelectorAll('a[href*="/marketplace/item/"], a[href*="/item/"]');

      links.forEach(link => {
        const href = link.getAttribute('href') || '';
        const idMatch = href.match(/\/item\/(\d+)/);
        if (!idMatch) return;
        const itemId = idMatch[1];
        if (seen.has(itemId)) return;
        seen.add(itemId);

        // Get the card container
        const card = link.closest('[class*="x9f619"]') || link.closest('div[class]') || link;
        const text = card ? card.innerText : link.innerText;

        // Extract price
        const priceMatch = text.match(/(?:NZ)?\$\s*([\d,]+)/);
        const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;

        // Extract title (first meaningful line)
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
        const title = lines.find(l => !l.startsWith('$') && !l.startsWith('NZ$') && l.length > 5) || lines[0] || '';

        // Check for "Just listed" / "刚刚上架" badge
        const isNew = /just listed|listed .* ago|刚刚上架|new listing/i.test(text);

        // Try to extract year from title
        const yearMatch = title.match(/\b(19\d{2}|20(?:0[0-9]|1[0-9]|2[0-6]))\b/);
        const year = yearMatch ? parseInt(yearMatch[1]) : 0;

        // Extract location
        const locMatch = text.match(/(Auckland|Waikato|Hamilton|Manukau|North Shore|Waitakere|Papakura|Henderson|Albany)/i);
        const location = locMatch ? locMatch[0] : '';

        if (price >= 500) {  // Basic sanity check
          results.push({
            itemId,
            price,
            title,
            year,
            location,
            isNew,
          });
        }
      });

      return results;
    }, modelName);

    return listings;
  } catch (err) {
    log(`  ❌ Search error: ${err.message}`);
    return [];
  }
}

// ─── DETAIL PAGE SCRAPER (reuse from scrape-fb-details.js logic) ───

async function scrapeDetail(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await randomDelay(2500, 4000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('checkpoint')) {
      return { blocked: true };
    }

    // Click "See more"
    try {
      const seeMore = await page.$x("//span[contains(text(),'See more')]");
      if (seeMore.length > 0) { await seeMore[0].click(); await delay(800); }
    } catch(e) { /* ignore */ }

    const data = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      const title = document.querySelector('h1')?.textContent?.trim() ||
                    document.querySelector('title')?.textContent?.trim() || '';

      // Year detection
      const yearPatterns = [
        /\b(19\d{2}|20(?:0[0-9]|1[0-9]|2[0-6]))\s*(?:toyota|honda|mazda|suzuki|nissan)/i,
        /(?:toyota|honda|mazda|suzuki|nissan)\s*(?:\w+\s+)?\b(19\d{2}|20(?:0[0-9]|1[0-9]|2[0-6]))\b/i,
        /\b(19\d{2}|20(?:0[0-9]|1[0-9]|2[0-6]))\s*(?:corolla|vitz|wish|rav4|rav\s*4|fit|demio|aqua|swift|prius|axela|civic|tiida)/i,
        /(?:corolla|vitz|wish|rav4|rav\s*4|fit|demio|aqua|swift|prius|axela|civic|tiida)\s*\b(19\d{2}|20(?:0[0-9]|1[0-9]|2[0-6]))\b/i,
        /(?:my|selling|this)\s+\b(19\d{2}|20(?:0[0-9]|1[0-9]|2[0-6]))\b/i,
      ];
      let year = 0;
      const searchText = title + ' ' + bodyText.substring(0, 2000);
      for (const p of yearPatterns) {
        const m = searchText.match(p);
        if (m) { year = parseInt(m[1]); break; }
      }

      // Mileage detection
      let mileage = 0;
      // Pattern 1: "123456 km" or "123,456 kms" (number + km suffix)
      const rawKm = bodyText.match(/\b([\d,]{4,7})\s*(?:km[sz]?)\b/i);
      if (rawKm) { const km = parseInt(rawKm[1].replace(/,/g, '')); if (km >= 10000 && km <= 500000) mileage = km; }
      // Pattern 2: title shorthand "132km" or "132 kms"
      if (!mileage) {
        const titleKm = title.match(/\b(\d{2,3})\s*(?:km|kms)\b/i);
        if (titleKm) { const km = parseInt(titleKm[1]) * 1000; if (km >= 10000 && km <= 500000) mileage = km; }
      }
      // Pattern 3: "mileage: 123,456 km" (keyword + number + km suffix)
      if (!mileage) {
        const ctxKm = bodyText.match(/(?:done|mileage|odometer|odo|kms?)[:\s]*([\d,]+)\s*(?:km|kms)/i);
        if (ctxKm) { const km = parseInt(ctxKm[1].replace(/,/g, '')); if (km >= 10000 && km <= 500000) mileage = km; }
      }
      // Pattern 4: "Mileage 411380" or "Odometer: 123456" (keyword + number, NO km suffix needed)
      if (!mileage) {
        const labelKm = bodyText.match(/(?:mileage|odometer|odo)[:\s]+([\d,]+)/i);
        if (labelKm) { const km = parseInt(labelKm[1].replace(/,/g, '')); if (km >= 10000 && km <= 500000) mileage = km; }
      }
      // Pattern 5: "kms: 123,456" or "km = 123456" (reverse: km prefix + number)
      if (!mileage) {
        const revKm = bodyText.match(/\bkms?\s*[:=]\s*([\d,]+)\+?/i);
        if (revKm) { const km = parseInt(revKm[1].replace(/,/g, '')); if (km >= 10000 && km <= 500000) mileage = km; }
      }
      
      // Pattern 6: "229xxx" or "229XXX" (shorthand for thousands)
      if (!mileage) {
        const xxxKm = bodyText.match(/\b(\d{2,3})(xxx|XXX)\b/i);
        if (xxxKm) { const km = parseInt(xxxKm[1]) * 1000; if (km >= 10000 && km <= 500000) mileage = km; }
      }

      // Manual transmission
      const isManual = /\bmanual\s*(trans|gear|gearbox|car|vehicle)?\b|(?:5|6)\s*-?\s*speed\s*(manual)?|stick\s*shift/i.test(bodyText)
                    && !/\bautomatic\b/i.test(bodyText);

      // Dealer detection
      let isDealer = false;
      if (/financ(?:e|ing)\s*(?:available|option|welcome)/i.test(bodyText)) isDealer = true;
      if (/\bcar\s*(?:dealer|yard|lot|sales)\b/i.test(bodyText)) isDealer = true;
      if (/\bwe\s+(?:have|sell|offer|also)\b/i.test(bodyText)) isDealer = true;
      if (/\btrade[- ]?in[s]?\s+(?:welcome|accepted)\b/i.test(bodyText)) isDealer = true;

      // Seller name
      const sellerMatch = bodyText.match(/(?:Listed by|Seller|卖家)[:\s]*([^\n]{3,40})/i);
      const sellerName = sellerMatch ? sellerMatch[1].trim() : '';
      if (sellerName.length > 3 && /\b(?:sales|motors?|dealer|trading|imports?|automotive|ltd|limited)\b/i.test(sellerName)) isDealer = true;

      // Description (best effort)
      const spans = Array.from(document.querySelectorAll('span'));
      let desc = '';
      let bestScore = 0;
      for (const s of spans) {
        const t = s.innerText || '';
        if (t.length < 30 || t.length > 3000) continue;
        let score = 0;
        if (/km|mileage|wof|rego|engine|auto|manual|owner/i.test(t)) score += 3;
        if (/condition|drive|run|clean|tidy/i.test(t)) score += 2;
        if (score > bestScore) { bestScore = score; desc = t.substring(0, 1500); }
      }

      // Posted time / availability
      const isUnavailable = /no longer available|this listing|sold|unavailable/i.test(bodyText.substring(0, 500));
      const postedMatch = bodyText.match(/(?:Listed|Posted)\s*(.*?ago|today|yesterday)/i);
      const postedText = postedMatch ? postedMatch[1] : '';

      return { year, mileage, isManual, isDealer, sellerName, description: desc, title, isUnavailable, postedText };
    });

    return data;
  } catch (err) {
    log(`  ❌ Detail error: ${err.message}`);
    return null;
  }
}

// ─── SOLD DETECTION ───

async function checkPoolSoldStatus(page, pool) {
  if (!pool.active || pool.active.length === 0) return { sold: [], alive: 0 };

  const fbItems = pool.active.filter(p => p.platform === 'FB');
  if (fbItems.length === 0) return { sold: [], alive: 0 };

  log(`🔍 Checking ${fbItems.length} follow pool FB items for sold status...`);
  const sold = [];

  for (const item of fbItems) {
    try {
      await page.goto(item.listingUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await randomDelay(1500, 2500);

      const status = await page.evaluate(() => {
        const text = document.body.innerText.substring(0, 500).toLowerCase();
        if (text.includes('no longer available') || text.includes('unavailable')) return 'sold';
        if (text.includes('login') || text.includes('log in to')) return 'blocked';
        return 'alive';
      });

      if (status === 'sold') {
        log(`  ❌ SOLD: ${item.model} $${item.price}`);
        sold.push(item);
      } else if (status === 'blocked') {
        log(`  ⚠️ Login wall — stopping pool check`);
        break;
      } else {
        log(`  ✅ Still listed: ${item.model} $${item.price}`);
      }
    } catch (e) {
      log(`  ⚠️ Check failed for ${item.id}: ${e.message}`);
    }
  }

  return { sold, alive: fbItems.length - sold.length };
}

// ─── FEISHU ALERT ───

function httpReq(options, body) {
  return new Promise((resolve, reject) => {
    const h = https.request(options, res => {
      const d = [];
      res.on('data', c => d.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(d).toString())); }
        catch(e) { resolve(Buffer.concat(d).toString()); }
      });
    });
    h.on('error', reject);
    if (body) h.write(JSON.stringify(body));
    h.end();
  });
}

async function sendFeishuAlert(text) {
  if (QUIET) { log('(--quiet: skipped Feishu alert)'); return; }
  try {
    const tokenRes = await httpReq({
      hostname: 'open.feishu.cn',
      path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { app_id: APP_ID, app_secret: APP_SECRET });

    if (tokenRes.code !== 0) { log('⚠️ Feishu token failed'); return; }

    await httpReq({
      hostname: 'open.feishu.cn',
      path: '/open-apis/im/v1/messages?receive_id_type=open_id',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + tokenRes.tenant_access_token,
        'Content-Type': 'application/json'
      }
    }, {
      receive_id: USER_OPEN_ID,
      msg_type: 'text',
      content: JSON.stringify({ text })
    });
    log('✅ Feishu alert sent');
  } catch (e) {
    log('⚠️ Feishu alert failed: ' + e.message);
  }
}

// ─── MAIN ───

async function main() {
  const startTime = Date.now();
  log('🚀 FB Delta Scan starting...');

  // 1. Load existing data
  let fbData = { vehicles: [] };
  try { fbData = JSON.parse(fs.readFileSync(FB_DATA_PATH, 'utf8')); } catch(e) {}
  const knownIds = new Set(fbData.vehicles.map(v => v.id));
  log(`📦 Known listings: ${knownIds.size}`);

  // 全局超时保护
  const globalTimer = setTimeout(() => {
    log('⏰ 全局超时 (7min)，强制退出');
    process.exit(2);
  }, GLOBAL_TIMEOUT_MS);

  // Load scan state
  let scanState = { lastScan: null, scanCount: 0 };
  try { scanState = JSON.parse(fs.readFileSync(SCAN_STATE_PATH, 'utf8')); } catch(e) {}

  // Load follow pool
  let pool = { active: [], dismissed: [] };
  try { pool = JSON.parse(fs.readFileSync(POOL_PATH, 'utf8')); } catch(e) {}

  // 2. Launch browser
  log('🌐 Launching browser...');
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
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-NZ,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
  });

  // Load FB cookies if available (needed for detail pages & sold check)
  let hasCookies = false;
  try {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    if (Array.isArray(cookies) && cookies.length > 0) {
      await page.setCookie(...cookies);
      hasCookies = true;
      log(`🍪 Loaded ${cookies.length} FB cookies`);
    }
  } catch(e) {
    log('⚠️ No fb_cookies.json — detail pages & sold check may hit login wall');
  }

  // === SOLD-ONLY 模式: 跳过 Phase 1+2, 直接检查跟进池 ===
  const allNew = [];
  let searchCount = 0;
  let blocked = false;
  let enriched = 0;
  let detailBlocked = 0;

  if (SOLD_ONLY) {
    log('🔍 --sold-only 模式: 仅检查跟进池已售状态');
  } else {

  // 3. Scan search pages (分层车型策略)
  const activeModels = getActiveModels(scanState.scanCount || 0);
  log(`🔍 Phase 1: Search page scan (${activeModels.length} models × ${LOCATIONS.length} regions = ${activeModels.length * LOCATIONS.length} searches)...`);

  for (const model of activeModels) {
    if (blocked) break;
    for (const location of LOCATIONS) {
      const url = buildSearchURL(model, location);
      log(`  ${model.name} / ${location}...`);

      const listings = await scrapeSearchPage(page, url, model.name);
      searchCount++;

      // Check for login wall
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('checkpoint')) {
        log('  ⛔ Login wall detected — stopping search scan');
        blocked = true;
        break;
      }

      let newCount = 0;
      for (const l of listings) {
        const id = `fb_${l.itemId}`;
        if (!knownIds.has(id)) {
          newCount++;
          allNew.push({
            id,
            title: l.title,
            model: model.name,
            year: l.year,
            price: l.price,
            mileage: 0,
            location: l.location || (location === 'auckland' ? 'Auckland' : 'Waikato'),
            seller: 'Private',
            description: '',
            listingUrl: `https://www.facebook.com/marketplace/item/${l.itemId}/`,
            platform: 'facebook',
            postedDate: new Date().toISOString().split('T')[0],
            _isNew: true,
            _justListed: l.isNew,
          });
        }
      }

      log(`    → ${listings.length} found, ${newCount} NEW`);
      await randomDelay(2000, 4000);  // 缩短间隔（搜索页不需要太长）
    }
  }

  log(`\n📊 Search scan done: ${searchCount} pages, ${allNew.length} new listings`);

  // 4. Scrape details for new listings (skip in dry run)
  if (!DRY_RUN && allNew.length > 0) {
    const DETAIL_LIMIT = 10;
    log(`\n🔍 Phase 2: Detail scrape for ${Math.min(allNew.length, DETAIL_LIMIT)} new listings...`);

    // Sort by price (cheaper = more interesting for flipping), limit to 10
    const toScrape = allNew
      .filter(v => v.price >= PRICE_MIN && v.price <= PRICE_MAX)
      .sort((a, b) => a.price - b.price)
      .slice(0, DETAIL_LIMIT);

    for (let i = 0; i < toScrape.length; i++) {
      const v = toScrape[i];
      log(`  [${i + 1}/${toScrape.length}] ${v.model} $${v.price}`);

      const detail = await scrapeDetail(page, v.listingUrl);

      if (detail && detail.blocked) {
        detailBlocked++;
        if (detailBlocked >= 3) {
          log('  ⛔ Too many blocks — stopping detail scrape');
          break;
        }
        continue;
      }

      if (detail && !detail.isUnavailable) {
        if (detail.year) v.year = detail.year;
        if (detail.mileage) v.mileage = detail.mileage;
        if (detail.description) v.description = detail.description;
        if (detail.sellerName) v.sellerName = detail.sellerName;
        v.isManual = detail.isManual || false;
        v.isDealer = detail.isDealer || false;
        v.detailTitle = detail.title || '';
        v.enrichedDate = timestamp();
        enriched++;
        log(`    ✅ year:${v.year || '?'} km:${v.mileage || '?'} dealer:${v.isDealer}`);
      } else if (detail && detail.isUnavailable) {
        log(`    ❌ Already sold/unavailable — skipping`);
        v._sold = true;
      }

      await randomDelay(3000, 5000);
    }
  }

  // 4.5 Re-enrich: mileage=0 的已 enrich 车辆重新提取里程 (每次最多5辆)
  if (!SOLD_ONLY && !blocked && detailBlocked < 3) {
    const RE_ENRICH_LIMIT = 5;
    const needsReEnrich = fbData.vehicles.filter(v =>
      v.enrichedDate && v.mileage === 0 && !v._reEnriched &&
      v.platform === 'facebook' && v.listingUrl
    );
    if (needsReEnrich.length > 0) {
      const batch = needsReEnrich.slice(0, RE_ENRICH_LIMIT);
      log(`\n🔄 Phase 2.5: Re-enrich ${batch.length}/${needsReEnrich.length} listings (mileage=0)...`);
      for (const v of batch) {
        try {
          const detail = await scrapeDetail(page, v.listingUrl);
          if (detail && detail.blocked) { log('  ⛔ Blocked — stopping re-enrich'); break; }
          if (detail && detail.isUnavailable) {
            log(`  ❌ ${v.model} $${v.price} — sold/unavailable`);
            v._sold = true;
          } else if (detail) {
            if (detail.mileage) {
              v.mileage = detail.mileage;
              log(`  ✅ ${v.model} $${v.price} → ${detail.mileage} km`);
            } else {
              log(`  ⏸️ ${v.model} $${v.price} → still no mileage`);
            }
          }
          v._reEnriched = true;
          await randomDelay(2000, 4000);
        } catch(e) { log(`  ⚠️ Re-enrich error: ${e.message}`); }
      }
      // Save updated data
      fs.writeFileSync(FB_DATA_PATH, JSON.stringify(fbData, null, 2));
    }
  }

  } // end of if (!SOLD_ONLY)

  // 5. Check follow pool for sold items
  log('\n🔍 Phase 3: Follow pool sold check...');
  const poolResult = await checkPoolSoldStatus(page, pool);

  // Remove sold items from pool (已售/链接丢失 → 自动移除)
  if (poolResult.sold.length > 0) {
    const soldIds = new Set(poolResult.sold.map(s => s.id));
    pool.active = pool.active.filter(p => !soldIds.has(p.id));
    pool.dismissed = [...(pool.dismissed || []), ...poolResult.sold.map(s => s.id)];
    pool.lastUpdated = new Date().toISOString().split('T')[0];
    fs.writeFileSync(POOL_PATH, JSON.stringify(pool, null, 2));
    log(`📌 Pool updated: removed ${poolResult.sold.length} sold, ${pool.active.length} remaining`);
  }

  await browser.close();

  // 6. Merge new listings into fb_search_all.json
  const validNew = allNew.filter(v => !v._sold);
  if (validNew.length > 0) {
    fbData.vehicles.push(...validNew);
    fbData.lastDeltaScan = timestamp();
    fs.writeFileSync(FB_DATA_PATH, JSON.stringify(fbData, null, 2));
    log(`💾 Saved ${validNew.length} new listings → fb_search_all.json (total: ${fbData.vehicles.length})`);
  }

  // 7. Score new listings + send Feishu alert for hot ones
  //    只推送已抓详情确认的车（排除 dealer/手动挡/机械问题）
  const hotAlerts = [];
  if (validNew.length > 0) {
    try {
      // 分两组: 已抓详情 vs 仅搜索页
      const enrichedNew = validNew.filter(v => v.enrichedDate);
      const searchOnly = validNew.filter(v => !v.enrichedDate);

      // 全部评分（含未抓详情的，用于统计）
      const toScore = validNew
        .filter(v => {
          if (v.price < PRICE_MIN || v.price > PRICE_MAX) return false;
          if (v.year > 0 && v.year < 2005) return false;
          if (v.mileage > 0 && v.mileage > 160000) return false;
          if (v.isManual) return false;
          if (v.isDealer) return false;
          if (v.description && hasMechanicalIssue(v.description)) return false;
          return true;
        })
        .map(v => ({
          ...v,
          year: v.year || 2008,
          mileage: v.mileage || 130000,
          location: v.location || 'Auckland',
          description: v.description || '',
          seller: v.seller || 'Private',
          _platform: 'FB',
        }));

      const scored = scoreVehicles(toScore);
      log(`📈 Scored ${scored.length} new listings (${enrichedNew.length} enriched)`);

      // 只推送已抓详情确认过的（排除了 dealer、手动挡等）
      const enrichedIds = new Set(enrichedNew.map(v => v.id));
      for (const s of scored) {
        if (!enrichedIds.has(s.id)) continue;  // 只推确认过的
        if (s.flipScore >= ALERT_MIN_SCORE && (s.estimatedNetProfit || 0) > 0) {
          hotAlerts.push(s);
        }
      }

      if (searchOnly.length > 0) {
        // 未抓详情的高分车计数（仅日志，不推送）
        const potentialHot = scored.filter(s => !enrichedIds.has(s.id) && s.flipScore >= ALERT_MIN_SCORE);
        if (potentialHot.length > 0) {
          log(`💡 ${potentialHot.length} potential hot listings (not enriched yet, will check next run)`);
        }
      }
    } catch (e) {
      log(`❌ Scoring error: ${e.message}`);
      log(`   Stack: ${e.stack}`);
      // 继续执行，不要因为评分失败而中断整个流程
    }
  }

  // 8. Send Feishu alert
  if (hotAlerts.length > 0 || poolResult.sold.length > 0) {
    let msg = '🔔 Car Scout 快讯\n━━━━━━━━━━━━━━━━━━━━\n';

    if (hotAlerts.length > 0) {
      msg += `\n🆕 新发现 ${hotAlerts.length} 辆好车:\n`;
      for (const h of hotAlerts.slice(0, 5)) {
        const profit = h.estimatedNetProfit || 0;
        const margin = h.profitMargin || 0;
        const badge = h._justListed ? ' 🔥刚上架' : '';
        msg += `• ${h.year || '?'} ${h.model} | $${h.price.toLocaleString()} | Flip ${h.flipScore} | 赚$${profit.toLocaleString()}(${margin}%)${badge}\n`;
        msg += `  🔗 ${h.listingUrl}\n`;
      }
    }

    if (poolResult.sold.length > 0) {
      msg += `\n❌ 跟进池已售 ${poolResult.sold.length} 辆:\n`;
      for (const s of poolResult.sold) {
        msg += `• ${s.model} | $${s.price.toLocaleString()} — 已售/下架\n`;
      }
    }

    msg += `\n⏱ 扫描: ${Math.round((Date.now() - startTime) / 1000)}s | 新${validNew.length}辆 | 已售${poolResult.sold.length}辆`;

    try {
      await sendFeishuAlert(msg);
    } catch (e) {
      log(`❌ Feishu alert failed: ${e.message}`);
      // 继续执行，不要因为飞书发送失败而中断整个流程
    }
  }

  // 9. Save scan state + log
  scanState.lastScan = timestamp();
  if (!SOLD_ONLY) scanState.scanCount = (scanState.scanCount || 0) + 1;  // sold-only 不增长计数
  scanState.lastNewCount = validNew.length;
  scanState.lastSoldCount = poolResult.sold.length;
  scanState.lastHotCount = hotAlerts.length;
  fs.writeFileSync(SCAN_STATE_PATH, JSON.stringify(scanState, null, 2));

  // Append to rolling log (keep last 168 entries = 7 days × 24h)
  let scanLog = [];
  try { scanLog = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')); } catch(e) {}
  scanLog.push({
    time: timestamp(),
    duration: Math.round((Date.now() - startTime) / 1000),
    searched: searchCount,
    newFound: validNew.length,
    enriched,
    sold: poolResult.sold.length,
    hotAlerts: hotAlerts.length,
    poolSize: pool.active.length,
    blocked: blocked || detailBlocked >= 3,
  });
  if (scanLog.length > 168) scanLog = scanLog.slice(-168);
  fs.writeFileSync(LOG_PATH, JSON.stringify(scanLog, null, 2));

  // Summary
  clearTimeout(globalTimer);
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  log(`\n✅ Done in ${elapsed}s`);
  const modelCount = SOLD_ONLY ? 0 : getActiveModels(scanState.scanCount || 0).length;
  log(`   模型层级: T1(${MODELS_T1.length}) + ${modelCount > MODELS_T1.length ? 'T2/T3' : '仅T1'} = ${modelCount} models`);
  log(`   新发现: ${validNew.length} | 详情: ${enriched} | 已售: ${poolResult.sold.length} | 热推: ${hotAlerts.length}`);
  log(`   数据库: ${fbData.vehicles.length} 辆 | 跟进池: ${pool.active.length} 辆`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
