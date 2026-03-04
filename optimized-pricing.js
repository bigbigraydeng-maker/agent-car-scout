/**
 * Car Scout v3.1 - 优化版定价规则
 * 
 * 优化内容：
 * 1. 设置最低净利润门槛（15%）
 * 2. 基于模型置信度计算价格范围
 * 3. 不同价格区间使用不同目标利润率
 * 4. 更精细的急售信号权重
 */

const fs = require('fs');
const path = require('path');

// ─── 加载价格预测模型 ───
const { AdvancedPricePredictor } = require('./advanced-price-predictor');
const pricePredictor = new AdvancedPricePredictor();

const modelPath = path.join(__dirname, 'data', 'advanced_price_predictor.json');
if (fs.existsSync(modelPath)) {
  pricePredictor.loadModel(modelPath);
  console.log('✅ 价格预测模型加载成功\n');
}

// ─── 静态表 (兜底) ───
const MARKET_SELL_PRICES = {
  'Corolla':   { 2005: 4500, 2008: 5200, 2010: 6000, 2012: 7000, 2015: 8500 },
  'Vitz':      { 2005: 3500, 2008: 4200, 2010: 5000, 2012: 6000, 2015: 7000 },
  'RAV4':      { 2005: 5500, 2008: 6500, 2010: 7500, 2012: 9000, 2015: 12000 },
};

// ─── 急售信号权重 ───
const URGENT_SIGNALS = {
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
  'ono': 0.03
};

// ─── 定价规则配置 ───
const PRICING_CONFIG = {
  minProfitMargin: 0.15,           // 最低净利润率 15%
  defaultTargetProfit: 0.30,       // 默认目标利润率 30%
  lowPriceTargetProfit: 0.35,      // 低价车目标利润率 35%
  highPriceTargetProfit: 0.25,     // 高价车目标利润率 25%
  lowPriceThreshold: 3500,          // 低价车门槛
  highPriceThreshold: 6000,         // 高价车门槛
  baseBidDiscount: 0.10,            // 基础出价折扣
  maxBidFromCurrent: 0.95,          // 不超过当前价格的百分比
  minBidFromCurrent: 0.70,          // 不低于当前价格的百分比
  priceRangeLowConfidence: 0.15,    // 低置信度价格范围
  priceRangeHighConfidence: 0.10,   // 高置信度价格范围
  highConfidenceThreshold: 0.90     // 高置信度门槛
};

// ─── 获取预测价格 ───
function getPredictedPrice(model, year, mileage, location) {
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
  
  const prices = MARKET_SELL_PRICES[model];
  if (prices) {
    const years = Object.keys(prices).map(Number).sort((a, b) => a - b);
    let price = prices[years[0]];
    if (year >= years[years.length - 1]) {
      price = prices[years[years.length - 1]];
    } else {
      for (let i = 0; i < years.length - 1; i++) {
        if (year >= years[i] && year <= years[i + 1]) {
          const ratio = (year - years[i]) / (years[i + 1] - years[i]);
          price = prices[years[i]] + ratio * (prices[years[i + 1]] - prices[years[i]]);
          break;
        }
      }
    }
    
    const mileageOver80k = Math.max(0, (mileage || 130000) - 80000);
    const mileageDiscount = Math.min(0.5, (mileageOver80k / 80000) * 0.25);
    price *= (1 - mileageDiscount);
    
    return {
      price: Math.round(price),
      priceRange: {
        min: Math.round(price * 0.85),
        max: Math.round(price * 1.15)
      },
      confidence: 0.7,
      source: 'static'
    };
  }
  
  return null;
}

// ─── 计算急售折扣 ───
function calculateUrgentDiscount(description) {
  if (!description) return 1.0;
  
  const desc = description.toLowerCase();
  let totalDiscount = 1.0;
  
  for (const [signal, discount] of Object.entries(URGENT_SIGNALS)) {
    if (desc.includes(signal)) {
      totalDiscount *= (1 - discount);
    }
  }
  
  return Math.max(totalDiscount, 0.85);
}

// ─── 计算挂牌天数折扣 ───
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

// ─── 估算整备成本 ───
function estimatePrepCost(vehicle) {
  return 150;
}

// ─── 获取目标利润率 ───
function getTargetProfitMargin(predictedPrice) {
  if (predictedPrice <= PRICING_CONFIG.lowPriceThreshold) {
    return PRICING_CONFIG.lowPriceTargetProfit;
  } else if (predictedPrice >= PRICING_CONFIG.highPriceThreshold) {
    return PRICING_CONFIG.highPriceTargetProfit;
  }
  return PRICING_CONFIG.defaultTargetProfit;
}

