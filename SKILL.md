---
name: car-scout
description: "Car Scout v4.0 - 倒卖专用二手车扫描机器人。基于随机森林ML模型(12维度特征)实时预测市场价，自动计算最优买入价。扫描 TradeMe + Facebook Marketplace，自动推送高利润车源到飞书。当用户询问车辆评估、合理售价、倒卖利润、扫描市场时使用此技能。"
user-invocable: true
triggers:
  - "开始扫描"
  - "每日扫描"
  - "car scout"
  - "扫描车辆"
  - "查看今日报告"
  - "跑评分"
  - "flip score"
  - "评估车辆"
  - "合理售价"
  - "倒卖利润"
metadata:
  openclaw:
    emoji: "🚗"
---

# 🚗 Car Scout v4.0 - ML驱动的二手车倒卖系统

> **版本**: v4.1 ML Price Prediction + WOF/REGO
> **模型**: 随机森林回归 (50棵树, 89.59%准确率)
> **特征**: 18维 (新增WOF/REGO时间特征)
> **核心理念**: 用机器学习预测市场价，计算最优买入价
> **支持平台**: TradeMe | Facebook Marketplace | CheapCars.nz | Turners
> **最后更新**: 2026-03-04

---

## 🚨 行为规则 (最高优先级)

**绝对禁止发送中间过程消息！** 遵循以下规则：

1. **不要发进度更新** — 禁止发送"正在抓取..."、"数据清洗中..."、"评分中..."等中间消息
2. **安静执行** — 所有脚本执行过程中不要向用户发送任何消息
3. **只发最终结果** — 全部流程完成后，只发送一条包含最终结果的消息
4. **脚本出错不要逐步汇报** — 如果脚本崩溃，不要一条条报告错误，直接用现有数据生成结果
5. **不要回复"收到"、"开始执行"** — 直接做，做完再发结果
6. **一条消息原则** — 用户发一条指令，你最多回复一条消息（最终结果）

---

## 🧠 ML价格预测系统

### 核心模型架构

```
随机森林回归 (Random Forest Regression)
├── 50 棵决策树
├── 3 层价格分层模型
│   ├── low:  $2,000 - $4,500
│   ├── mid:  $4,500 - $6,000
│   └── high: $6,000 - $7,500
└── 89.59% 预测准确率
```

### 18维特征工程

| 类别 | 特征 | 说明 |
|------|------|------|
| **基础** | year, mileage, age | 年份、里程、车龄 |
| **交互** | mileagePerYear | 年均里程 |
| **比率** | yearMileageRatio, ageMileageRatio | 年份/里程比 |
| **对数** | logMileage, logAge | 处理长尾分布 |
| **WOF/REGO** | wofMonthsRemaining, regoMonthsRemaining | 剩余月份 (新增) |
| **WOF/REGO** | hasWof, hasRego | 是否有WOF/REGO (新增) |
| **WOF/REGO** | wofExpiringSoon, regoExpiringSoon | 是否即将到期 (新增) |
| **品牌** | makeToyota, makeHonda, makeMazda... | One-hot编码 |
| **车型** | modelCorolla, modelVitz, modelFit... | One-hot编码 |
| **车身** | isHatchback, isSedan, isSUV | 车身类型 |
| **动力** | isHybrid | 是否混动 |
| **热门** | isPopular | 热门车型标记 |
| **位置** | locationAuckland | 地区标记 |
| **卖家** | isPrivate | 是否个人卖家 |

---

## 💰 买入价计算逻辑

### 核心公式

```javascript
// 1. 预测市场价
predictedPrice = ML模型预测(车辆特征)

// 2. 计算目标净利润 (固定30%)
targetNetProfit = predictedPrice × 0.30

// 3. 计算最高买入价
maxBuyPrice = predictedPrice - prepCost - targetNetProfit

// 4. 计算基础出价
baseBid = priceRange.min × 0.90

// 5. 应用调整因素
adjustedBid = applyDiscounts(baseBid, urgentSignals, daysListed)

// 6. 最终建议出价
suggestedBid = min(adjustedBid, currentPrice×0.95, maxBuyPrice)
suggestedBid = max(suggestedBid, currentPrice×0.70)
```

