/**
 * 价格预测引擎
 *
 * 三层混合预测模型:
 *
 *   Layer 1 — 规则基准 (Rule-Based Baseline)
 *     基于人工整理的 NZ TradeMe 历史成交价格表。
 *     覆盖 3 款车型 × 年份 × 配置 × 里程，是最可靠的价格来源。
 *
 *   Layer 2 — 市场 KNN 修正 (Market KNN Correction)
 *     如果 Supabase 里有真实的 TradeMe 挂牌数据，用 KNN 加权中位数
 *     计算市场修正系数，叠加到基准价格上。
 *     修正幅度最大 ±25%，避免数据噪音导致结果偏离过远。
 *
 *   Layer 3 — 置信度评级
 *     综合数据来源数量与质量，输出 high / medium / low / none。
 *
 * 这套设计的优点：
 *   - 冷启动时 (数据库为空) Layer 1 依然给出合理估价
 *   - 随着爬取数据积累，Layer 2 逐渐提升精度
 *   - 不需要大量训练数据，非常适合小批量精品车型
 */

const { estimateNzPrice, VEHICLES } = require('../data/vehicles');
const { supabaseAdmin, TABLES } = require('../config/supabase');

const KNN_CONFIG = {
  yearRange:    2,      // ±2 年
  kmRange:      50000,  // ±50k km (高价车里程分布更宽)
  minSamples:   3,      // 少于 3 条不做 KNN 修正
  maxAdj:       0.25,   // KNN 修正幅度上限 ±25%
  dealerFactor: 0.88,   // 车商价格折算成私人价
};

/**
 * 主预测函数 — 完整预测流程
 *
 * @param {object} params
 * @param {string} params.modelKey    - 'alphard' | 'vellfire' | 'prius'
 * @param {number} params.year
 * @param {number} params.km
 * @param {string} params.grade
 * @param {string} params.condition   - 日拍评级 '5'|'4.5'|'4'|'3.5'|'3'|'2'|'R'|'RA'|'A'
 * @param {string} params.modelCode   - 'AYH30W' etc.
 * @param {boolean} params.isEFour    - Prius 4WD
 * @param {string} params.location    - 'Auckland' etc.
 * @returns {Promise<PredictionResult>}
 */
async function predictPrice(params) {
  const { modelKey, year, km, grade, condition = '4', modelCode, isEFour, location } = params;

  // ── Layer 1: 规则基准价格 ──────────────────────────────────
  const baseline = estimateNzPrice(modelKey, year, km, grade, condition, {
    modelCode,
    isEFour,
    isHybrid: modelCode === 'AYH30W',
  });

  if (baseline.price === null) {
    return {
      price: null,
      low: null,
      high: null,
      confidence: 'none',
      source: 'no-data',
      baseline: null,
      marketCorrection: null,
      comparables: [],
      sampleCount: 0,
    };
  }

  // ── Layer 2: 市场 KNN 修正 ─────────────────────────────────
  let marketCorrection = null;
  let comparables = [];

  if (supabaseAdmin) {
    try {
      const knnResult = await computeKnnCorrection(modelKey, year, km, baseline.price);
      marketCorrection = knnResult.correction;
      comparables = knnResult.comparables;
    } catch (err) {
      // 数据库查询失败不影响基准价格
      console.warn('KNN correction skipped:', err.message);
    }
  }

  // ── 合并结果 ───────────────────────────────────────────────
  const correctedPrice = marketCorrection
    ? Math.round(baseline.price * marketCorrection / 500) * 500
    : baseline.price;

  // 位置折价 (Waikato 市场规模较小)
  const locationFactor = /waikato|hamilton/i.test(location || '') ? 0.96 : 1.0;
  const finalPrice = Math.round(correctedPrice * locationFactor / 500) * 500;
  const finalLow   = Math.round(baseline.low  * (marketCorrection || 1.0) * locationFactor / 500) * 500;
  const finalHigh  = Math.round(baseline.high * (marketCorrection || 1.0) * locationFactor / 500) * 500;

  // 置信度
  const sampleCount = comparables.length;
  let confidence = baseline.confidence;
  if (sampleCount >= 5)      confidence = 'high';
  else if (sampleCount >= 3) confidence = 'medium';
  else if (sampleCount >= 1) confidence = Math.min(confidence, 'low') === 'low' ? 'low' : 'medium';

  return {
    price:    finalPrice,
    low:      finalLow,
    high:     finalHigh,
    confidence,
    source:   sampleCount > 0 ? 'market+baseline' : 'baseline-only',
    baseline,
    marketCorrection,
    comparables,
    sampleCount,
    locationFactor,
  };
}

