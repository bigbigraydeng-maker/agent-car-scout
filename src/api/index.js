const express = require('express');
const router = express.Router();

router.use('/evaluate', require('./routes/evaluate'));
router.use('/pipeline', require('./routes/pipeline'));
router.use('/market',   require('./routes/market'));

router.get('/', (req, res) => {
  res.json({
    service: 'Car Scout API',
    version: '4.0.0',
    endpoints: {
      'POST /api/evaluate':               '拍卖车辆估价',
      'GET  /api/evaluate/vehicles':      '支持的车型与配置',
      'GET  /api/evaluate/history':       '历史评估记录',
      'GET  /api/pipeline':               '车辆跟踪管道',
      'POST /api/pipeline':               '加入管道',
      'PATCH /api/pipeline/:id':          '更新状态',
      'GET  /api/pipeline/summary':       '管道汇总统计',
      'GET  /api/market/listings/:model': '市场挂牌数据',
      'POST /api/market/scrape':          '触发爬取',
      'GET  /api/market/scrape/status':   '爬取任务状态',
    },
  });
});

module.exports = router;