### 调整因素

| 条件 | 折扣 |
|------|------|
| 急售信号 (ono/urgent/must sell) | -5% |
| 挂牌 > 7天 | -3% |
| 挂牌 > 14天 | -5% |
| 挂牌 > 21天 | -8% |

### 整备成本预估

| 项目 | 成本 |
|------|------|
| WOF/Rego | $100-200 |
| 基础保养 | $150-300 |
| 清洁美容 | $50-100 |
| 意外维修预留 | $200-500 |
| **总计** | **$500-1100** |

---

## 📊 每日市场数据训练

### 数据收集

```bash
# 每日自动执行
node src/daily-scrape.js        # 抓取 TradeMe + FB
node src/collect-sold-data.js   # 收集已售车辆价格
```

### 模型重训练

```bash
# 训练新模型
node src/advanced-price-predictor.js --train

# 保存到
data/advanced_price_predictor.json
```

### 训练数据要求

- **最低样本数**: 每价格层 10 条+
- **数据来源**: 实际成交价格 (TradeMe已售 + FB已售)
- **更新频率**: 每日自动更新
- **数据文件**: `data/nz_cars_*.json`

---

## 🎯 车辆评估流程

### 用户询问单车评估时

1. **提取车辆信息**
   - 年份、车型、里程、位置
   - WOF/Rego状态
   - 卖家类型、急售信号

2. **ML预测市场价**
   ```javascript
   prediction = pricePredictor.predict(vehicle)
   // 返回: predictedPrice, priceRange, confidence
   ```

3. **计算买入建议**
   - 最高买入价
   - 建议出价范围
   - 预期净利润

4. **输出格式**
   ```
   🚗 [年份] [车型]
   
   当前价格: $X,XXX
   预测售价: $X,XXX (置信度XX%)
   
   💰 利润分析:
   - 目标净利润 (30%): $XXX
   - 整备成本: $XXX
   - 最高买入价: $X,XXX
   
   🎯 建议出价: $X,XXX - $X,XXX
   
   [如果价格合适] ✅ 建议入手
   [如果价格过高] ❌ 建议砍价到 $X,XXX 以下
   ```

---

## 📁 关键文件

| 文件 | 用途 |
|------|------|
| `src/advanced-price-predictor.js` | **ML价格预测模型** |
| `src/daily-scrape.js` | 每日数据抓取 |
| `src/collect-sold-data.js` | 收集已售车辆价格 |
| `data/advanced_price_predictor.json` | 训练好的模型 |
| `data/nz_cars_*.json` | 历史成交数据 |

---

## ⚙️ 每日自动任务 (Cron)

### 1. 市场扫描 (每小时)
```
0 * * * * - FB Marketplace 增量扫描
```

### 2. 数据收集 (每日)
```
0 9 * * * - TradeMe 全量扫描
0 22 * * * - 收集已售车辆数据
```

### 3. 模型重训练 (每日)
```
0 23 * * * - 用新数据重训练ML模型
```

---

## 📝 更新日志

### v4.1 (2026-03-04)
- **新增特征**: WOF/REGO 剩余月份 (6维新特征)
  - wofMonthsRemaining, regoMonthsRemaining
  - hasWof, hasRego
  - wofExpiringSoon, regoExpiringSoon
- **扩展数据源**: CheapCars.nz, Turners Auctions, AutoTrader
- **特征维度**: 12维 → 18维

### v4.0 (2026-03-04)
- **ML模型**: 替换旧版Flip Score为随机森林回归
- **价格预测**: 12维特征工程，89.59%准确率
- **自动训练**: 每日根据成交数据重训练模型
- **分层预测**: low/mid/high 三层价格模型

---

*版本: v4.1 ML Price Prediction + WOF/REGO | 更新: 2026-03-04*
