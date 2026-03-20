# Agent Car Scout 技术迁移指南

## 🎯 迁移目标

将 Agent Car Scout 系统从本地环境迁移到云平台，实现：

- **24/7 运行**：基于 Render 云服务实现全天候运行
- **数据持久化**：使用 Supabase 数据库存储和管理数据
- **版本控制**：通过 Git 实现代码管理和协作
- **自动化部署**：配置 CI/CD 流程实现自动部署
- **系统稳定性**：修复现有 bug，提高系统可靠性

## 🔍 系统现状分析

### 当前系统架构

```
├── src/
│   ├── multi-platform-scraper.js     # 多平台数据爬取
│   ├── market-valuation.js           # 市场估价引擎
│   ├── auto-train.js                 # 自动训练脚本
│   └── other scripts...
├── data/
│   ├── market_valuation_*.json       # 市场数据文件
│   ├── reports/                      # 训练报告
│   └── training_logs/                # 训练日志
├── package.json                      # 项目依赖
└── run-auto-train.bat               # 执行脚本
```

### 主要功能

1. **多平台数据爬取**：从 TradeMe 和 Facebook Marketplace 抓取车辆数据
2. **市场估价**：基于 KNN 算法的加权中位数估价
3. **自动训练**：定期更新市场数据和模型
4. **报告生成**：生成训练报告和数据统计

### 存在的问题

1. **数据存储问题**：使用本地 JSON 文件存储，可靠性差
2. **部署问题**：依赖本地 Windows 环境，无法 24/7 运行
3. **版本控制缺失**：没有使用 Git 进行代码管理
4. **系统稳定性**：存在多个 bug 和性能问题
5. **扩展性差**：难以添加新功能和平台

## 📁 Git 仓库设计

### 仓库结构

```
agent-car-scout/
├── .github/                        # GitHub 配置
│   └── workflows/                  # CI/CD 工作流
│       └── render-deploy.yml       # Render 部署配置
├── src/                            # 源代码
│   ├── api/                        # API 接口
│   │   ├── routes/                 # 路由
│   │   └── middleware/             # 中间件
│   ├── services/                   # 服务
│   │   ├── scraper/                # 数据爬取服务
│   │   ├── valuation/              # 估价服务
│   │   └── training/               # 训练服务
│   ├── models/                     # 数据模型
│   ├── utils/                      # 工具函数
│   └── config/                     # 配置文件
├── public/                         # 静态文件
├── views/                          # 前端视图
├── package.json                    # 项目依赖
├── package-lock.json               # 依赖锁定
├── .gitignore                      # Git 忽略文件
├── README.md                       # 项目说明
└── render.yaml                     # Render 配置
```

### 分支策略

