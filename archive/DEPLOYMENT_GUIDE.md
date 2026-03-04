# Car Scout 完整部署指南

## 📋 问题

当前工作目录：`C:\Users\Zhong\Documents\trae_projects\Agent Car Scout`

核心代码目录：`C:\Users\Zhong\.openclaw\workspace\skills\car-scout`

**限制**：无法直接编辑 `.openclaw` 目录

---

## ✅ 解决方案：完整搬迁到当前工作目录

### 步骤1：创建完整目录结构

```
Agent Car Scout/
├── src/                    # 核心源代码
│   ├── scoring-v3.js      # 评分系统（已修改利润率为10%）
│   ├── vehicle-status-check.js  # 车辆状态检测
│   ├── advanced-price-predictor.js  # 价格预测
│   ├── market-valuation.js  # 市场估值
│   ├── report.js          # 报告生成
│   ├── fb-delta-scan.js  # FB扫描
│   ├── trademe-daily-scan.js  # TradeMe扫描
│   └── send-feishu.js    # 飞书发送
├── data/                   # 数据文件
│   ├── vehicles_trademe_20260301.json
│   ├── fb_search_all.json
│   ├── advanced_price_predictor.json
│   ├── blacklist_vehicles.json
│   └── sold_vehicles.json
├── package.json            # 依赖配置
└── 主脚本...              # 运行脚本
```

---

### 步骤2：需要复制的文件列表

| 源文件 | 目标位置 | 说明 |
|--------|---------|------|
| `.openclaw/workspace/skills/car-scout/src/scoring-v3.js` | `src/scoring-v3.js` | 评分系统（已修改利润率） |
| `.openclaw/workspace/skills/car-scout/src/advanced-price-predictor.js` | `src/advanced-price-predictor.js` | 价格预测 |
| `.openclaw/workspace/skills/car-scout/src/market-valuation.js` | `src/market-valuation.js` | 市场估值 |
| `.openclaw/workspace/skills/car-scout/src/report.js` | `src/report.js` | 报告生成 |
| `.openclaw/workspace/skills/car-scout/src/fb-delta-scan.js` | `src/fb-delta-scan.js` | FB扫描 |
| `.openclaw/workspace/skills/car-scout/src/trademe-daily-scan.js` | `src/trademe-daily-scan.js` | TradeMe扫描 |
| `.openclaw/workspace/skills/car-scout/src/send-feishu.js` | `src/send-feishu.js` | 飞书发送 |
| `.openclaw/workspace/skills/car-scout/data/advanced_price_predictor.json` | `data/advanced_price_predictor.json` | 预测模型 |
| `.openclaw/workspace/skills/car-scout/data/vehicles_trademe_20260301.json` | `data/vehicles_trademe_20260301.json` | TradeMe数据 |
| `.openclaw/workspace/skills/car-scout/data/fb_search_all.json` | `data/fb_search_all.json` | FB数据 |
| `.openclaw/workspace/skills/car-scout/package.json` | `package.json` | 依赖配置 |

---

### 步骤3：创建主运行脚本

在当前目录创建 `run-car-scout.js` 作为入口点。

---

## 🎯 快速方案：手动复制关键文件

由于目标利润率已经修改完成，可以先只复制几个关键文件进行测试。

### 推荐方案A：手动复制（快速）

1. 从 `.openclaw` 复制以下文件到当前目录 `src/` 文件夹：
   - `scoring-v3.js`（已包含10%利润率）
   - `advanced-price-predictor.js`
   - `report.js`
   - `market-valuation.js`

2. 从 `.openclaw` 复制以下文件到当前目录 `data/` 文件夹：
   - `advanced_price_predictor.json`
   - `vehicles_trademe_20260301.json`

3. 运行测试脚本验证

### 推荐方案B：完整搬迁（推荐）

使用文件管理器或命令行把整个 `.openclaw/workspace/skills/car-scout` 文件夹复制到当前工作目录。

---

## 💡 其他方案

| 方案 | 说明 |
|------|------|
| Git仓库 | 把代码推送到GitHub/GitLab，两边都可以pull |
| 符号链接 | 创建符号链接指向 `.openclaw` 目录（需要管理员权限） |
| 网络共享 | 通过网络共享访问 |

---

## 📝 当前状态

✅ `scoring-v3.js` 的利润率已经修改为 10%
✅ 车辆状态检测模块已创建
✅ 黑名单已初始化
✅ 改进方案文档已完成

需要把核心文件搬到当前工作目录才能继续编辑和运行！
