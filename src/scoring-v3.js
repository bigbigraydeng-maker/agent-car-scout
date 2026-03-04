/**
 * Car Scout v3.1 - Flip Scoring System (优化版 v3)
 * 倒卖评分模型 (100分制)
 *
 * 优化内容 v3：
 * 1. 设置最低净利润门槛（10%）
 * 2. 基于模型置信度动态计算价格范围
 * 3. 不同价格区间使用不同目标利润率
 * 4. 急售信号加权计算
 * 5. 更精细的挂牌天数折扣
 * 6. 集成三级混合估价模型
 * 7. 黑名单过滤功能
 *
 * 三级混合估价模型:
 *   1. Predictor (随机森林) - 最高优先级
 *   2. KNN 市场估价 (基于 TradeMe 真实数据) - 次优先级
 *   3. 静态参考表 - 兜底方案
 *
 * 4 维度:
 *   净利润空间  35分 — 能赚多少
 *   周转速度    30分 — 多快卖出
 *   整备成本    15分 — 要花多少准备
 *   议价潜力    20分 — 还能砍多少
 */

const fs = require('fs');
const path = require('path');

// ─── 加载黑名单 ───
const BLACKLIST_PATH = path.join(__dirname, '..', 'blacklist_vehicles.json');
let blacklistIds = new Set();

try {
  if (fs.existsSync(BLACKLIST_PATH)) {
    const blacklist = JSON.parse(fs.readFileSync(BLACKLIST_PATH, 'utf8'));
    blacklistIds = new Set(blacklist.vehicles.map(v => v.id));
    console.log('⛔ 黑名单已加载:', blacklistIds.size, '辆车');
  }
} catch (e) {
  console.log('⚠️  黑名单加载失败:', e.message);
}

function isBlacklistedVehicle(vehicle) {
  if (!vehicle.listingUrl) return false;
  const listingId = vehicle.listingUrl.match(/listing\/(\d+)/)?.[1];
  if (listingId && blacklistIds.has(listingId)) {
    console.log(`   ⛔ 黑名单过滤: ${vehicle.year} ${vehicle.model} ($${vehicle.price})`);
    return true;
  }
  return false;
}

// ─── 加载价格预测模型 ───
const PREDICTOR_PATH = path.join(__dirname, 'advanced-price-predictor.js');
let AdvancedPricePredictor = null;
let pricePredictor = null;

try {
  const predictorModule = require(PREDICTOR_PATH);
  AdvancedPricePredictor = predictorModule.AdvancedPricePredictor;
  pricePredictor = new AdvancedPricePredictor();
  
  const modelPath = path.join(__dirname, '..', 'data', 'advanced_price_predictor.json');
  if (fs.existsSync(modelPath)) {
    pricePredictor.loadModel(modelPath);
    console.log('✅ 价格预测模型加载成功 (v3.1优化版)');
  } else {
    console.log('⚠️  未找到训练好的模型，将使用静态表');
  }
} catch (e) {
  console.log('⚠️  价格预测模型加载失败，将使用静态表:', e.message);
}

// ─── 定价规则配置 (v3.1新增) ───
const PRICING_CONFIG = {
  minProfitMargin: 0.10,           
  defaultTargetProfit: 0.30,       
  lowPriceTargetProfit: 0.35,      
  highPriceTargetProfit: 0.25,     
  lowPriceThreshold: 3500,          
  highPriceThreshold: 6000,         
  baseBidDiscount: 0.10,            
  maxBidFromCurrent: 0.95,          
  minBidFromCurrent: 0.70,          
  priceRangeLowConfidence: 0.15,    
  priceRangeHighConfidence: 0.10,   
  highConfidenceThreshold: 0.90     
};

