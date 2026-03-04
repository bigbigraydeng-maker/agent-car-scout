/**
 * 系统状态相关API路由
 */

const express = require('express');
const router = express.Router();

// 系统状态
router.get('/', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    timestamp: new Date().toISOString(),
    service: 'agent-car-scout',
    version: '3.0.0'
  });
});

// 系统信息
router.get('/info', (req, res) => {
  res.json({
    success: true,
    info: {
      name: 'Agent Car Scout',
      version: '3.0.0',
      description: '多平台车辆数据爬取和市场估价系统',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      uptime: process.uptime()
    }
  });
});

// 系统资源使用情况
router.get('/resources', (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    success: true,
    resources: {
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      cpu: {
        usage: process.cpuUsage()
      }
    }
  });
});

module.exports = router;