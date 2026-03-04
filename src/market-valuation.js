/**
 * Car Scout - Market Valuation Engine (KNN)
 *
 * 基于多平台真实挂牌数据的 KNN 加权中位数估价
 *
 * 算法:
 *   1. 筛选同车型、年份±2、里程±40k 的候选
 *   2. 里程标准化到 80k km 基线 (3%/万km 折旧率)
 *   3. 加权: private=1.0, dealer=0.5(价格×0.70)
 *            年份越近权重越高 (±0.15/年)
 *            平台权重: trademe=1.0, facebook=0.8, other=0.6
 *   4. 加权中位数 → 反标准化到目标里程
 *   5. 位置调整: Waikato ×0.95
 *
 * Usage:
 *   const { valuateVehicle } = require('./market-valuation');
 *   const result = valuateVehicle('Corolla', 2007, 132000, 'Auckland');
 *   // → { price: 4150, confidence: 'high', sampleCount: 8, source: 'market-data' }
 */

const fs = require('fs');
const path = require('path');

// ─── 配置 ───
const DATA_DIR = path.join(__dirname, '..', 'data');
const MAX_DATA_AGE_DAYS = 7;
const DEPRECIATION_RATE = 0.03;   // 3% per 10k km
const BASELINE_KM = 80000;
const YEAR_RANGE = 2;             // ±2 years
const KM_RANGE = 40000;           // ±40k km
const DEALER_PRICE_FACTOR = 0.70; // Dealer→private 价格转换
const DEALER_WEIGHT = 0.5;        // 车商数据权重 (vs private=1.0)
const YEAR_WEIGHT_DECAY = 0.15;   // 每年差距权重衰减

// ─── 平台权重 ───
const PLATFORM_WEIGHTS = {
  trademe: 1.0,
  facebook: 0.8,
  other: 0.6
};

// ─── TM 挂牌价 → 快速成交价 转换 ───
// 注意：在三级混合估价模型中，Predictor 已经处理了这个转换
// 对于 KNN 市场估价，我们直接使用挂牌价作为市场参考
const ASKING_TO_SALE_FACTOR = 1.0;

// ─── 缓存 ───
let _cache = null;
let _cacheLoaded = false;

/**
 * 加载最新的市场估价数据
 */
function loadMarketData() {
  if (_cacheLoaded) return _cache;
  _cacheLoaded = true;

  try {
    const files = fs.readdirSync(DATA_DIR)
      .filter(f => f.startsWith('market_valuation_') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.log('⚠️ No market valuation data found');
      return null;
    }

    // 数据时效检查
    const dateMatch = files[0].match(/(\d{8})/);
    if (dateMatch) {
      const fileDate = new Date(
        dateMatch[1].substring(0, 4) + '-' +
        dateMatch[1].substring(4, 6) + '-' +
        dateMatch[1].substring(6, 8)
      );
      const ageDays = (Date.now() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > MAX_DATA_AGE_DAYS) {
        console.log(`⚠️ Market data is ${Math.round(ageDays)} days old (max ${MAX_DATA_AGE_DAYS}), skipping`);
        return null;
      }
    }

    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, files[0]), 'utf8'));
    _cache = data.listings || [];
    console.log(`✅ Loaded market valuation: ${files[0]} (${_cache.length} listings)`);
    return _cache;
  } catch (e) {
    console.log('⚠️ Failed to load market data:', e.message);
    return null;
  }
}

/**
 * 里程标准化: 将实际价格归一到 80k km 基线
 * 原理: 每多 10,000km 价格下降 3%
 * 所以一辆 150k 的车标价 $3,800 → @80k = $3,800 × 1.03^(7) = $4,672
 */
function normalizeToBaseline(price, km) {
  if (!km || km <= 0) return price; // km unknown, no adjustment
  const deltaUnits = (km - BASELINE_KM) / 10000;
  return price * Math.pow(1 + DEPRECIATION_RATE, deltaUnits);
}

/**
 * 反标准化: 从 80k 基线还原到目标里程的价格
 */
function denormalizeFromBaseline(baselinePrice, targetKm) {
  if (!targetKm || targetKm <= 0) return baselinePrice;
  const deltaUnits = (targetKm - BASELINE_KM) / 10000;
  return baselinePrice * Math.pow(1 - DEPRECIATION_RATE, deltaUnits);
}

/**
 * 计算加权中位数
 * @param {Array<{value: number, weight: number}>} items
 * @returns {number}
 */
function weightedMedian(items) {
  if (items.length === 0) return 0;
  if (items.length === 1) return items[0].value;

  // Sort by value
  items.sort((a, b) => a.value - b.value);

  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  const halfWeight = totalWeight / 2;

  let cumWeight = 0;
  for (let i = 0; i < items.length; i++) {
    cumWeight += items[i].weight;
    if (cumWeight >= halfWeight) {
      return items[i].value;
    }
  }

  return items[items.length - 1].value;
}