- **main**：主分支，生产环境使用
- **develop**：开发分支，集成测试
- **feature/**：功能分支，开发新功能
- **bugfix/**：修复分支，修复 bug

### 版本控制规范

1. **提交信息**：使用语义化提交信息
   - `feat: 添加新功能`
   - `fix: 修复 bug`
   - `docs: 文档更新`
   - `refactor: 代码重构`
   - `chore: 构建/依赖更新`

2. **标签管理**：使用语义化版本号
   - `v1.0.0`：主版本
   - `v1.1.0`：次版本
   - `v1.1.1`：补丁版本

## 🗄️ Supabase 数据库设计

### 数据库架构

#### 1. `listings` 表 - 车辆 listings 数据

| 字段名 | 数据类型 | 约束 | 描述 |
|--------|---------|------|------|
| `id` | `uuid` | `primary key` | 唯一标识 |
| `url` | `text` | `unique not null` | 车辆链接 |
| `title` | `text` | `not null` | 车辆标题 |
| `model` | `text` | `not null` | 车型 |
| `year` | `integer` | `not null` | 年份 |
| `km` | `integer` | `not null` | 公里数 |
| `price` | `integer` | `not null` | 价格 |
| `seller_type` | `text` | `not null` | 卖家类型 |
| `location` | `text` | `not null` | 位置 |
| `platform` | `text` | `not null` | 平台 |
| `scraped_at` | `timestamp with time zone` | `not null` | 抓取时间 |
| `created_at` | `timestamp with time zone` | `default now()` | 创建时间 |

#### 2. `valuation_models` 表 - 估价模型数据

| 字段名 | 数据类型 | 约束 | 描述 |
|--------|---------|------|------|
| `id` | `uuid` | `primary key` | 唯一标识 |
| `model_name` | `text` | `not null` | 车型名称 |
| `year` | `integer` | `not null` | 年份 |
| `baseline_price` | `integer` | `not null` | 基线价格 |
| `confidence` | `text` | `not null` | 置信度 |
| `sample_count` | `integer` | `not null` | 样本数量 |
| `platform_counts` | `jsonb` | `not null` | 平台分布 |
| `updated_at` | `timestamp with time zone` | `default now()` | 更新时间 |

#### 3. `training_reports` 表 - 训练报告

| 字段名 | 数据类型 | 约束 | 描述 |
|--------|---------|------|------|
| `id` | `uuid` | `primary key` | 唯一标识 |
| `report_id` | `text` | `unique not null` | 报告ID |
| `data_source` | `text` | `not null` | 数据源 |
| `total_listings` | `integer` | `not null` | 总 listings 数 |
| `platforms` | `text[]` | `not null` | 平台列表 |
| `statistics` | `jsonb` | `not null` | 统计数据 |
| `platform_distribution` | `jsonb` | `not null` | 平台分布 |
| `health_status` | `text` | `not null` | 健康状态 |
| `generated_at` | `timestamp with time zone` | `default now()` | 生成时间 |

#### 4. `scraping_jobs` 表 - 爬取任务

| 字段名 | 数据类型 | 约束 | 描述 |
|--------|---------|------|------|
| `id` | `uuid` | `primary key` | 唯一标识 |
| `platform` | `text` | `not null` | 平台 |
| `status` | `text` | `not null` | 状态 |
| `start_time` | `timestamp with time zone` | `not null` | 开始时间 |
| `end_time` | `timestamp with time zone` | | 结束时间 |
| `total_listings` | `integer` | | 抓取数量 |
| `error_message` | `text` | | 错误信息 |

### 索引设计

1. **listings 表索引**
   - `idx_listings_model_year`：(model, year) - 加速车型年份查询
   - `idx_listings_platform`：(platform) - 加速平台筛选
   - `idx_listings_scraped_at`：(scraped_at) - 加速时间范围查询

2. **valuation_models 表索引**
   - `idx_valuation_model_year`：(model_name, year) - 加速模型查询

3. **scraping_jobs 表索引**
   - `idx_scraping_jobs_status`：(status) - 加速状态查询
   - `idx_scraping_jobs_start_time`：(start_time) - 加速时间查询

### 数据迁移策略

1. **历史数据迁移**：
   - 从现有 JSON 文件导入历史 listings 数据
   - 导入现有估价模型数据
   - 导入历史训练报告

2. **增量同步**：
   - 新数据直接写入 Supabase
   - 定期清理过期数据

## 🚀 Render 部署方案

### 服务配置

#### 1. Web 服务

- **类型**：Node.js
- **构建命令**：`npm install && npm run build`
- **启动命令**：`npm start`
- **环境变量**：
  - `SUPABASE_URL`：Supabase 项目 URL
  - `SUPABASE_ANON_KEY`：Supabase 匿名密钥
  - `SUPABASE_SERVICE_ROLE_KEY`：Supabase 服务角色密钥
  - `NODE_ENV`：`production`
  - `PUPPETEER_EXECUTABLE_PATH`：Puppeteer 执行路径

#### 2. 定时任务服务

- **类型**：Background Worker
- **构建命令**：`npm install`
- **启动命令**：`node src/services/training/scheduler.js`
- **环境变量**：与 Web 服务相同

### CI/CD 配置

#### GitHub Actions 工作流

```yaml
# .github/workflows/render-deploy.yml
name: Deploy to Render

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        run: npm test
      
      - name: Deploy to Render
        run: |
          curl -X POST "https://api.render.com/v1/services/${{ secrets.RENDER_SERVICE_ID }}/deploys" \
          -H "Accept: application/json" \
          -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}"
```

### 部署环境

- **区域**：选择离目标市场最近的区域（如亚太地区）
- **实例类型**：
  - Web 服务：至少 512MB RAM
  - 定时任务：至少 1GB RAM（用于 Puppeteer 爬取）
- **磁盘空间**：至少 1GB（用于存储临时文件和缓存）

## 🔧 系统优化和 Bug 修复

### 主要 Bug 修复

1. **数据爬取问题**
   - 修复 Puppeteer 启动失败问题
   - 优化页面加载等待时间
   - 添加错误处理和重试机制

2. **数据处理问题**
   - 修复车型识别逻辑
   - 优化数据清洗和标准化
   - 改进去重算法

3. **估价引擎问题**
   - 修复多平台数据权重计算
   - 优化 KNN 算法性能
   - 改进置信度计算

4. **系统稳定性**
   - 添加异常捕获和日志记录
   - 实现优雅的错误处理
   - 优化内存使用

### 性能优化

1. **爬取优化**
   - 实现并发爬取
   - 使用无头浏览器减少资源消耗
   - 优化选择器提高抓取速度

2. **数据库优化**
   - 使用索引加速查询
   - 实现数据分页
   - 优化数据库连接池

3. **缓存策略**
   - 实现 Redis 缓存（可选）
   - 缓存热门车型的估价结果
   - 缓存爬取的页面数据

## 📋 迁移步骤

### 阶段 1：准备工作

1. **创建 Git 仓库**
   - 在 GitHub/GitLab 上创建新仓库
   - 初始化仓库并设置分支策略
   - 配置 .gitignore 文件

2. **设置 Supabase 项目**
   - 创建 Supabase 项目
   - 配置数据库表结构
   - 创建服务角色密钥

3. **配置 Render 服务**
   - 创建 Web 服务
   - 创建 Background Worker 服务
   - 配置环境变量

### 阶段 2：代码迁移

1. **重构代码结构**
   - 按照新的目录结构重组织代码
   - 实现模块化和分层架构
   - 添加错误处理和日志记录

2. **集成 Supabase**
   - 安装 @supabase/supabase-js
   - 实现数据库连接和操作
   - 迁移数据模型

3. **优化爬取服务**
   - 改进 Puppeteer 配置
   - 实现并发爬取
   - 添加代理支持（可选）

### 阶段 3：部署和测试

1. **部署到 Render**
   - 配置 CI/CD 流程
   - 部署初始版本
   - 验证服务运行状态

2. **数据迁移**
   - 导入历史数据
   - 验证数据完整性
   - 测试查询性能

3. **功能测试**
   - 测试多平台爬取
   - 测试市场估价
   - 测试自动训练
   - 测试报告生成

### 阶段 4：监控和维护

1. **监控设置**
   - 配置 Render 监控
   - 设置错误报警
   - 实现日志聚合

2. **维护计划**
   - 定期备份数据库
   - 监控爬取任务状态
   - 定期更新依赖

3. **性能优化**
   - 分析系统性能
   - 优化数据库查询
   - 调整爬取策略

## 📈 系统监控

### 监控指标

1. **爬取性能**
   - 爬取成功率
   - 平均爬取时间
   - 数据质量

2. **估价准确性**
   - 估价偏差率
   - 置信度分布
   - 模型更新频率

3. **系统健康**
   - 服务可用性
   - 内存使用
   - 响应时间

4. **错误率**
   - 爬取错误率
   - 数据库错误率
   - API 错误率

### 监控工具

- **Render 监控**：服务状态和性能
- **Supabase 监控**：数据库性能和使用情况
- **自定义日志**：详细的系统行为记录

## 🔒 安全考虑

### 数据安全

1. **API 密钥管理**
   - 使用环境变量存储密钥
   - 定期轮换密钥
   - 限制 API 访问权限

2. **数据库安全**
   - 使用 Row Level Security
   - 限制数据库用户权限
   - 加密敏感数据

3. **爬取合规性**
   - 遵守网站 robots.txt
   - 实现合理的爬取速率
   - 尊重网站使用条款

### 系统安全

1. **依赖安全**
   - 定期更新依赖
   - 扫描安全漏洞
   - 使用锁定的依赖版本

2. **网络安全**
   - 使用 HTTPS
   - 实现 CORS 策略
   - 防止 DDoS 攻击

3. **代码安全**
   - 防止 SQL 注入
   - 防止 XSS 攻击
   - 安全的密码存储

## 📊 预期成果

### 系统指标

| 指标 | 目标 | 现状 | 改进 |
|------|------|------|------|
| 服务可用性 | 99.9% | 不稳定 | ✅ 显著提升 |
| 爬取成功率 | >95% | <80% | ✅ 大幅提升 |
| 数据更新频率 | 每天 | 手动 | ✅ 自动化 |
| 估价准确性 | >90% | <70% | ✅ 显著提升 |
| 系统响应时间 | <5s | >10s | ✅ 大幅提升 |

### 业务价值

1. **24/7 运行**：全天候监控市场动态
2. **数据准确性**：多平台数据融合提高估价准确性
3. **自动化**：减少人工干预，提高效率
4. **可扩展性**：易于添加新平台和功能
5. **可靠性**：云服务提供更高的稳定性

## 🎯 成功标准

1. **系统稳定运行**：服务可用性达到 99.9%
2. **数据质量**：爬取成功率 >95%，数据准确性 >90%
3. **功能完整**：所有核心功能正常运行
4. **性能达标**：响应时间 <5s，资源使用合理
5. **可维护性**：代码结构清晰，文档完整

## 📋 后续计划

1. **功能扩展**
   - 添加更多数据源
   - 实现实时价格监控
   - 开发用户界面

2. **性能优化**
   - 实现分布式爬取
   - 优化数据库查询
   - 引入机器学习模型

3. **业务扩展**
   - 支持更多车型和品牌
   - 提供 API 服务
   - 开发移动应用

## 🤝 协作建议

1. **代码审查**：建立代码审查流程
2. **文档维护**：定期更新技术文档
3. **知识共享**：建立团队知识库
4. **持续改进**：定期回顾和优化系统

---

**文档版本**：v1.0.0
**最后更新**：2026-03-04
**作者**：Agent Car Scout Team