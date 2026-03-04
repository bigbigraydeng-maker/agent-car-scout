---
name: "market-research"
description: "汽车市场研究和趋势分析。当用户需要了解汽车市场动态、热门车型、行业趋势或购车时机建议时调用此技能。"
---

# 市场研究技能

## 功能概述

这个技能提供全面的汽车市场研究和分析服务，帮助用户了解市场趋势、热门车型和行业动态。

### 核心能力
- 市场热门车型排行
- 价格趋势分析
- 品牌销量分析
- 新能源汽车市场研究
- 购车时机建议

## 使用场景

### 场景1：热门车型查询
```
用户：最近什么车卖得最好？
→ 调用 market-research 技能
→ 参数：research_type=popular_models
```

### 场景2：品牌市场表现
```
用户：比亚迪和特斯拉哪个市场表现更好？
→ 调用 market-research 技能
→ 参数：research_type=brand_comparison, brands=["BYD", "Tesla"]
```

### 场景3：购车时机建议
```
用户：现在买车合适吗？还是再等等？
→ 调用 market-research 技能
→ 参数：research_type=buying_timing
```

### 场景4：细分市场研究
```
用户：20万左右的SUV市场怎么样？
→ 调用 market-research 技能
→ 参数：research_type=segment_analysis, price_range=[150000, 250000], body_type=SUV
```

## 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| research_type | string | 是 | 研究类型 |
| time_period | string | 否 | 时间范围：1m, 3m, 6m, 1y, default=3m |
| location | string | 否 | 地区，默认全国 |
| price_range | array | 否 | 价格区间 [min, max] |
| body_type | string | 否 | 车身类型 |
| fuel_type | string | 否 | 燃油类型 |
| brands | array | 否 | 品牌列表 |
| limit | integer | 否 | 结果数量，默认10 |

## 研究类型

| 类型 | 说明 |
|------|------|
| popular_models | 热门车型排行 |
| brand_comparison | 品牌对比分析 |
| segment_analysis | 细分市场分析 |
| price_trend | 价格趋势研究 |
| buying_timing | 购车时机建议 |
| new_energy | 新能源汽车市场 |
| used_car_market | 二手车市场研究 |
| regional_analysis | 地区市场分析 |

## 输出格式

### 热门车型排行

```json
{
  "status": "success",
  "research_type": "popular_models",
  "time_period": "2026-01-01 to 2026-02-24",
  "results": {
    "top_models": [
      {
        "rank": 1,
        "make": "BYD",
        "model": "Song Plus DM-i",
        "segment": "紧凑型SUV",
        "sales_volume": 28500,
        "yoy_growth": 45.2,
        "average_price": 165000,
        "market_share": 3.8
      },
      {
        "rank": 2,
        "make": "Tesla",
        "model": "Model Y",
        "segment": "中型SUV",
        "sales_volume": 24200,
        "yoy_growth": 28.6,
        "average_price": 263000,
        "market_share": 3.2
      }
    ],
    "segment_distribution": {
      "sedan": 42.5,
      "suv": 48.3,
      "mpv": 6.2,
      "other": 3.0
    },
    "insights": [
      "新能源汽车销量占比持续提升，达到38.5%",
      "SUV市场热度持续，紧凑型SUV最受欢迎",
      "自主品牌市场份额首次突破60%"
    ]
  }
}
```

### 购车时机建议

```json
{
  "status": "success",
  "research_type": "buying_timing",
  "analysis": {
    "current_market": {
      "price_trend": "decreasing",
      "trend_strength": "moderate",
      "inventory_level": "high",
      "discount_rate": "increasing"
    },
    "timing_assessment": {
      "score": 85,
      "rating": "good",
      "recommendation": "推荐购买",
      "confidence": "high"
    },
    "reasons": [
      "当前处于传统销售淡季，议价空间较大",
      "新能源汽车补贴退坡前是购买好时机",
      "经销商库存压力较大，优惠力度增加"
    ],
    "seasonal_factors": {
      "current_month": "2月",
      "seasonal_discount": "春节后促销季",
      "typical_pattern": "春节后1-2个月价格相对较低"
    },
    "future_outlook": {
      "next_quarter": "预计价格将继续小幅下降",
      "next_half_year": "下半年新款上市，老款价格可能进一步下降",
      "risks": ["原材料价格上涨可能传导至车价", "新能源补贴完全退坡"]
    },
    "recommendations": [
      "建议现在购买，议价空间较大",
      "关注3月底季度末促销",
      "不急用车可等待6-7月淡季"
    ]
  }
}
```

## 市场指标说明

| 指标 | 说明 |
|------|------|
| sales_volume | 销量 |
| yoy_growth | 同比增长率 |
| mom_growth | 环比增长率 |
| market_share | 市场份额 |
| inventory_index | 库存系数 |
| discount_rate | 优惠幅度 |
| price_index | 价格指数 |

## 使用限制

- 市场数据有1-2周延迟
- 地区数据可能不够精细
- 部分小众车型数据可能不完整

## 示例代码

```javascript
// 热门车型查询
const popularModels = await invokeSkill('market-research', {
  research_type: 'popular_models',
  time_period: '3m',
  limit: 10
});

// 细分市场分析
const segmentAnalysis = await invokeSkill('market-research', {
  research_type: 'segment_analysis',
  price_range: [150000, 250000],
  body_type: 'SUV',
  fuel_type: 'hybrid'
});

// 购车时机建议
const timingAdvice = await invokeSkill('market-research', {
  research_type: 'buying_timing',
  location: '上海'
});
```

## 数据来源

- 中国汽车工业协会
- 乘联会
- 各大汽车厂商销量数据
- 二手车交易平台数据
- 汽车垂直媒体数据
