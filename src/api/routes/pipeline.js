/**
 * 车辆跟踪管道 API
 *
 * 状态流转:
 *   evaluating → bidding → won → shipping → arrived → compliance → for_sale → sold
 *                       ↘ passed (放弃)
 *
 * 每台车的完整生命周期都在这里跟踪，包括:
 *   - 评估时的预测价格
 *   - 实际拍卖成交价
 *   - 付款节点 (定金 / 尾款)
 *   - 到达日期
 *   - 最终售价
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../config/supabase');
const { VEHICLES } = require('../../data/vehicles');

const TABLE = 'pipeline';

const VALID_STATUSES = [
  'evaluating',   // 正在评估
  'bidding',      // 已决定竞拍，等待拍卖日
  'won',          // 拍到了，已支付定金
  'shipping',     // 在船上
  'arrived',      // 已到NZ港口
  'compliance',   // 正在做合规
  'for_sale',     // 在 TradeMe 上挂牌
  'sold',         // 已售出
  'passed',       // 放弃竞拍
];

// ─── 内存存储 (无 Supabase 时的 fallback) ────────────────────
let _memoryPipeline = [];
let _nextId = 1;

function memGet()          { return [..._memoryPipeline]; }
function memAdd(item)      { item.id = String(_nextId++); _memoryPipeline.push(item); return item; }
function memUpdate(id, patch) {
  const idx = _memoryPipeline.findIndex(i => i.id === id);
  if (idx === -1) return null;
  _memoryPipeline[idx] = { ..._memoryPipeline[idx], ...patch, updated_at: new Date().toISOString() };
  return _memoryPipeline[idx];
}
function memDelete(id) {
  const before = _memoryPipeline.length;
  _memoryPipeline = _memoryPipeline.filter(i => i.id !== id);
  return _memoryPipeline.length < before;
}

// ─── GET /api/pipeline ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.json({ success: true, pipeline: memGet() });
    }
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, pipeline: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/pipeline — 新增 ────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      modelKey, grade, modelCode, year, km, condition,
      auctionPriceJpy, auctionPriceNzd,
      estimatedNzPrice, totalLandedCost, netProfit, recommendation,
      evaluationId, notes,
    } = req.body;

    if (!modelKey || !year) {
      return res.status(400).json({ success: false, error: '缺少 modelKey, year' });
    }

    const now = new Date().toISOString();
    const item = {
      model_key:          modelKey,
      model:              VEHICLES[modelKey]?.model || modelKey,
      grade:              grade || null,
      model_code:         modelCode || null,
      year:               parseInt(year),
      km:                 parseInt(km) || null,
      condition_score:    condition || '4',
      auction_price_jpy:  parseInt(auctionPriceJpy) || null,
      auction_price_nzd:  parseInt(auctionPriceNzd) || null,
      estimated_nz_price: parseInt(estimatedNzPrice) || null,
      total_landed_cost:  parseInt(totalLandedCost) || null,
      net_profit:         parseInt(netProfit) || null,
      recommendation:     recommendation || null,
      evaluation_id:      evaluationId || null,
      status:             'evaluating',
      notes:              notes || null,
      deposit_paid:       false,
      balance_paid:       false,
      created_at:         now,
      updated_at:         now,
    };

    if (!supabaseAdmin) {
      const saved = memAdd(item);
      return res.json({ success: true, item: saved });
    }

    const { data, error } = await supabaseAdmin.from(TABLE).insert(item).select().single();
    if (error) throw error;
    res.json({ success: true, item: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /api/pipeline/:id — 更新状态/字段 ─────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const patch = { ...req.body, updated_at: new Date().toISOString() };

    // 校验状态
    if (patch.status && !VALID_STATUSES.includes(patch.status)) {
      return res.status(400).json({
        success: false,
        error: `无效状态: ${patch.status}。有效值: ${VALID_STATUSES.join(', ')}`,
      });
    }

    if (!supabaseAdmin) {
      const updated = memUpdate(id, patch);
      if (!updated) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, item: updated });
    }

    const { data, error } = await supabaseAdmin.from(TABLE).update(patch).eq('id', id).select().single();
    if (error) throw error;
    res.json({ success: true, item: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/pipeline/:id ─────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabaseAdmin) {
      const deleted = memDelete(id);
      if (!deleted) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true });
    }

    const { error } = await supabaseAdmin.from(TABLE).delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/pipeline/summary — 汇总统计 ────────────────────
router.get('/summary', async (req, res) => {
  try {
    let items;
    if (!supabaseAdmin) {
      items = memGet();
    } else {
      const { data, error } = await supabaseAdmin.from(TABLE).select('*');
      if (error) throw error;
      items = data || [];
    }

    const byStatus = {};
    VALID_STATUSES.forEach(s => { byStatus[s] = []; });
    items.forEach(i => { (byStatus[i.status] || (byStatus.evaluating)).push(i); });

    const totalInvested = items
      .filter(i => ['won', 'shipping', 'arrived', 'compliance', 'for_sale', 'sold'].includes(i.status))
      .reduce((s, i) => s + (i.total_landed_cost || 0), 0);

    const totalRealised = items
      .filter(i => i.status === 'sold')
      .reduce((s, i) => s + (i.actual_sale_price || 0), 0);

    res.json({
      success: true,
      summary: {
        totalCars:      items.length,
        byStatus:       Object.fromEntries(Object.entries(byStatus).map(([k, v]) => [k, v.length])),
        totalInvested,
        totalRealised,
        totalProfit:    totalRealised - items.filter(i => i.status === 'sold').reduce((s, i) => s + (i.total_landed_cost || 0), 0),
      },
      byStatus,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