// ─── 市场参考售价 (NZD, 个人转售价 @ 80k km 基线) ───
const MARKET_SELL_PRICES = {
  'Corolla':   { 2005: 4500, 2008: 5200, 2010: 6000, 2012: 7000, 2015: 8500 },
  'Vitz':      { 2005: 3500, 2008: 4200, 2010: 5000, 2012: 6000, 2015: 7000 },
  'Wish':      { 2005: 3500, 2008: 4200, 2010: 5000, 2012: 6000, 2015: 7500 },
  'RAV4':      { 2005: 5500, 2008: 6500, 2010: 7500, 2012: 9000, 2015: 12000 },
  'Honda Fit': { 2006: 3500, 2008: 4200, 2010: 5000, 2012: 6000, 2015: 7000 },
  'Demio':     { 2006: 3000, 2008: 3800, 2010: 4500, 2012: 5500, 2015: 6500 },
  'Aqua':      { 2012: 6500, 2014: 8000, 2016: 10000 },
  'Swift':     { 2005: 2500, 2008: 3500, 2010: 4500, 2012: 5500, 2015: 7500 },
  'Prius':     { 2005: 3500, 2008: 5000, 2010: 6500, 2012: 8000, 2015: 10000 },
  'Axela':     { 2005: 3500, 2008: 5000, 2010: 6000, 2012: 7500, 2015: 10000 },
  'Civic':     { 2006: 3500, 2008: 5000, 2010: 6000, 2012: 7500, 2015: 10000 },
  'Tiida':     { 2005: 2800, 2008: 3800, 2010: 4500, 2012: 5500, 2015: 7000 },
};

// ─── 周转等级 (按车型+地区) ───
const TURNOVER = {
  'Corolla_auckland': 'A', 'Vitz_auckland': 'A', 'Honda Fit_auckland': 'A',
  'Fielder_auckland': 'A', 'Aqua_auckland': 'A',
  'Swift_auckland': 'A', 'Prius_auckland': 'A',
  'Corolla_waikato': 'B', 'Vitz_waikato': 'B', 'Honda Fit_waikato': 'B',
  'RAV4_auckland': 'B', 'Demio_auckland': 'B',
  'Aqua_waikato': 'B', 'Swift_waikato': 'B', 'Prius_waikato': 'B',
  'Axela_auckland': 'B', 'Civic_auckland': 'B', 'Tiida_auckland': 'B',
  'Wish_auckland': 'C', 'RAV4_waikato': 'C', 'Demio_waikato': 'C',
  'Axela_waikato': 'C', 'Civic_waikato': 'C', 'Tiida_waikato': 'C',
  'Wish_waikato': 'D'
};

// ─── 急售信号 (v3.1优化：加权版本) ───
const URGENT_SIGNALS_WEIGHTED = {
  'moving overseas': 0.08,
  'leaving nz': 0.08,
  'leaving country': 0.08,
  'need gone': 0.07,
  'must sell': 0.06,
  'urgent sale': 0.06,
  'price drop': 0.05,
  'reduced': 0.05,
  'negotiable': 0.04,
  'make an offer': 0.04,
  'or near offer': 0.04,
  'ono': 0.03,
  '出国甩卖': 0.08,
  '急转': 0.06,
  '急售': 0.06,
  '便宜卖': 0.05
};

// ─── 高整备成本信号 ───
const HIGH_PREP_SIGNALS = [
  'needs new tyres', 'tyres need replacing', 'tyre',
  'battery flat', 'new battery needed',
  'ac not working', 'air con broken', 'no ac', 'no aircon',
  'dent', 'panel damage', 'body damage',
  'rust', 'rusty', '底盘生锈',
  'no wof', 'no warrant', 'wof expired',
  'no rego', 'rego expired', 'scratch'
];

// ─── 排除关键词 (机械硬伤，直接踢) ───
const EXCLUDE_KEYWORDS = [
  'engine problem', 'engine issue', 'transmission problem',
  'gearbox issue', 'blown head gasket', 'overheating',
  'engine knock', 'oil leak', 'coolant leak',
  'not running', "doesn't start", 'wont start', "won't start",
  'engine blown', 'gearbox blown', 'water damage',
  'written off', 'totaled', 'spares or repair',
  'as is', 'project car', 'for parts', 'wrecking',
  'head gasket', 'timing chain', 'cambelt due', 'timing belt due',
  'needs engine', 'needs gearbox', 'needs transmission',
  'smoke', 'smoking', 'knocking', 'rattling',
  'flood damage', 'fire damage', 'salvage',
  '发动机问题', '变速箱问题', '漏油', '漏水', '过热',
  '无法启动', '事故车', '泡水车', '报废'
];

