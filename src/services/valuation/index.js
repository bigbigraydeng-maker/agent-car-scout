/**
 * 市场估价服务
 * 
 * 功能：
 *   1. 基于KNN算法的车辆估价
 *   2. 管理估价模型
 *   3. 提供估价统计信息
 */

const { supabaseAdmin, TABLES } = require('../../config/supabase');

// 配置
const CONFIG = {
  DEPRECIATION_RATE: 0.03,   // 3% per 10k km
  BASELINE_KM: 80000,
  YEAR_RANGE: 2,             // ±2 years
  KM_RANGE: 40000,           // ±40k km
  DEALER_PRICE_FACTOR: 0.70, // Dealer→private 价格转换
  DEALER_WEIGHT: 0.5,        // 车商数据权重 (vs private=1.0)
  YEAR_WEIGHT_DECAY: 0.15,   // 每年差距权重衰减
  PLATFORM_WEIGHTS: {
    trademe: 1.0,
    facebook: 0.8,
    other: 0.6
  }
};

// 里程标准化
function normalizeToBaseline(price, km) {
  if (!km || km <= 0) return price;
  const deltaUnits = (km - CONFIG.BASELINE_KM) / 10000;
  return price * Math.pow(1 + CONFIG.DEPRECIATION_RATE, deltaUnits);
}

// 反标准化
function denormalizeFromBaseline(baselinePrice, targetKm) {
  if (!targetKm || targetKm <= 0) return baselinePrice;
  const deltaUnits = (targetKm - CONFIG.BASELINE_KM) / 10000;
  return baselinePrice * Math.pow(1 - CONFIG.DEPRECIATION_RATE, deltaUnits);
}

// 加权中位数
function weightedMedian(items) {
  if (items.length === 0) return 0;
  if (items.length === 1) return items[0].value;

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

// 估价服务
const valuationService = {
  // 车辆估价
  async valuateVehicle(model, year, mileage = 130000, location = 'Auckland') {
    try {
      // 从数据库获取同车型的 listings
      const { data: listings, error } = await supabaseAdmin
        .from(TABLES.LISTINGS)
        .select('*')
        .eq('model', model)
        .gte('year', year - CONFIG.YEAR_RANGE)
        .lte('year', year + CONFIG.YEAR_RANGE)
        .limit(100);

      if (error) {
        throw new Error('Failed to fetch listings');
      }

      if (!listings || listings.length === 0) {
        return null;
      }

      // 筛选里程范围内的候选
      const targetKm = mileage || 130000;
      const candidates = listings.filter(l => {
        if (!l.km || l.km <= 0) return true;
        return Math.abs(l.km - targetKm) <= CONFIG.KM_RANGE;
      });

      if (candidates.length === 0) {
        // 放宽条件
        return this.computeValuation(listings, year, targetKm, location, true);
      }

      return this.computeValuation(candidates, year, targetKm, location, false);
    } catch (error) {
      console.error('Valuation error:', error);
      throw error;
    }
  },

  // 计算估价
  computeValuation(candidates, targetYear, targetKm, location, isWide) {
    const weighted = [];

    for (const c of candidates) {
      let price = c.price;

      // 车商价格转换
      if (c.seller_type === 'dealer') {
        price *= CONFIG.DEALER_PRICE_FACTOR;
      }

      // 里程标准化
      if (c.km > 0) {
        price = normalizeToBaseline(price, c.km);
      }

      // 计算权重
      let weight = 1.0;

      // 卖家类型权重
      if (c.seller_type === 'dealer') {
        weight *= CONFIG.DEALER_WEIGHT;
      }

      // 年份距离权重
      const yearDiff = Math.abs(c.year - targetYear);
      weight *= Math.max(0.1, 1.0 - yearDiff * CONFIG.YEAR_WEIGHT_DECAY);

      // 平台权重
      const platformWeight = CONFIG.PLATFORM_WEIGHTS[c.platform] || CONFIG.PLATFORM_WEIGHTS.other;
      weight *= platformWeight;

      // km 未知的降权
      if (!c.km || c.km <= 0) {
        weight *= 0.5;
      }

      weighted.push({ value: price, weight });
    }

    if (weighted.length === 0) return null;

    // 加权中位数
    const baselinePrice = weightedMedian(weighted);

    // 反标准化到目标里程
    let finalPrice = denormalizeFromBaseline(baselinePrice, targetKm);

    // 位置调整
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

    // 平台分布
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
      model: candidates[0].model,
      year: targetYear,
      mileage: targetKm,
      location
    };
  },

  // 获取估价模型
  async getValuationModels(model, year) {
    const query = supabaseAdmin.from(TABLES.VALUATION_MODELS).select('*');

    if (model) {
      query.eq('model_name', model);
    }

    if (year) {
      query.eq('year', year);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch valuation models');
    }

    return data;
  },

  // 获取车型列表
  async getModelList() {
    const { data, error } = await supabaseAdmin
      .from(TABLES.LISTINGS)
      .select('model')
      .distinct('model')
      .order('model');

    if (error) {
      throw new Error('Failed to fetch model list');
    }

    return data.map(item => item.model);
  },

  // 获取估价统计信息
  async getValuationStats() {
    const { data: listings, error: listingsError } = await supabaseAdmin
      .from(TABLES.LISTINGS)
      .select('model, year, price, platform');

    if (listingsError) {
      throw new Error('Failed to fetch listings for stats');
    }

    const { data: models, error: modelsError } = await supabaseAdmin
      .from(TABLES.VALUATION_MODELS)
      .select('model_name, year, sample_count');

    if (modelsError) {
      throw new Error('Failed to fetch models for stats');
    }

    // 计算统计信息
    const stats = {
      totalListings: listings.length,
      totalModels: new Set(listings.map(l => l.model)).size,
      platformDistribution: {},
      averagePrice: 0,
      modelCount: models.length
    };

    // 平台分布
    listings.forEach(l => {
      stats.platformDistribution[l.platform] = (stats.platformDistribution[l.platform] || 0) + 1;
      stats.averagePrice += l.price;
    });

    if (listings.length > 0) {
      stats.averagePrice = Math.round(stats.averagePrice / listings.length);
    }

    return stats;
  },

  // 保存估价模型
  async saveValuationModel(modelData) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.VALUATION_MODELS)
      .upsert(modelData, { onConflict: 'model_name,year' });

    if (error) {
      throw new Error('Failed to save valuation model');
    }

    return data;
  }
};

module.exports = valuationService;