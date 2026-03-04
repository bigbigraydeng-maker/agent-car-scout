
/**
 * 测试版评分系统 - 仅用于验证建议出价
 */

const fs = require('fs');
const path = require('path');

// 加载价格预测模型
const { AdvancedPricePredictor } = require('./advanced-price-predictor');
const pricePredictor = new AdvancedPricePredictor();

// 加载模型
const modelPath = path.join(__dirname, '..', 'data', 'advanced_price_predictor.json');
if (fs.existsSync(modelPath)) {
  pricePredictor.loadModel(modelPath);
  console.log('✅ 价格预测模型加载成功');
}

// 市场参考价（兜底）
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

// 急售信号
const URGENT_SIGNALS = [
  'moving overseas', 'leaving nz', 'leaving country',
  'need gone', 'must sell', 'urgent sale', 'urgent',
  'price drop', 'reduced', 'negotiable', 'make an offer',
  'open to offers', 'or near offer', 'ono',
  '出国甩卖', '急转', '急售', '便宜卖'
];

// 检测急售信号
function detectUrgentSignals(description) {
  if (!description) return [];
  const desc = description.toLowerCase();
  return URGENT_SIGNALS.filter(s => desc.includes(s));
}

// 计算挂牌天数
function getDaysListed(postedDate) {
  if (!postedDate) return 0;
  try {
    const posted = new Date(postedDate);
    const now = new Date();
    return Math.floor((now - posted) / (1000 * 60 * 60 * 24));
  } catch (e) {
    return 0;
  }
}

// 静态表估价
function getStaticPrice(model, year, mileage, location) {
  const prices = MARKET_SELL_PRICES[model];
  if (!prices) return null;

  let price;
  const years = Object.keys(prices).map(Number).sort((a, b) => a - b);

  if (!year || year <= years[0]) {
    price = prices[years[0]];
  } else if (year >= years[years.length - 1]) {
    price = prices[years[years.length - 1];
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

// 获取预测价格
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
      return {
        price: prediction.predictedPrice,
        priceRange: prediction.priceRange || { min: prediction.predictedPrice * 0.85, max: prediction.predictedPrice * 1.15 },
        confidence: prediction.confidence,
        source: 'predictor'
      };
    }
  } catch (e) {
  }
  
  const staticPrice = getStaticPrice(model, year, mileage, location);
  if (staticPrice) {
    return {
      price: staticPrice,
      priceRange: { min: staticPrice * 0.85, max: staticPrice * 1.15 },
      source: 'static'
    };
  }
  
  return null;
}

// 估算整备成本
function estimatePrepCost(vehicle) {
  return 150;
}

// 主函数：计算单辆车的建议出价
function calculateSuggestedBid(vehicle) {
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
  
  if (netProfit < 0) {
    return {
      ...vehicle,
      predictedPrice: sellPrice,
      priceRange: priceRange,
      prepCost: prepCost,
      netProfit: netProfit,
      status: 'negative_profit',
      priceSource: predictionResult.source
    };
  }
  
  const urgentSignals = detectUrgentSignals(vehicle.description);
  const daysListed = getDaysListed(vehicle.postedDate);
  
  // 目标利润：30%
  const targetNetProfit = sellPrice * 0.30;
  const suggestedMaxBuy = Math.round(sellPrice - prepCost - targetNetProfit);
  
  // 智能建议出价
  let baseBid = Math.round(priceRange.min * 0.90);
  
  if (urgentSignals.length > 0) {
    baseBid = Math.round(baseBid * 0.95);
  }
  
  if (daysListed > 21) {
    baseBid = Math.round(baseBid * 0.92);
  } else if (daysListed > 14) {
    baseBid = Math.round(baseBid * 0.95);
  } else if (daysListed > 7) {
    baseBid = Math.round(baseBid * 0.97);
  }
  
  const maxBidFromCurrent = Math.round(vehicle.price * 0.95);
  let suggestedBid = Math.min(baseBid, maxBidFromCurrent, suggestedMaxBuy);
  suggestedBid = Math.max(suggestedBid, Math.round(vehicle.price * 0.70));
  
  return {
    ...vehicle,
    predictedPrice: sellPrice,
    priceRange: priceRange,
    prepCost: prepCost,
    netProfit: netProfit,
    profitMargin: Math.round((netProfit / vehicle.price) * 100),
    suggestedMaxBuy: suggestedMaxBuy,
    suggestedBid: suggestedBid,
    urgentSignals: urgentSignals,
    daysListed: daysListed,
    priceSource: predictionResult.source,
    status: 'ok'
  };
}

module.exports = { calculateSuggestedBid };