// ─── 市场估价引擎 (KNN, 基于真实 TM 数据) ───
let valuateVehicle = () => null;
try {
  const marketValuation = require('./market-valuation');
  valuateVehicle = marketValuation.valuateVehicle;
} catch (e) {
  console.log('⚠️  市场估价引擎加载失败:', e.message);
}

/**
 * 使用三级混合估价模型获取预测价格 (v3.1优化：基于置信度计算价格范围)
 *
 * 优先级:
 *  1. Predictor (随机森林) - highest
 *  2. KNN 市场估价 - medium
 *  3. 静态参考表 - fallback
 */
function getPredictedPrice(model, year, mileage, location) {
  if (pricePredictor) {
    try {
      const prediction = pricePredictor.predict({
        make: model.toLowerCase().replace(/\s+/g, ''),
        model: model.toLowerCase().replace(/\s+/g, ''),
        year: year,
        mileage: mileage,
        location: location || 'Auckland',
        sellerType: 'private'
      });
      
      if (prediction && prediction.predictedPrice) {
        const confidence = prediction.confidence;
        const rangeMultiplier = confidence >= PRICING_CONFIG.highConfidenceThreshold 
          ? PRICING_CONFIG.priceRangeHighConfidence 
          : PRICING_CONFIG.priceRangeLowConfidence;
        
        return {
          price: prediction.predictedPrice,
          priceRange: {
            min: Math.round(prediction.predictedPrice * (1 - rangeMultiplier)),
            max: Math.round(prediction.predictedPrice * (1 + rangeMultiplier))
          },
          confidence: confidence,
          source: 'predictor'
        };
      }
    } catch (e) {
    }
  }
  
  const valuation = valuateVehicle(model, year, mileage, location);
  if (valuation && valuation.confidence !== 'none') {
    if (valuation.confidence === 'low') {
      const staticPrice = getStaticPrice(model, year, mileage, location);
      if (staticPrice) {
        return {
          price: Math.round((valuation.price + staticPrice) / 2),
          priceRange: {
            min: Math.round(valuation.price * 0.85),
            max: Math.round(valuation.price * 1.15)
          },
          confidence: 0.7,
          source: 'knn+static'
        };
      }
    }
    return {
      price: valuation.price,
      priceRange: {
        min: Math.round(valuation.price * 0.85),
        max: Math.round(valuation.price * 1.15)
      },
      confidence: 0.75,
      source: 'knn'
    };
  }
  
  const staticPrice = getStaticPrice(model, year, mileage, location);
  if (staticPrice) {
    return {
      price: staticPrice,
      priceRange: {
        min: Math.round(staticPrice * 0.85),
        max: Math.round(staticPrice * 1.15)
      },
      confidence: 0.7,
      source: 'static'
    };
  }
  
  return null;
}

/**
 * 静态表估价 (兜底: 无市场数据时使用)
 */
function getStaticPrice(model, year, mileage, location) {
  const prices = MARKET_SELL_PRICES[model];
  if (!prices) return null;

  let price;
  const years = Object.keys(prices).map(Number).sort((a, b) => a - b);

  if (!year || year <= years[0]) {
    price = prices[years[0]];
  } else if (year >= years[years.length - 1]) {
    price = prices[years[years.length - 1]];
  } else {
    let lo = years[0], hi = years[years.length - 1];
    for (let i = 0; i < years.length - 1; i++) {
      if (year >= years[i] && year <= years[i + 1]) {
        lo = years[i]; hi = years[i + 1]; break;
      }
    }
    const ratio = (year - lo) / (hi - lo);
    price = prices[lo] + ratio * (prices[hi] - prices[lo]);
  }

  const mileageOver80k = Math.max(0, (mileage || 130000) - 80000);
  const mileageDiscount = Math.min(0.5, (mileageOver80k / 80000) * 0.25);
  price *= (1 - mileageDiscount);

  if (location && location.toLowerCase().includes('waikato')) {
    price *= 0.95;
  }

  return Math.round(price);
}