/**
 * KNN 市场修正
 * 查 Supabase listings 表，找同车型/年份/里程附近的挂牌，
 * 计算加权中位数，得出修正系数。
 */
async function computeKnnCorrection(modelKey, year, km, baselinePrice) {
  const vehicle = VEHICLES[modelKey];
  const targetKm = km || 100000;

  const { data: listings, error } = await supabaseAdmin
    .from(TABLES.LISTINGS)
    .select('price, year, km, seller_type, platform, title, url, location')
    .ilike('model', `%${vehicle.model}%`)
    .gte('year', year - KNN_CONFIG.yearRange)
    .lte('year', year + KNN_CONFIG.yearRange)
    .not('price', 'is', null)
    .order('scraped_at', { ascending: false })
    .limit(50);

  if (error || !listings || listings.length === 0) {
    return { correction: null, comparables: [] };
  }

  // 过滤里程范围 & 价格异常值
  const priceFloor = baselinePrice * 0.4;
  const priceCap   = baselinePrice * 2.2;
  const candidates = listings.filter(l => {
    if (l.price < priceFloor || l.price > priceCap) return false;
    if (l.km > 0 && Math.abs(l.km - targetKm) > KNN_CONFIG.kmRange) return false;
    return true;
  });

  if (candidates.length < KNN_CONFIG.minSamples) {
    return { correction: null, comparables: candidates.slice(0, 8) };
  }

  // 加权价格（年份越近、私人卖家权重越高）
  const BASELINE_KM = 80000;
  const weighted = candidates.map(c => {
    let price = c.price;

    // 车商价折算
    if (c.seller_type === 'dealer') price *= KNN_CONFIG.dealerFactor;

    // 里程标准化到 80k 基线
    if (c.km > 0) {
      const units = (c.km - BASELINE_KM) / 10000;
      price = price * Math.pow(1 + vehicle.depreciationRate, units); // 还原到基线
    }

    // 权重: 年份差 + 平台
    const yearW = Math.max(0.1, 1.0 - Math.abs(c.year - year) * 0.15);
    const platformW = c.platform === 'trademe' ? 1.0 : 0.8;
    const sellerW = c.seller_type === 'private' ? 1.0 : 0.6;
    const weight = yearW * platformW * sellerW;

    return { value: price, weight };
  });

  const medianAtBaseline = weightedMedian(weighted);

  // 反标准化回目标里程
  const units = (targetKm - BASELINE_KM) / 10000;
  const medianAtTarget = medianAtBaseline * Math.pow(1 - vehicle.depreciationRate, units);

  // 修正系数，限幅 ±25%
  const rawCorrection = medianAtTarget / baselinePrice;
  const correction = Math.min(
    1 + KNN_CONFIG.maxAdj,
    Math.max(1 - KNN_CONFIG.maxAdj, rawCorrection)
  );

  return {
    correction,
    comparables: candidates.slice(0, 8).map(c => ({
      title:      c.title,
      price:      c.price,
      year:       c.year,
      km:         c.km,
      url:        c.url,
      platform:   c.platform,
      sellerType: c.seller_type,
      location:   c.location,
    })),
  };
}

/** 加权中位数 */
function weightedMedian(items) {
  if (items.length === 0) return 0;
  if (items.length === 1) return items[0].value;
  items.sort((a, b) => a.value - b.value);
  const half = items.reduce((s, i) => s + i.weight, 0) / 2;
  let cum = 0;
  for (const item of items) {
    cum += item.weight;
    if (cum >= half) return item.value;
  }
  return items[items.length - 1].value;
}

module.exports = { predictPrice };
