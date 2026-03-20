/**
 * 车型核心数据
 *
 * 覆盖3款车型: Toyota Alphard / Vellfire / Prius
 *
 * NZ 基准价格基于 TradeMe 2024-2025 成交价，80,000km 基线。
 * 价格分层为"快速成交价"(非挂牌价)，即实际买家愿意支付的价格。
 */

// ─── 折旧模型 ───────────────────────────────────────────────
// 每超出(或低于) BASELINE_KM 每 10,000km，价格乘以 (1 ± rate)
const BASELINE_KM = 80000;

function mileageAdjust(basePrice, km, ratePerUnit) {
  if (!km || km <= 0) return basePrice;
  const units = (km - BASELINE_KM) / 10000;
  return basePrice * Math.pow(1 - ratePerUnit, units);
}

// ─── 车况调整系数 (日本拍卖评级) ────────────────────────────
const CONDITION_FACTORS = {
  '5':   1.06,
  '4.5': 1.03,
  '4':   1.00,   // 基准
  '3.5': 0.95,
  '3':   0.88,
  '2':   0.78,
  'R':   0.70,   // 修复
  'RA':  0.65,   // 修复 + 气囊
  'A':   0.82,   // 事故车
};

// ─── Toyota Alphard (AH30, 2015–2023) ──────────────────────
const ALPHARD = {
  make: 'Toyota',
  model: 'Alphard',
  modelKey: 'alphard',
  series: 'AH30',
  modelCodes: {
    'AGH30W': '2.5L NA',
    'GGH30W': '3.5L V6',
    'AYH30W': '2.5L Hybrid',
  },

  // NZ 市场挂牌搜索范围 (TradeMe 参数)
  trademeSearch: {
    query: 'Alphard',
    priceMin: 20000,
    priceMax: 90000,
    yearMin: 2013,
  },

  // 车型配置档次 (相对 Executive Lounge 的系数)
  grades: {
    'Executive Lounge':   { factor: 1.00, tier: 'premium', description: '顶配 — 电动脚垫、JBL 19喇叭、后排屏幕、双电动侧门' },
    'Executive Lounge S': { factor: 0.97, tier: 'premium', description: '顶配 + 运动外观' },
    'G L Package':        { factor: 0.90, tier: 'high',    description: '高配 — 双电动门、皮座' },
    'G F Package':        { factor: 0.87, tier: 'high',    description: '高配 — 单电动门' },
    'G':                  { factor: 0.83, tier: 'mid',     description: '中配' },
    'S A Package':        { factor: 0.77, tier: 'mid',     description: 'S + A包' },
    'S':                  { factor: 0.72, tier: 'base',    description: '基础配置' },
  },

  // NZ 基准价格 (Executive Lounge, 80,000km, Auckland)
  // 参考 TradeMe 2024-2025 私人卖家成交价
  basePrices: {
    2013: 26000,
    2014: 29000,
    2015: 34000,
    2016: 38000,
    2017: 44000,
    2018: 50000,
    2019: 56000,
    2020: 62000,
    2021: 67000,
    2022: 72000,
    2023: 78000,
  },

  // 型号加成
  enginePremiums: {
    'AYH30W': 0.05,   // Hybrid +5%
    'GGH30W': 0.03,   // V6 +3%
    'AGH30W': 0.00,   // 2.5L NA 基准
  },

  // 折旧率: 每 10,000km
  depreciationRate: 0.028,

  // NZ 进口合规费 (双电动门、JDM灯光改装等更贵)
  complianceCost: 5000,

  // 置信度参考: 该车型 TradeMe 月均挂牌量
  avgMonthlyListings: 35,
};