/**
 * 估算市场转售价
 */
function estimateSellPrice(model, year, mileage, location) {
  const result = getPredictedPrice(model, year, mileage, location);
  return result ? result.price : null;
}

/**
 * 估算整备成本
 */
function estimatePrepCost(vehicle) {
  let cost = 150;
  const desc = (vehicle.description || '').toLowerCase();

  if (desc.includes('no wof') || desc.includes('no warrant') || desc.includes('wof expired')) {
    cost += 700;
  } else if (desc.includes('wof') && (desc.includes('month') || desc.includes('valid'))) {
    cost += 0;
  } else {
    cost += 200;
  }

  const matches = HIGH_PREP_SIGNALS.filter(s => desc.includes(s));
  cost += matches.length * 150;

  return Math.min(cost, 1500);
}

/**
 * 检测急售信号 (v3.1优化：返回带权重的信号)
 */
function detectUrgentSignals(description) {
  if (!description) return [];
  const desc = description.toLowerCase();
  const signals = [];
  
  for (const [signal, weight] of Object.entries(URGENT_SIGNALS_WEIGHTED)) {
    if (desc.includes(signal)) {
      signals.push({ signal, weight });
    }
  }
  
  return signals;
}

/**
 * 计算急售折扣 (v3.1新增)
 */
function calculateUrgentDiscount(description) {
  if (!description) return 1.0;
  
  const desc = description.toLowerCase();
  let totalDiscount = 1.0;
  
  for (const [signal, discount] of Object.entries(URGENT_SIGNALS_WEIGHTED)) {
    if (desc.includes(signal)) {
      totalDiscount *= (1 - discount);
    }
  }
  
  return Math.max(totalDiscount, 0.85);
}

/**
 * 计算挂牌天数折扣 (v3.1优化)
 */
function calculateDaysListedDiscount(postedDate) {
  if (!postedDate) return 1.0;
  
  try {
    const posted = new Date(postedDate);
    const now = new Date();
    const daysListed = Math.floor((now - posted) / (1000 * 60 * 60 * 24));
    
    if (daysListed > 21) return 0.92;
    if (daysListed > 14) return 0.95;
    if (daysListed > 7) return 0.97;
    return 1.0;
  } catch (e) {
    return 1.0;
  }
}

/**
 * 检查是否有机械硬伤
 */
function hasMechanicalIssue(description) {
  if (!description) return false;
  const desc = description.toLowerCase();
  return EXCLUDE_KEYWORDS.some(kw => desc.includes(kw));
}

/**
 * 计算挂牌天数
 */
function getDaysListed(postedDate) {
  if (!postedDate) return 0;
  const posted = new Date(postedDate);
  const now = new Date();
  return Math.floor((now - posted) / (1000 * 60 * 60 * 24));
}

/**
 * 获取目标利润率 (v3.1新增)
 */
function getTargetProfitMargin(predictedPrice) {
  if (predictedPrice <= PRICING_CONFIG.lowPriceThreshold) {
    return PRICING_CONFIG.lowPriceTargetProfit;
  } else if (predictedPrice >= PRICING_CONFIG.highPriceThreshold) {
    return PRICING_CONFIG.highPriceTargetProfit;
  }
  return PRICING_CONFIG.defaultTargetProfit;
}

// ═══════════════════════════════════════════
// 4 维度评分
// ═══════════════════════════════════════════

function scoreProfitMargin(buyPrice, sellPrice, prepCost) {
  const netProfit = sellPrice - buyPrice - prepCost;
  const margin = netProfit / buyPrice;

  if (margin >= 0.40) return 35;
  if (margin >= 0.30) return 30;
  if (margin >= 0.20) return 24;
  if (margin >= 0.15) return 18;
  if (margin >= 0.10) return 12;
  if (margin >= 0.05) return 6;
  return 0;
}