/**
 * KNN 估价核心
 *
 * @param {string} model - 车型 e.g. 'Corolla'
 * @param {number} year  - 年份 e.g. 2007
 * @param {number} mileage - 公里数 e.g. 132000 (0 = unknown → 使用 130k 默认)
 * @param {string} location - 位置 e.g. 'Auckland'
 * @returns {{ price: number, confidence: string, sampleCount: number, source: string } | null}
 */
function valuateVehicle(model, year, mileage, location) {
  const listings = loadMarketData();
  if (!listings || listings.length === 0) return null;

  const targetKm = (mileage && mileage > 0) ? mileage : 130000;

  // Step 1: 筛选候选 (同车型, 年份±2, 里程±40k)
  // 如果km=0 (unknown), 放宽里程匹配条件
  const candidates = listings.filter(l => {
    if (l.model !== model) return false;
    if (!l.year || Math.abs(l.year - year) > YEAR_RANGE) return false;
    // 如果listing有km数据，检查范围; 如果没有km数据也保留 (会在加权时降权)
    if (l.km > 0 && Math.abs(l.km - targetKm) > KM_RANGE) return false;
    return true;
  });

  if (candidates.length === 0) {
    // 放宽到年份±3，里程不限
    const wideCandidates = listings.filter(l => {
      if (l.model !== model) return false;
      if (!l.year || Math.abs(l.year - year) > 3) return false;
      return true;
    });

    if (wideCandidates.length === 0) return null;

    // 用放宽的结果继续，但标记低置信
    return computeValuation(wideCandidates, year, targetKm, location, true);
  }

  return computeValuation(candidates, year, targetKm, location, false);
}

/**
 * 计算估价 (内部函数)
 */
function computeValuation(candidates, targetYear, targetKm, location, isWide) {
  const weighted = [];

  for (const c of candidates) {
    // Step 2: 里程标准化到 80k 基线
    let price = c.price;

    // 车商价格转换为私人等价
    if (c.sellerType === 'dealer') {
      price *= DEALER_PRICE_FACTOR;
    }

    // 标准化里程
    if (c.km > 0) {
      price = normalizeToBaseline(price, c.km);
    }
    // km unknown: 不做里程调整 (假设已是合理价格)

    // Step 3: 计算权重
    let weight = 1.0;

    // 卖家类型权重
    if (c.sellerType === 'dealer') {
      weight *= DEALER_WEIGHT;
    }

    // 年份距离权重 (越近越高)
    const yearDiff = Math.abs(c.year - targetYear);
    weight *= Math.max(0.1, 1.0 - yearDiff * YEAR_WEIGHT_DECAY);

    // 平台权重
    const platformWeight = PLATFORM_WEIGHTS[c.platform] || PLATFORM_WEIGHTS.other;
    weight *= platformWeight;

    // km 未知的降权
    if (!c.km || c.km <= 0) {
      weight *= 0.5;
    }

    weighted.push({ value: price, weight });
  }

  if (weighted.length === 0) return null;

  // Step 4: 加权中位数 (at 80k baseline)
  const baselinePrice = weightedMedian(weighted);

  // Step 5: 反标准化到目标里程
  let finalPrice = denormalizeFromBaseline(baselinePrice, targetKm);

  // Step 6: TM 挂牌价 → 快速成交价
  finalPrice *= ASKING_TO_SALE_FACTOR;

  // Step 7: 位置调整
  if (location && /waikato|hamilton/i.test(location)) {
    finalPrice *= 0.95;
  }

  // 置信度
  const privateCount = candidates.filter(c => c.sellerType === 'private').length;
  const totalCount = candidates.length;
  let confidence;
  if (isWide) {
    confidence = totalCount >= 3 ? 'low' : 'none';
  } else if (totalCount >= 5 && privateCount >= 2) {
    confidence = 'high';
  } else if (totalCount >= 3) {
    confidence = 'medium';
  } else if (totalCount >= 1) {
    confidence = 'low';
  } else {
    confidence = 'none';
  }

  // 统计平台分布
  const platformCounts = {};
  for (const c of candidates) {
    const platform = c.platform || 'unknown';
    platformCounts[platform] = (platformCounts[platform] || 0) + 1;
  }

  return {
    price: Math.round(finalPrice),
    confidence,
    sampleCount: totalCount,
    privateCount,
    platformCounts,
    source: 'market-data',
  };
}

/**
 * 重置缓存 (用于测试或强制重新加载)
 */
function resetCache() {
  _cache = null;
  _cacheLoaded = false;
}

module.exports = {
  valuateVehicle,
  loadMarketData,
  resetCache,
  // Export for testing
  normalizeToBaseline,
  denormalizeFromBaseline,
  weightedMedian,
};