// ─── Toyota Vellfire (AH30, 2015–2023) ─────────────────────
const VELLFIRE = {
  make: 'Toyota',
  model: 'Vellfire',
  modelKey: 'vellfire',
  series: 'AH30',
  modelCodes: {
    'AGH30W': '2.5L NA',
    'GGH30W': '3.5L V6',
    'AYH30W': '2.5L Hybrid',
  },

  trademeSearch: {
    query: 'Vellfire',
    priceMin: 18000,
    priceMax: 85000,
    yearMin: 2013,
  },

  grades: {
    'Executive Lounge':   { factor: 1.00, tier: 'premium', description: '顶配' },
    'ZG':                 { factor: 0.88, tier: 'high',    description: '高配 — 双电动门、JBL' },
    'ZR':                 { factor: 0.80, tier: 'mid',     description: '中高配' },
    'Z G Edition':        { factor: 0.76, tier: 'mid',     description: 'Z + G版' },
    'Z':                  { factor: 0.73, tier: 'mid',     description: '标准配置' },
    'V':                  { factor: 0.68, tier: 'base',    description: '基础配置' },
  },

  // Vellfire 在 NZ 比 Alphard 略便宜 (~8%)
  basePrices: {
    2013: 24000,
    2014: 27000,
    2015: 31000,
    2016: 35000,
    2017: 40000,
    2018: 46000,
    2019: 51000,
    2020: 57000,
    2021: 62000,
    2022: 67000,
    2023: 72000,
  },

  enginePremiums: {
    'AYH30W': 0.05,
    'GGH30W': 0.03,
    'AGH30W': 0.00,
  },

  depreciationRate: 0.028,
  complianceCost: 5000,
  avgMonthlyListings: 20,
};

// ─── Toyota Prius (3rd/4th gen, 2009–2023) ──────────────────
const PRIUS = {
  make: 'Toyota',
  model: 'Prius',
  modelKey: 'prius',
  series: { '3rd': 'ZVW30', '4th': 'ZVW50/51/55' },
  modelCodes: {
    'ZVW30':  '3rd gen 1.8L Hybrid (2009-2015)',
    'ZVW50':  '4th gen 1.8L Hybrid 2WD (2015-)',
    'ZVW51':  '4th gen 1.8L Hybrid 2WD (upgrade)',
    'ZVW55':  '4th gen 1.8L Hybrid E-Four 4WD',
  },

  trademeSearch: {
    query: 'Prius',
    priceMin: 6000,
    priceMax: 38000,
    yearMin: 2009,
  },

  grades: {
    'A Premium TSS':  { factor: 1.00, tier: 'premium', description: '顶配 — Toyota Safety Sense，JBL，HUD' },
    'A Premium':      { factor: 0.94, tier: 'high',    description: '高配 — JBL，皮座' },
    'A':              { factor: 0.87, tier: 'mid',     description: '中配' },
    'G':              { factor: 0.80, tier: 'mid',     description: '中基础配' },
    'S':              { factor: 0.73, tier: 'base',    description: '基础配置' },
    'E':              { factor: 0.67, tier: 'base',    description: '经济版' },
    // 3rd gen grades
    'G Touring':      { factor: 0.92, tier: 'high',    description: '3代 高配' },
    'S Touring':      { factor: 0.80, tier: 'mid',     description: '3代 运动' },
  },

  // NZ 基准价格 (A Premium TSS / 4th gen, 80,000km)
  basePrices: {
    // 3rd gen ZVW30
    2009: 6500,
    2010: 7000,
    2011: 7800,
    2012: 8800,
    2013: 9800,
    2014: 11000,
    2015: 12500,
    // 4th gen ZVW50 (切换点, 两代并存)
    2016: 15500,
    2017: 18000,
    2018: 20500,
    2019: 23000,
    2020: 25500,
    2021: 28000,
    2022: 31000,
    2023: 34000,
  },

  // E-Four (4WD) 加成
  eFourPremium: 0.05,

  // Prius 折旧稍慢 (混动需求高)
  depreciationRate: 0.022,
  complianceCost: 2800,
  avgMonthlyListings: 120,
};

// ─── 统一导出 ────────────────────────────────────────────────
const VEHICLES = { alphard: ALPHARD, vellfire: VELLFIRE, prius: PRIUS };

/**
 * 预测 NZ 市场价格
 *
 * @param {string} modelKey   - 'alphard' | 'vellfire' | 'prius'
 * @param {number} year       - 出厂年份
 * @param {number} km         - 公里数
 * @param {string} grade      - 配置等级 (e.g. 'Executive Lounge')
 * @param {string} condition  - 日拍评级 (e.g. '4', '3.5', 'R')
 * @param {object} options    - { isHybrid, isEFour, modelCode, marketAdjustment }
 * @returns {{ price, low, high, confidence, breakdown }}
 */