// ─── 优化版主定价函数 ───
function calculateOptimizedBid(vehicle) {
  if (!vehicle.model || !vehicle.year || !vehicle.price || !vehicle.mileage) {
    return null;
  }
  
  const predictionResult = getPredictedPrice(
    vehicle.model,
    vehicle.year,
    vehicle.mileage,
    vehicle.location
  );
  
  if (!predictionResult) {
    return null;
  }
  
  const sellPrice = predictionResult.price;
  const priceRange = predictionResult.priceRange;
  const prepCost = estimatePrepCost(vehicle);
  const netProfit = sellPrice - vehicle.price - prepCost;
  const profitMargin = netProfit / vehicle.price;
  
  if (netProfit < 0) {
    return {
      ...vehicle,
      predictedPrice: sellPrice,
      priceRange: priceRange,
      prepCost: prepCost,
      netProfit: netProfit,
      status: 'negative_profit',
      priceSource: predictionResult.source,
      confidence: predictionResult.confidence
    };
  }
  
  if (profitMargin < PRICING_CONFIG.minProfitMargin) {
    return {
      ...vehicle,
      predictedPrice: sellPrice,
      priceRange: priceRange,
      prepCost: prepCost,
      netProfit: netProfit,
      profitMargin: Math.round(profitMargin * 100),
      status: 'low_profit',
      priceSource: predictionResult.source,
      confidence: predictionResult.confidence
    };
  }
  
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
    ...vehicle,
    predictedPrice: sellPrice,
    priceRange: priceRange,
    prepCost: prepCost,
    netProfit: netProfit,
    profitMargin: Math.round(profitMargin * 100),
    suggestedMaxBuy: suggestedMaxBuy,
    suggestedBid: suggestedBid,
    targetProfitMargin: Math.round(targetProfitMargin * 100),
    priceSource: predictionResult.source,
    confidence: predictionResult.confidence,
    urgentDiscount: urgentDiscount,
    daysDiscount: daysDiscount,
    status: 'ok'
  };
}

// ─── 测试优化版 ───
const testVehicles = [
  {
    title: '2007 RAV4',
    model: 'RAV4',
    year: 2007,
    price: 2750,
    mileage: 88000,
    location: 'Albany, Auckland',
    prepCost: 500,
    description: ''
  },
  {
    title: '2007 Corolla',
    model: 'Corolla',
    year: 2007,
    price: 2750,
    mileage: 153000,
    location: 'Palmerston North',
    prepCost: 300,
    description: 'ono'
  },
  {
    title: '2009 Vitz',
    model: 'Vitz',
    year: 2009,
    price: 4800,
    mileage: 148000,
    location: 'Auckland City',
    prepCost: 300,
    description: 'ono'
  }
];

console.log('🚗 优化版定价规则测试');
console.log('========================================\n');

for (const vehicle of testVehicles) {
  const result = calculateOptimizedBid(vehicle);
  
  if (result) {
    console.log(`🚗 ${vehicle.title}`);
    console.log(`   当前价格: $${vehicle.price.toLocaleString()}`);
    console.log(`   预测售价: $${result.predictedPrice.toLocaleString()}`);
    console.log(`   价格范围: $${result.priceRange.min.toLocaleString()} - $${result.priceRange.max.toLocaleString()}`);
    console.log(`   置信度: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   整备成本: $${result.prepCost.toLocaleString()}`);
    console.log(`   净利润: $${result.netProfit.toLocaleString()} (${result.profitMargin}%)`);
    
    if (result.status === 'ok') {
      console.log(`   目标利润率: ${result.targetProfitMargin}%`);
      console.log(`   建议出价: $${result.suggestedBid.toLocaleString()}`);
      console.log(`   最高买入: $${result.suggestedMaxBuy.toLocaleString()}`);
      if (result.urgentDiscount < 1.0) {
        console.log(`   急售折扣: ${Math.round((1 - result.urgentDiscount) * 100)}%`);
      }
      if (result.daysDiscount < 1.0) {
        console.log(`   挂牌天数折扣: ${Math.round((1 - result.daysDiscount) * 100)}%`);
      }
    } else if (result.status === 'low_profit') {
      console.log(`   ⚠️  低利润 (低于${PRICING_CONFIG.minProfitMargin * 100}%门槛) - 已过滤`);
    } else {
      console.log(`   ❌ 负利润 - 已过滤`);
    }
    console.log(`   价格来源: ${result.priceSource}`);
    console.log('');
  }
}

console.log('========================================');
console.log('✅ 优化版测试完成!');
console.log('========================================\n');
console.log('💡 优化内容:');
console.log(`  1. 最低净利润门槛: ${PRICING_CONFIG.minProfitMargin * 100}%`);
console.log(`  2. 低价车目标利润率: ${PRICING_CONFIG.lowPriceTargetProfit * 100}%`);
console.log(`  3. 高价车目标利润率: ${PRICING_CONFIG.highPriceTargetProfit * 100}%`);
console.log(`  4. 价格范围基于置信度动态调整`);
console.log(`  5. 急售信号加权计算`);
console.log('');
