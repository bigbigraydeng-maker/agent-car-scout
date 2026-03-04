---
name: "price-analysis"
description: "分析汽车价格和估值。当用户需要了解某辆车的价格是否合理、市场价格趋势或获取定价建议时调用此技能。"
---

# 价格分析技能

## 功能概述

这个技能提供专业的汽车价格分析服务，帮助用户判断车辆价格是否合理，并提供市场趋势洞察。

### 核心能力
- 分析单车价格合理性
- 提供市场均价和区间
- 预测价格走势
- 对比同类车型价格
- 给出购买/出售建议

## 使用场景

### 场景1：价格合理性评估
```
用户：这辆2019年的宝马3系卖22万，价格合理吗？
→ 调用 price-analysis 技能
→ 参数：car_id=xxx, 或提供车辆详细信息
```

### 场景2：市场趋势分析
```
用户：特斯拉Model Y最近价格走势如何？
→ 调用 price-analysis 技能
→ 参数：make=Tesla, model=Model Y, analysis_type=trend
```

### 场景3：出售定价建议
```
用户：我想卖我的2020年本田CR-V，应该定价多少？
→ 调用 price-analysis 技能
→ 参数：提供车辆详细信息，获取定价建议
```

## 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| car_id | string | 条件 | 车辆ID（如已在系统中） |
| make | string | 条件 | 品牌（如未提供car_id） |
| model | string | 条件 | 型号（如未提供car_id） |
| year | integer | 条件 | 年份（如未提供car_id） |
| mileage | integer | 否 | 里程数（公里） |
| condition | string | 否 | 车况：excellent, good, fair, poor |
| location | string | 否 | 地区 |
| listed_price | integer | 否 | 当前标价（用于评估） |
| analysis_type | string | 否 | 分析类型：valuation, trend, comparison |
| market_data_days | integer | 否 | 市场数据天数，默认90天 |

## 输出格式

```json
{
  "status": "success",
  "analysis": {
    "vehicle": {
      "make": "BMW",
      "model": "3 Series",
      "year": 2019,
      "mileage": 45000
    },
    "price_assessment": {
      "listed_price": 220000,
      "market_low": 195000,
      "market_average": 210000,
      "market_high": 235000,
      "fair_price_range": [205000, 225000],
      "assessment": "slightly_high",
      "assessment_text": "价格略高，但仍在合理范围内"
    },
    "price_trend": {
      "trend_direction": "decreasing",
      "trend_percentage": -3.5,
      "prediction_30d": -1.2,
      "prediction_90d": -4.8
    },
    "depreciation": {
      "original_price": 320000,
      "current_value": 210000,
      "depreciation_rate": 34.4,
      "annual_depreciation": 11.5
    },
    "comparison": [
      {
        "make": "Mercedes-Benz",
        "model": "C-Class",
        "year": 2019,
        "average_price": 225000,
        "price_difference": 15000
      }
    ],
    "recommendations": [
      "当前价格略高于市场均价，建议议价至21万左右",
      "该车型近期价格呈下降趋势，不急购买可观望",
      "同级别的奔驰C级价格相近，可对比考虑"
    ]
  }
}
```

## 价格评估标准

| 评估结果 | 说明 | 建议 |
|----------|------|------|
| excellent | 价格优秀，明显低于市场价 | 建议立即购买 |
| good | 价格合理，略低于市场价 | 推荐购买 |
| fair | 价格公道，符合市场价 | 可以考虑 |
| slightly_high | 价格略高，但在合理范围内 | 建议议价 |
| high | 价格偏高 | 建议大幅议价或观望 |
| overpriced | 价格过高 | 不建议购买 |

## 价格趋势说明

- **increasing**: 价格上涨，建议尽快购买
- **stable**: 价格稳定，可按需购买
- **decreasing**: 价格下降，不急可观望
- **volatile**: 价格波动大，需谨慎决策

## 使用限制

- 价格数据基于公开市场信息，仅供参考
- 实际交易价格可能因车况、谈判等因素有所不同
- 稀有车型或特殊配置可能数据不足

## 示例代码

```javascript
// 价格评估示例
const analysis = await invokeSkill('price-analysis', {
  make: 'BMW',
  model: '3 Series',
  year: 2019,
  mileage: 45000,
  listed_price: 220000,
  location: '上海',
  analysis_type: 'valuation'
});

// 趋势分析示例
const trend = await invokeSkill('price-analysis', {
  make: 'Tesla',
  model: 'Model Y',
  analysis_type: 'trend',
  market_data_days: 180
});
```
