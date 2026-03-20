/**
 * 市场数据 API
 *
 * GET /api/market/listings/:modelKey  — 查询最近挂牌数据
 * POST /api/market/scrape             — 触发爬取任务
 * GET /api/market/scrape/status       — 查询最近爬取状态
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin, TABLES } = require('../../config/supabase');
const { scrapeAll, scrapeModel, loadLocalListings } = require('../../services/scraper');
const { VEHICLES } = require('../../data/vehicles');

// 进行中的爬取任务 (简单内存跟踪)
let _scrapeJob = null;

// ─── GET /api/market/listings/:modelKey ──────────────────────
router.get('/listings/:modelKey', async (req, res) => {
  const { modelKey } = req.params;
  const limit = parseInt(req.query.limit) || 30;

  if (!VEHICLES[modelKey]) {
    return res.status(400).json({ success: false, error: `Unknown model: ${modelKey}` });
  }

  try {
    let listings = [];

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from(TABLES.LISTINGS)
        .select('*')
        .eq('model_key', modelKey)
        .order('scraped_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      listings = data || [];
    } else {
      // 本地 JSON fallback
      listings = loadLocalListings(modelKey).slice(0, limit);
    }

    // 统计信息
    const prices = listings.map(l => l.price).filter(Boolean);
    const stats = prices.length > 0 ? {
      count:   prices.length,
      min:     Math.min(...prices),
      max:     Math.max(...prices),
      median:  median(prices),
      avg:     Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    } : null;

    res.json({ success: true, modelKey, listings, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/market/scrape — 触发爬取 ──────────────────────
router.post('/scrape', async (req, res) => {
  if (_scrapeJob && _scrapeJob.status === 'running') {
    return res.json({
      success: true,
      message: '爬取任务已在运行中',
      job: _scrapeJob,
    });
  }

  const models = req.body.models || ['alphard', 'vellfire', 'prius'];
  const pages  = parseInt(req.body.pages) || 2;

  _scrapeJob = {
    id:        Date.now(),
    models,
    pages,
    status:    'running',
    startedAt: new Date().toISOString(),
    results:   {},
    error:     null,
  };

  // 异步执行，立即返回
  scrapeAll(models, pages).then(results => {
    _scrapeJob.status    = 'done';
    _scrapeJob.results   = Object.fromEntries(
      Object.entries(results).map(([k, v]) => [k, v.length])
    );
    _scrapeJob.finishedAt = new Date().toISOString();
    console.log('✅ Scrape job done:', _scrapeJob.results);
  }).catch(err => {
    _scrapeJob.status = 'failed';
    _scrapeJob.error  = err.message;
    console.error('❌ Scrape job failed:', err.message);
  });

  res.json({
    success: true,
    message: `爬取任务已启动 (${models.join(', ')}, ${pages} 页/车型)`,
    job: _scrapeJob,
  });
});

// ─── GET /api/market/scrape/status ────────────────────────────
router.get('/scrape/status', (req, res) => {
  res.json({
    success: true,
    job: _scrapeJob || { status: 'idle' },
  });
});

// ─── 工具 ─────────────────────────────────────────────────────
function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

module.exports = router;
