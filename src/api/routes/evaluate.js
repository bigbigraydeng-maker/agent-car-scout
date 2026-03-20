/**
 * 拍卖车辆评估 API
 *
 * POST /api/evaluate
 *   接收日本拍卖车辆信息 + 成本价，返回完整的利润分析。
 *
 * GET /api/evaluate/history
 *   查询历史评估记录。
 *
 * GET /api/evaluate/vehicles
 *   返回支持的车型和配置列表 (供前端下拉菜单使用)。
 */

const express = require('express');
const router = express.Router();
const { predictPrice } = require('../../services/pricing');
const { calculateImportCosts, analyzeProfits } = require('../../services/costs');
const { supabaseAdmin, TABLES } = require('../../config/supabase');
const { VEHICLES, CONDITION_FACTORS } = require('../../data/vehicles');

// ─── 车型元数据 (供前端使用) ─────────────────────────────────
router.get('/vehicles', (req, res) => {
  const meta = Object.entries(VEHICLES).map(([key, v]) => ({
    key,
    make: v.make,
    model: v.model,
    series: v.series,
    modelCodes: v.modelCodes,
    grades: Object.entries(v.grades).map(([name, data]) => ({
      name,
      factor: data.factor,
      tier: data.tier,
      description: data.description,
    })),
    yearRange: {
      min: Math.min(...Object.keys(v.basePrices).map(Number)),
      max: Math.max(...Object.keys(v.basePrices).map(Number)),
    },
    trademeSearch: v.trademeSearch,
  }));

  res.json({
    success: true,
    vehicles: meta,
    conditionGrades: Object.keys(CONDITION_FACTORS).map(k => ({
      code: k,
      factor: CONDITION_FACTORS[k],
      label: conditionLabel(k),
    })),
  });
});

// ─── 核心评估接口 ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      modelKey,           // 'alphard' | 'vellfire' | 'prius'
      grade,              // 'Executive Lounge' etc.
      modelCode,          // 'AYH30W' etc.
      year,               // 2017
      km,                 // 96998
      condition,          // '4'
      isEFour,            // Prius 4WD
      auctionPriceJpy,    // 2500000
      jpyToNzd,           // 0.0115
      location,           // 'Auckland'
      notes,
    } = req.body;

    // 参数校验
    if (!modelKey || !year || !auctionPriceJpy) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: modelKey, year, auctionPriceJpy',
      });
    }

    if (!VEHICLES[modelKey]) {
      return res.status(400).json({
        success: false,
        error: `不支持的车型: ${modelKey}。支持: ${Object.keys(VEHICLES).join(', ')}`,
      });
    }

    // ── 1. NZ 价格预测 ─────────────────────────────────────────
    const prediction = await predictPrice({
      modelKey,
      year:      parseInt(year),
      km:        parseInt(km)   || 100000,
      grade,
      condition: String(condition || '4'),
      modelCode,
      isEFour:   Boolean(isEFour),
      location,
    });

    // ── 2. 进口成本 ────────────────────────────────────────────
    const costs = calculateImportCosts({
      modelKey,
      grade,
      auctionPriceJpy: parseInt(auctionPriceJpy),
      jpyToNzd:        parseFloat(jpyToNzd) || 0.0115,
    });

    // ── 3. 利润分析 ────────────────────────────────────────────
    const profit = analyzeProfits(prediction.price, costs);

    // ── 4. 持久化 (可选) ───────────────────────────────────────
    let evaluationId = null;
    if (supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from(TABLES.EVALUATIONS)
          .insert({
            model_key:           modelKey,
            model:               VEHICLES[modelKey].model,
            grade,
            model_code:          modelCode,
            year:                parseInt(year),
            km:                  parseInt(km) || null,
            condition_score:     String(condition || '4'),
            is_e_four:           Boolean(isEFour),
            auction_price_jpy:   parseInt(auctionPriceJpy),
            jpy_to_nzd_rate:     parseFloat(jpyToNzd) || 0.0115,
            auction_price_nzd:   costs.auctionPriceNzd,
            estimated_nz_price:  prediction.price,
            price_low:           prediction.low,
            price_high:          prediction.high,
            prediction_source:   prediction.source,
            confidence:          prediction.confidence,
            sample_count:        prediction.sampleCount,
            total_landed_cost:   costs.totalLandedCost,
            costs_json:          costs,
            net_profit:          profit.netProfit,
            margin_pct:          profit.marginPct,
            recommendation:      profit.recommendation,
            location,
            notes,
          })
          .select('id')
          .single();
        if (data) evaluationId = data.id;
      } catch (_) { /* 非致命, 继续返回结果 */ }
    }

    res.json({
      success: true,
      evaluationId,
      input: {
        modelKey,
        model:     VEHICLES[modelKey].model,
        grade,
        modelCode,
        year:      parseInt(year),
        km:        parseInt(km) || null,
        condition: String(condition || '4'),
        location,
      },
      prediction,
      costs,
      profit,
    });

  } catch (err) {
    console.error('[evaluate]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 历史评估记录 ─────────────────────────────────────────────
router.get('/history', async (req, res) => {
  if (!supabaseAdmin) {
    return res.json({ success: true, evaluations: [] });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLES.EVALUATIONS)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json({ success: true, evaluations: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 工具 ─────────────────────────────────────────────────────
function conditionLabel(code) {
  const labels = {
    '5': '5 — 极好 (完美, 无瑕疵)',
    '4.5': '4.5 — 非常好',
    '4': '4 — 好 (标准参考)',
    '3.5': '3.5 — 较好 (有轻微小划痕)',
    '3': '3 — 一般 (明显瑕疵)',
    '2': '2 — 差 (多处损伤)',
    'R': 'R — 修复车 (已维修)',
    'RA': 'RA — 修复车 (气囊曾展开)',
    'A': 'A — 事故车',
  };
  return labels[code] || code;
}

module.exports = router;
