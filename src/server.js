require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');

const apiRoutes = require('./api');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// 静态文件 (前端)
app.use(express.static(path.join(__dirname, '../public')));

// API 路由
app.use('/api', apiRoutes);

// 健康检查
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// SPA fallback — 所有非 API 路径返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`🚗 Car Scout v4 running on port ${PORT}`);
});

module.exports = app;
