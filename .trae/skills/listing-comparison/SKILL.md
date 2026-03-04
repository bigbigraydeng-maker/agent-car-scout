---
name: "listing-comparison"
description: "对比多个汽车列表和选项。当用户需要在多辆车之间做选择、比较不同车型的优缺点时调用此技能。"
---

# 列表对比技能

## 功能概述

这个技能帮助用户对比多个汽车 listing，从多个维度分析差异，辅助用户做出最佳购车决策。

### 核心能力
- 多维度对比车辆参数
- 可视化展示差异
- 智能推荐最佳选择
- 生成对比报告

## 使用场景

### 场景1：两款车型对比
```
用户：帮我对比一下丰田凯美瑞和本田雅阁
→ 调用 listing-comparison 技能
→ 参数：car_ids=[camry_id, accord_id]
```

### 场景2：多车源对比
```
用户：我看中了3辆宝马3系，帮我看看哪辆最值得买
→ 调用 listing-comparison 技能
→ 参数：car_ids=[car1_id, car2_id, car3_id]
```

### 场景3：特定维度对比
```
用户：主要关注价格和油耗，对比这几款车
→ 调用 listing-comparison 技能
→ 参数：car_ids=[...], criteria=['price', 'fuel_consumption']
```

## 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| car_ids | array | 是 | 车辆ID列表，2-5辆 |
| criteria | array | 否 | 对比维度，默认全部 |
| highlight_differences | boolean | 否 | 是否高亮差异，默认true |
| include_recommendation | boolean | 否 | 是否包含推荐，默认true |
| output_format | string | 否 | 输出格式：table, detailed, summary |

## 对比维度

| 维度 | 说明 | 权重 |
|------|------|------|
| price | 价格 | 高 |
| year | 年份/车龄 | 高 |
| mileage | 里程数 | 高 |
| fuel_consumption | 油耗 | 中 |
| features | 配置 | 中 |
| condition | 车况 | 高 |
| depreciation | 保值率 | 中 |
| maintenance_cost | 维护成本 | 中 |
| safety_rating | 安全评级 | 中 |
| space | 空间 | 低 |
| performance | 性能 | 低 |

## 输出格式

```json
{
  "status": "success",
  "comparison": {
    "vehicles": [
      {
        "id": "car_001",
        "title": "2020款 丰田凯美瑞 2.5G",
        "make": "Toyota",
        "model": "Camry",
        "score": 85
      },
      {
        "id": "car_002",
        "title": "2020款 本田雅阁 260TURBO",
        "make": "Honda",
        "model": "Accord",
        "score": 88
      }
    ],
    "comparison_table": {
      "price": {
        "car_001": { "value": 168000, "rating": "good", "diff": "-8000" },
        "car_002": { "value": 176000, "rating": "fair", "diff": "+8000" }
      },
      "year": {
        "car_001": { "value": 2020, "rating": "same", "diff": "0" },
        "car_002": { "value": 2020, "rating": "same", "diff": "0" }
      },
      "mileage": {
        "car_001": { "value": 35000, "rating": "good", "diff": "-5000" },
        "car_002": { "value": 40000, "rating": "fair", "diff": "+5000" }
      },
      "fuel_consumption": {
        "car_001": { "value": "6.0L/100km", "rating": "good", "diff": "-0.5" },
        "car_002": { "value": "6.5L/100km", "rating": "fair", "diff": "+0.5" }
      }
    },
    "pros_cons": {
      "car_001": {
        "pros": ["价格更低", "里程数较少", "油耗更低"],
        "cons": ["配置略低", "保值率稍差"]
      },
      "car_002": {
        "pros": ["动力更强", "空间更大", "保值率更好"],
        "cons": ["价格较高", "里程数较多"]
      }
    },
    "recommendation": {
      "best_choice": "car_002",
      "reason": "综合考虑性价比和长期使用成本，本田雅阁更值得购买",
      "alternative": "car_001",
      "alternative_reason": "如果预算有限，丰田凯美瑞也是不错的选择"
    }
  }
}
```

## 评分标准

总分100分，各维度权重：
- 价格：25%
- 车况（年份+里程）：25%
- 配置：15%
- 经济性（油耗+维护成本）：15%
- 保值率：10%
- 其他：10%

## 使用限制

- 最多同时对比5辆车
- 建议对比同级别的车型
- 跨级别对比时会有提示

## 示例代码

```javascript
// 基础对比
const comparison = await invokeSkill('listing-comparison', {
  car_ids: ['car_001', 'car_002', 'car_003'],
  highlight_differences: true,
  include_recommendation: true
});

// 指定维度对比
const focusedComparison = await invokeSkill('listing-comparison', {
  car_ids: ['car_001', 'car_002'],
  criteria: ['price', 'mileage', 'fuel_consumption'],
  output_format: 'detailed'
});
```

## 输出格式说明

### table 格式
简洁的表格形式，适合快速查看

### detailed 格式
详细的对比报告，包含所有维度的分析

### summary 格式
摘要形式，只显示关键差异和推荐
