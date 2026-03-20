/**
 * TradeMe Motors API 爬虫
 *
 * 使用官方 TradeMe Developer API (OAuth 1.0a, 2-legged)
 * 文档: https://developer.trademe.co.nz/api-reference/search-methods/motor-vehicle-search/
 *
 * 环境变量:
 *   TRADEME_CONSUMER_KEY
 *   TRADEME_CONSUMER_SECRET
 */

const crypto = require('crypto');
const path   = require('path');
const fs     = require('fs');
const { supabaseAdmin, TABLES } = require('../config/supabase');
const { VEHICLES } = require('../data/vehicles');

const DATA_DIR = path.join(__dirname, '../../data');

const TRADEME_API = 'https://api.trademe.co.nz/v1';

// ─── OAuth 1.0a 签名 (2-legged, 无用户 token) ────────────────
function buildAuthHeader(method, url, queryParams) {
  const key    = process.env.TRADEME_CONSUMER_KEY;
  const secret = process.env.TRADEME_CONSUMER_SECRET;

  if (!key || !secret) throw new Error('TRADEME_CONSUMER_KEY / TRADEME_CONSUMER_SECRET not set');

  const oauth = {
    oauth_consumer_key:     key,
    oauth_nonce:            crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        String(Math.floor(Date.now() / 1000)),
    oauth_version:          '1.0',
  };

  // 合并所有参数用于签名
  const allParams = { ...queryParams, ...oauth };
  const paramStr = Object.keys(allParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&');

  const base = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramStr),
  ].join('&');

  const signingKey = `${encodeURIComponent(secret)}&`;
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64');

  return 'OAuth ' + Object.keys(oauth)
    .map(k => `${k}="${encodeURIComponent(oauth[k])}"`)
    .join(', ');
}

// ─── TradeMe API 调用 ──────────────────────────────────────────
async function trademeSearch(params) {
  const baseUrl = `${TRADEME_API}/Search/Motors/Used.json`;
  const auth    = buildAuthHeader('GET', baseUrl, params);
  const qs      = new URLSearchParams(params).toString();

  const resp = await fetch(`${baseUrl}?${qs}`, {
    headers: {
      Authorization: auth,
      Accept:        'application/json',
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`TradeMe API ${resp.status}: ${text.slice(0, 200)}`);
  }

  return resp.json();
}

// ─── 解析 API listing 对象 ────────────────────────────────────
function parseListing(item, modelKey) {
  const vehicle = VEHICLES[modelKey];
  const title   = item.Title || '';
  const text    = title + ' ' + JSON.stringify(item);

  const price = item.BuyNowPrice || item.StartPrice || null;
  if (!price || price < 500) return null;

  // 年份 — 从标题或 YearManufactured 字段
  const yearMatch = text.match(/\b(200[5-9]|201[0-9]|202[0-4])\b/);
  const year = item.YearManufactured || (yearMatch ? parseInt(yearMatch[1]) : null);

  // 里程
  const kmMatch = text.match(/([\d,]+)\s*km/i);
  const km = item.OdometerReading || (kmMatch ? parseInt(kmMatch[1].replace(/,/g, '')) : null);

  // 配置
  const gradeMatch = title.match(
    /executive\s+lounge|ex[\s-]lounge|\bZGE\b|\bZG\b|\bZR\b|A\s+premium\s+tss|A\s+premium|\bG\s+L\b|\bG\s+F\b/i
  );

  // 型号代码
  const codeMatch = text.match(/AYH30W|AGH30W|GGH30W|ZVW30|ZVW50|ZVW51|ZVW55/i);

  return {
    url:        `https://www.trademe.co.nz/a/motors/cars/listing/${item.ListingId}`,
    title,
    price,
    year,
    km,
    sellerType: item.MemberProfile?.IsTradingMember ? 'dealer' : 'private',
    location:   item.Region || item.Suburb || '',
    grade:      gradeMatch ? gradeMatch[0].trim() : null,
    modelCode:  codeMatch ? codeMatch[0].toUpperCase() : null,
    model:      vehicle.model,
    modelKey,
  };
}

// ─── 爬取单个车型 ─────────────────────────────────────────────
async function scrapeModel(modelKey, pages = 2) {
  const vehicle = VEHICLES[modelKey];
  if (!vehicle) throw new Error(`Unknown model: ${modelKey}`);

  const { priceMin, priceMax, yearMin } = vehicle.trademeSearch;
  console.log(`🔍 [TradeMe API] ${vehicle.model} — ${pages} page(s)`);

  const allListings = [];

  for (let p = 1; p <= pages; p++) {
    try {
      const params = {
        make:      'Toyota',
        model:     vehicle.model,   // 'Alphard' / 'Vellfire' / 'Prius'
        price_min: priceMin,
        price_max: priceMax,
        year_min:  yearMin,
        rows:      100,
        page:      p,
        sort_order: 'Default',
      };

      const data = await trademeSearch(params);
      const list  = data.List || [];
      console.log(`   Page ${p}: ${list.length} results (total: ${data.TotalCount})`);

      list.forEach(item => {
        const parsed = parseListing(item, modelKey);
        if (parsed) allListings.push(parsed);
      });

      if (p < pages && list.length > 0) {
        await new Promise(r => setTimeout(r, 1000));
      }
      if (list.length === 0) break; // 没有更多结果
    } catch (err) {
      console.warn(`   Page ${p} failed:`, err.message);
    }
  }

  // 去重
  const seen   = new Set();
  const unique = allListings.filter(l => { if (seen.has(l.url)) return false; seen.add(l.url); return true; });

  console.log(`✅ [${vehicle.model}] ${unique.length} unique listings`);
  return unique;
}

// ─── 爬取全部 3 款 ────────────────────────────────────────────
async function scrapeAll(models = ['alphard', 'vellfire', 'prius'], pages = 2) {
  const results = {};
  for (const modelKey of models) {
    try {
      const listings = await scrapeModel(modelKey, pages);
      results[modelKey] = listings;
      await saveListings(modelKey, listings);
    } catch (err) {
      console.error(`❌ [${modelKey}]:`, err.message);
      results[modelKey] = [];
    }
  }
  return results;
}

// ─── 持久化 ───────────────────────────────────────────────────
async function saveListings(modelKey, listings) {
  if (listings.length === 0) return;

  if (supabaseAdmin) {
    const rows = listings.map(l => ({
      model:       l.model,
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
      platform:    'trademe',
      scraped_at:  new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from(TABLES.LISTINGS)
      .upsert(rows, { onConflict: 'url', ignoreDuplicates: false });

    if (error) console.error('Supabase upsert error:', error.message);
    else console.log(`💾 Saved ${rows.length} rows → Supabase (${modelKey})`);
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const file = path.join(DATA_DIR, `scraped_${modelKey}_${date}.json`);
    fs.writeFileSync(file, JSON.stringify({ modelKey, listings, scrapedAt: new Date().toISOString() }, null, 2));
    console.log(`💾 Saved ${listings.length} listings → ${path.basename(file)}`);
  }
}

function loadLocalListings(modelKey) {
  if (!fs.existsSync(DATA_DIR)) return [];
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith(`scraped_${modelKey}_`) && f.endsWith('.json'))
    .sort().reverse();
  if (files.length === 0) return [];
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, files[0]), 'utf8')).listings || [];
  } catch (_) { return []; }
}

module.exports = { scrapeModel, scrapeAll, saveListings, loadLocalListings };
