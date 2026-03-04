/**
 * API 路由配置
 */

const express = require('express');
const router = express.Router();

// 导入路由
const scrapeRoutes = require('./scrape');
const valuationRoutes = require('./valuation');
const trainingRoutes = require('./training');
const statusRoutes = require('./status');

// 注册路由
router.use('/scrape', scrapeRoutes);
router.use('/valuate', valuationRoutes);
router.use('/train', trainingRoutes);
router.use('/status', statusRoutes);

// 测试路由
router.get('/', (req, res) => {
  res.json({
    message: 'Agent Car Scout API',
    version: '3.0.0',
    endpoints: {
      scrape: '/api/scrape',
      valuate: '/api/valuate',
      train: '/api/train',
      status: '/api/status'
    }
  });
});

module.exports = router;