function estimateNzPrice(modelKey, year, km, grade, condition = '4', options = {}) {
  const vehicle = VEHICLES[modelKey];
  if (!vehicle) throw new Error(`Unknown model: ${modelKey}`);

  // 1. 基准价格 (年份查表，线性插值)
  const basePrice = interpolateBasePrice(vehicle.basePrices, year);
  if (!basePrice) {
    return { price: null, confidence: 'none', reason: `No price data for ${year}` };
  }

  // 2. 配置系数
  const gradeData = vehicle.grades[grade];
  const gradeFactor = gradeData ? gradeData.factor : guessGradeFactor(vehicle, grade);

  // 3. 里程调整
  const kmAdjusted = mileageAdjust(basePrice * gradeFactor, km, vehicle.depreciationRate);

  // 4. 型号/动力加成
  let enginePremium = 0;
  if (options.modelCode && vehicle.enginePremiums) {
    enginePremium = vehicle.enginePremiums[options.modelCode] || 0;
  } else if (options.isHybrid && vehicle.enginePremiums) {
    enginePremium = vehicle.enginePremiums['AYH30W'] || 0;
  }

  // Prius E-Four 加成
  if (modelKey === 'prius' && options.isEFour) {
    enginePremium += vehicle.eFourPremium || 0;
  }

  // 5. 车况调整
  const conditionFactor = CONDITION_FACTORS[String(condition)] || 1.0;

  // 6. 市场调整 (如果有真实挂牌数据调整因子)
  const marketAdj = options.marketAdjustment || 1.0;

  const finalPrice = kmAdjusted * (1 + enginePremium) * conditionFactor * marketAdj;

  // 7. 价格区间 (±8% 反映市场波动)
  const spread = 0.08;

  // 8. 置信度 (基于数据完整性)
  let confidence = 'high';
  if (!gradeData) confidence = 'medium';           // 配置未知
  if (year < 2015 && modelKey !== 'prius') confidence = 'medium'; // 老车型
  if (options.marketAdjustment) confidence = 'high'; // 有真实市场数据

  return {
    price:      Math.round(finalPrice / 500) * 500,   // 四舍五入到 $500
    low:        Math.round(finalPrice * (1 - spread) / 500) * 500,
    high:       Math.round(finalPrice * (1 + spread) / 500) * 500,
    confidence,
    breakdown: {
      basePrice:        Math.round(basePrice),
      gradeFactor,
      afterGrade:       Math.round(basePrice * gradeFactor),
      afterMileage:     Math.round(kmAdjusted),
      enginePremium:    Math.round(enginePremium * 100) + '%',
      conditionFactor,
      marketAdjustment: marketAdj,
    },
  };
}

/** 年份线性插值 */
function interpolateBasePrice(basePrices, year) {
  const years = Object.keys(basePrices).map(Number).sort((a, b) => a - b);
  if (year <= years[0]) return basePrices[years[0]] * 0.85;  // 超出范围打折
  if (year >= years[years.length - 1]) return basePrices[years[years.length - 1]] * 1.05;

  const lower = years.filter(y => y <= year).pop();
  const upper = years.filter(y => y >= year)[0];
  if (lower === upper) return basePrices[lower];

  const t = (year - lower) / (upper - lower);
  return basePrices[lower] + t * (basePrices[upper] - basePrices[lower]);
}

/** 未知配置等级时猜测系数 */
function guessGradeFactor(vehicle, gradeStr) {
  const lowerGrade = (gradeStr || '').toLowerCase();
  const grades = vehicle.grades;

  // 模糊匹配
  for (const [key, val] of Object.entries(grades)) {
    if (lowerGrade.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerGrade)) {
      return val.factor;
    }
  }

  // 根据关键词猜
  if (/executive|lounge/i.test(gradeStr)) return 1.00;
  if (/zg|g l|g f|premium/i.test(gradeStr)) return 0.88;
  if (/zr|g$/i.test(gradeStr)) return 0.80;
  if (/^z$|^a$/i.test(gradeStr)) return 0.75;
  if (/^s$|^v$|^e$/i.test(gradeStr)) return 0.72;

  return 0.82; // 中间值 fallback
}

module.exports = {
  VEHICLES,
  CONDITION_FACTORS,
  BASELINE_KM,
  estimateNzPrice,
  mileageAdjust,
  interpolateBasePrice,
};