function scoreTurnover(model, location) {
  const loc = (location || '').toLowerCase();
  const region = loc.includes('auckland') ? 'auckland' :
                 loc.includes('waikato') || loc.includes('hamilton') ? 'waikato' :
                 'other';

  const key = `${model}_${region}`;
  const grade = TURNOVER[key] || 'D';

  switch (grade) {
    case 'A': return 30;
    case 'B': return 22;
    case 'C': return 15;
    case 'D': return 8;
    default: return 5;
  }
}

function scorePrepCost(prepCost) {
  if (prepCost <= 150) return 15;
  if (prepCost <= 350) return 12;
  if (prepCost <= 600) return 8;
  if (prepCost <= 1000) return 4;
  return 0;
}

function scoreNegotiation(vehicle) {
  let score = 0;
  const desc = (vehicle.description || '').toLowerCase();
  const daysListed = getDaysListed(vehicle.postedDate);

  const urgentSignals = detectUrgentSignals(vehicle.description);
  score += Math.min(urgentSignals.length * 4, 10);

  if (daysListed > 21) score += 6;
  else if (daysListed > 14) score += 4;
  else if (daysListed > 7) score += 2;

  const sellPrice = estimateSellPrice(vehicle.model, vehicle.year, vehicle.mileage, vehicle.location);
  if (sellPrice) {
    const overpriceRatio = vehicle.price / sellPrice;
    if (overpriceRatio > 0.95) score += 4;
    else if (overpriceRatio > 0.85) score += 2;
  }

  return Math.min(score, 20);
}

// ═══════════════════════════════════════════
// 主评分函数 (v3.1优化版)
// ═══════════════════════════════════════════

function calculateFlipScore(vehicle) {
  if (vehicle.mileage > 160000) return null;
  if (vehicle.year < 2005) return null;
  if (vehicle.price < 2500 || vehicle.price > 8000) return null;
  if (hasMechanicalIssue(vehicle.description)) return null;
  if (vehicle.seller && vehicle.seller.toLowerCase() === 'dealer') return null;

  const predictionResult = getPredictedPrice(
    vehicle.model, 
    vehicle.year, 
    vehicle.mileage, 
    vehicle.location
  );
  
  if (!predictionResult) return null;
  
  const sellPrice = predictionResult.price;
  const priceRange = predictionResult.priceRange;
  const confidence = predictionResult.confidence;
  
  const prepCost = estimatePrepCost(vehicle);
  const netProfit = sellPrice - vehicle.price - prepCost;
  const profitMargin = netProfit / vehicle.price;
  
  if (netProfit < 0) return null;
  
  if (profitMargin < PRICING_CONFIG.minProfitMargin) return null;
  
  const urgentSignals = detectUrgentSignals(vehicle.description);
  const daysListed = getDaysListed(vehicle.postedDate);

  const scores = {
    profitMargin: scoreProfitMargin(vehicle.price, sellPrice, prepCost),
    turnover: scoreTurnover(vehicle.model, vehicle.location),
    prepCost: scorePrepCost(prepCost),
    negotiation: scoreNegotiation(vehicle)
  };

  const total = scores.profitMargin + scores.turnover + scores.prepCost + scores.negotiation;

  let flipGrade;
  if (total >= 80) flipGrade = 'S';
  else if (total >= 65) flipGrade = 'A';
  else if (total >= 50) flipGrade = 'B';
  else flipGrade = 'C';

  const loc = (vehicle.location || '').toLowerCase();
  const region = loc.includes('auckland') ? 'auckland' :
                 loc.includes('waikato') || loc.includes('hamilton') ? 'waikato' : 'other';
  const turnoverGrade = TURNOVER[`${vehicle.model}_${region}`] || 'D';

  // ========== 智能建议出价算法 (v3.1优化版) ==========
  const targetProfitMargin = getTargetProfitMargin(sellPrice);
  const targetNetProfit = sellPrice * targetProfitMargin;
  const suggestedMaxBuy = Math.round(sellPrice - prepCost - targetNetProfit);
  
  let baseBid = Math.round(priceRange.min * (1 - PRICING_CONFIG.baseBidDiscount));
  
  const urgentDiscount = calculateUrgentDiscount(vehicle.description);
  baseBid = Math.round(baseBid * urgentDiscount);
  
  const daysDiscount = calculateDaysListedDiscount(vehicle.postedDate);
  baseBid = Math.round(baseBid * daysDiscount);
  
  const maxBidFromCurrent = Math.round(vehicle.price * PRICING_CONFIG.maxBidFromCurrent);
  let suggestedBid = Math.min(baseBid, maxBidFromCurrent, suggestedMaxBuy);
  suggestedBid = Math.max(suggestedBid, Math.round(vehicle.price * PRICING_CONFIG.minBidFromCurrent));
  
  return {
    total,
    flipGrade,
    breakdown: scores,
    sellPrice,
    priceRange,
    confidence,
    prepCost,
    netProfit,
    profitMargin: Math.round(profitMargin * 100),
    turnoverGrade,
    daysListed,
    urgentSignals: urgentSignals.map(s => s.signal),
    targetProfitMargin: Math.round(targetProfitMargin * 100),
    suggestedMaxBuy,
    suggestedBid,
    priceSource: predictionResult.source
  };
}

