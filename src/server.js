/**
 * Agent Car Scout - 主服务器
 *
 * 功能：
 *   1. 提供API接口
 *   2. 管理爬取任务
 *   3. 处理估价请求
 *   4. 提供系统状态监控
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// 路由
import apiRoutes from './api/routes.js';

// 服务
import scraperService from './services/scraper.js';
import valuationService from './services/valuation.js';
import trainingService from './services/training.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// 静态文件
app.use(express.static('public'));

// API路由
app.use('/api', apiRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'agent-car-scout'
  });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: 'Agent Car Scout API',
    version: '3.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      scrape: '/api/scrape',
      valuate: '/api/valuate',
      train: '/api/train'
    }
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Agent Car Scout server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  
  // 启动定时训练任务
  trainingService.startScheduledTraining();
  console.log('⏰ Scheduled training started');
});

export default app;
