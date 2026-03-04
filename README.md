# Agent Car Scout

[![Node.js](https://img.shields.io/badge/node.js-18.0%2B-green)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/express-4.18%2B-blue)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/supabase-2.39%2B-purple)](https://supabase.io/)
[![Render](https://img.shields.io/badge/render-deployed-orange)](https://render.com/)

Agent Car Scout 是一个多平台车辆数据爬取和市场估价系统，支持从 TradeMe 和 Facebook Marketplace 抓取车辆数据，并基于 KNN 算法进行市场估价。

## 🎯 核心功能

- **多平台数据爬取**：支持 TradeMe 和 Facebook Marketplace
- **市场估价引擎**：基于 KNN 算法的加权中位数估价
- **自动训练系统**：定期更新市场数据和估价模型
- **API 接口**：提供完整的 RESTful API
- **数据可视化**：生成详细的训练报告和统计信息

## 🛠️ 技术栈

- **后端**：Node.js, Express
- **数据库**：Supabase (PostgreSQL)
- **爬取**：Puppeteer, Puppeteer-Extra
- **部署**：Render
- **版本控制**：Git

## 📦 安装

### 前提条件

- Node.js 18.0 或更高版本
- Supabase 项目
- Render 账户（用于部署）

### 本地开发

1. **克隆仓库**
   ```bash
   git clone https://github.com/yourusername/agent-car-scout.git
   cd agent-car-scout
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，填写 Supabase 配置
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

5. **运行爬取**
   ```bash
   npm run scrape
   ```

6. **运行训练**
   ```bash
   npm run train
   ```

## 🚀 部署

### Render 部署

1. **创建 Render 账户**：访问 [Render](https://render.com/) 并创建账户

2. **连接 GitHub 仓库**：在 Render 中连接你的 GitHub 仓库

3. **配置服务**：
   - **Web 服务**：使用 `render.yaml` 配置
   - **环境变量**：设置 Supabase 相关的环境变量

4. **部署**：点击 "Deploy" 按钮开始部署

5. **验证**：部署完成后，访问提供的 URL 验证服务是否正常运行

## 🔗 API 接口

### 健康检查
- `GET /health` - 系统健康状态

### 爬取相关
- `POST /api/scrape/start` - 开始爬取任务
- `GET /api/scrape/status/:jobId` - 获取爬取任务状态
- `GET /api/scrape/history` - 获取爬取历史

### 估价相关
- `POST /api/valuate` - 车辆估价
- `GET /api/valuate/models` - 获取估价模型
- `GET /api/valuate/models/list` - 获取车型列表
- `GET /api/valuate/stats` - 获取估价统计

### 训练相关
- `POST /api/train/start` - 开始训练
- `GET /api/train/reports` - 获取训练报告
- `GET /api/train/reports/latest` - 获取最新训练报告
- `GET /api/train/status` - 获取训练状态

### 系统状态
- `GET /api/status` - 系统状态
- `GET /api/status/info` - 系统信息
- `GET /api/status/resources` - 系统资源使用情况

## 📊 数据模型

### listings 表
- `id` (UUID) - 唯一标识
- `url` (Text) - 车辆链接
- `title` (Text) - 车辆标题
- `model` (Text) - 车型
- `year` (Integer) - 年份
- `km` (Integer) - 公里数
- `price` (Integer) - 价格
- `seller_type` (Text) - 卖家类型
- `location` (Text) - 位置
- `platform` (Text) - 平台
- `scraped_at` (Timestamp) - 抓取时间

### valuation_models 表
- `id` (UUID) - 唯一标识
- `model_name` (Text) - 车型名称
- `year` (Integer) - 年份
- `baseline_price` (Integer) - 基线价格
- `confidence` (Text) - 置信度
- `sample_count` (Integer) - 样本数量
- `platform_counts` (JSONB) - 平台分布
- `updated_at` (Timestamp) - 更新时间

### training_reports 表
- `id` (UUID) - 唯一标识
- `report_id` (Text) - 报告ID
- `data_source` (Text) - 数据源
- `total_listings` (Integer) - 总 listings 数
- `platforms` (Text[]) - 平台列表
- `statistics` (JSONB) - 统计数据
- `platform_distribution` (JSONB) - 平台分布
- `health_status` (Text) - 健康状态
- `generated_at` (Timestamp) - 生成时间

### scraping_jobs 表
- `id` (UUID) - 唯一标识
- `platform` (Text) - 平台
- `status` (Text) - 状态
- `start_time` (Timestamp) - 开始时间
- `end_time` (Timestamp) - 结束时间
- `total_listings` (Integer) - 抓取数量
- `error_message` (Text) - 错误信息

## 📁 项目结构

```
agent-car-scout/
├── src/
│   ├── api/                  # API 接口
│   │   ├── routes/           # 路由
│   │   └── middleware/       # 中间件
│   ├── services/             # 服务
│   │   ├── scraper/          # 数据爬取服务
│   │   ├── valuation/        # 估价服务
│   │   └── training/         # 训练服务
│   ├── models/               # 数据模型
│   ├── utils/                # 工具函数
│   ├── config/               # 配置文件
│   └── server.js             # 主服务器
├── public/                   # 静态文件
├── views/                    # 前端视图
├── .env                      # 环境变量
├── .env.example              # 环境变量示例
├── render.yaml               # Render 配置
├── package.json              # 项目依赖
└── README.md                 # 项目说明
```

## 🔧 配置项

### 环境变量

- `SUPABASE_URL` - Supabase 项目 URL
- `SUPABASE_ANON_KEY` - Supabase 匿名密钥
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase 服务角色密钥
- `PORT` - 服务器端口
- `NODE_ENV` - 运行环境
- `SCRAPE_TIMEOUT` - 爬取超时时间
- `TRAINING_INTERVAL` - 训练间隔时间

### 爬取配置

- 支持的平台：TradeMe, Facebook Marketplace
- 支持的车型：Corolla, RAV4, Vitz, Aqua, Prius, Demio, Swift
- 爬取限制：每个平台每个车型最多 50 条数据

### 估价配置

- 折旧率：3%/万km
- 基线里程：80,000 km
- 年份范围：±2 年
- 里程范围：±40,000 km
- 平台权重：TradeMe=1.0, Facebook=0.8, 其他=0.6

## 📈 系统监控

### 监控指标

- **爬取性能**：爬取成功率、平均爬取时间、数据质量
- **估价准确性**：估价偏差率、置信度分布、模型更新频率
- **系统健康**：服务可用性、内存使用、响应时间
- **错误率**：爬取错误率、数据库错误率、API 错误率

### 日志

- 系统日志：`logs/` 目录
- 训练日志：`data/training_logs/` 目录
- 爬取日志：控制台输出

## 🔒 安全考虑

- **API 密钥管理**：使用环境变量存储密钥
- **数据库安全**：使用 Row Level Security
- **爬取合规性**：遵守网站 robots.txt，实现合理的爬取速率
- **依赖安全**：定期更新依赖，扫描安全漏洞

## 🤝 贡献

1. **Fork 仓库**
2. **创建功能分支** (`git checkout -b feature/amazing-feature`)
3. **提交更改** (`git commit -m 'feat: Add amazing feature'`)
4. **推送到分支** (`git push origin feature/amazing-feature`)
5. **创建 Pull Request**

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 📞 联系方式

- **项目维护者**：Agent Car Scout Team
- **Email**：contact@agentcarscout.com
- **GitHub**：https://github.com/agent-car-scout

---

**版本**：3.0.0
**最后更新**：2026-03-04