function scoreVehicles(vehicles) {
  const results = [];
  let filteredCount = 0;

  for (const vehicle of vehicles) {
    if (isBlacklistedVehicle(vehicle)) {
      filteredCount++;
      continue;
    }

    const flip = calculateFlipScore(vehicle);
    if (!flip) continue;

    results.push({
      ...vehicle,
      flipScore: flip.total,
      flipGrade: flip.flipGrade,
      scoreBreakdown: flip.breakdown,
      estimatedSellPrice: flip.sellPrice,
      estimatedPriceRange: flip.priceRange,
      confidence: flip.confidence,
      estimatedPrepCost: flip.prepCost,
      estimatedNetProfit: flip.netProfit,
      profitMargin: flip.profitMargin,
      turnoverGrade: flip.turnoverGrade,
      daysListed: flip.daysListed,
      urgentSignals: flip.urgentSignals,
      targetProfitMargin: flip.targetProfitMargin,
      suggestedMaxBuy: flip.suggestedMaxBuy,
      suggestedBid: flip.suggestedBid,
      priceSource: flip.priceSource
    });
  }

  if (filteredCount > 0) {
    console.log(`⛔ 黑名单过滤了 ${filteredCount} 辆车`);
  }

  results.sort((a, b) => b.flipScore - a.flipScore);
  return results;
}

function main() {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const dataPath = path.join(__dirname, '..', 'data', `vehicles_${date}.json`);

  if (!fs.existsSync(dataPath)) {
    console.error('No data file:', dataPath);
    return;
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const scored = scoreVehicles(data.vehicles);

  const scoredPath = path.join(__dirname, '..', 'data', `scored_${date}.json`);
  fs.writeFileSync(scoredPath, JSON.stringify({
    scoredDate: new Date().toISOString(),
    version: '3.1-flip-optimized',
    totalScanned: data.vehicles.length,
    totalQualified: scored.length,
    pricingConfig: PRICING_CONFIG,
    vehicles: scored
  }, null, 2));

  console.log(`Scored ${scored.length}/${data.vehicles.length} vehicles`);
  console.log(`S-grade: ${scored.filter(v => v.flipGrade === 'S').length}`);
  console.log(`A-grade: ${scored.filter(v => v.flipGrade === 'A').length}`);

  return scored;
}

if (require.main === module) {
  main();
}

module.exports = {
  scoreVehicles,
  calculateFlipScore,
  estimateSellPrice,
  estimatePrepCost,
  hasMechanicalIssue,
  detectUrgentSignals,
  getPredictedPrice,
  EXCLUDE_KEYWORDS,
  PRICING_CONFIG
};
