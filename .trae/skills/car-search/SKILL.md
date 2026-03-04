---
name: "car-search"
description: "搜索汽车列表和库存。当用户需要查找特定品牌、型号、价格范围的汽车时调用此技能。支持新车和二手车搜索。"
---

# 汽车搜索技能

## 功能概述

这个技能帮助用户搜索和发现符合需求的汽车，支持多维度筛选和智能推荐。

### 核心能力
- 根据品牌、型号、价格、年份等条件搜索汽车
- 支持新车和二手车搜索
- 整合多个汽车交易平台数据
- 提供智能筛选和排序

## 使用场景

### 场景1：基础搜索
```
用户：我想找一辆丰田凯美瑞，预算15-20万
→ 调用 car-search 技能
→ 参数：make=Toyota, model=Camry, price_min=150000, price_max=200000
```

### 场景2：多条件筛选
```
用户：帮我找2018年后的SUV，自动挡，燃油，预算25万以内
→ 调用 car-search 技能
→ 参数：year_min=2018, body_type=SUV, transmission=automatic, fuel_type=gasoline, price_max=250000
```

### 场景3：地区限定搜索
```
用户：在上海找一辆特斯拉Model 3
→ 调用 car-search 技能
→ 参数：make=Tesla, model=Model 3, location=上海
```

## 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| make | string | 否 | 汽车品牌，如 Toyota, Tesla, BMW |
| model | string | 否 | 汽车型号，如 Camry, Model 3, X5 |
| year_min | integer | 否 | 最小年份 |
| year_max | integer | 否 | 最大年份 |
| price_min | integer | 否 | 最低价格（元） |
| price_max | integer | 否 | 最高价格（元） |
| location | string | 否 | 地区/城市 |
| body_type | string | 否 | 车身类型：sedan, suv, hatchback, coupe 等 |
| fuel_type | string | 否 | 燃油类型：gasoline, diesel, electric, hybrid |
| transmission | string | 否 | 变速箱：automatic, manual, cvt |
| mileage_max | integer | 否 | 最大里程数（公里） |
| sort_by | string | 否 | 排序方式：price_asc, price_desc, year_desc, mileage_asc |
| limit | integer | 否 | 返回结果数量，默认10，最大50 |

## 输出格式

```json
{
  "status": "success",
  "query": {
    "make": "Toyota",
    "model": "Camry",
    "price_max": 200000
  },
  "results": [
    {
      "id": "car_001",
      "title": "2020款 丰田凯美瑞 2.5G 豪华版",
      "make": "Toyota",
      "model": "Camry",
      "year": 2020,
      "price": 168000,
      "mileage": 35000,
      "location": "上海市浦东新区",
      "fuel_type": "gasoline",
      "transmission": "automatic",
      "body_type": "sedan",
      "color": "珍珠白",
      "source": "瓜子二手车",
      "url": "https://example.com/car/001",
      "images": ["https://example.com/img1.jpg"],
      "posted_date": "2026-02-20",
      "seller_type": "dealer"
    }
  ],
  "total_count": 156,
  "search_time_ms": 1200,
  "suggestions": [
    "考虑扩大搜索范围以获得更多选择",
    "同价位的本田雅阁也是不错的选择"
  ]
}
```

## 数据来源

- 瓜子二手车
- 优信二手车
- 汽车之家
- 懂车帝
- 各大4S店官网

## 使用限制

- 单次搜索最多返回50条结果
- 搜索频率限制：每分钟最多20次
- 部分数据源可能需要额外授权

## 错误处理

| 错误码 | 说明 | 处理方式 |
|--------|------|----------|
| 400 | 参数错误 | 检查输入参数格式 |
| 404 | 无搜索结果 | 建议放宽搜索条件 |
| 429 | 请求过于频繁 | 等待后重试 |
| 500 | 服务器错误 | 联系技术支持 |

## 示例代码

```javascript
// 调用示例
const result = await invokeSkill('car-search', {
  make: 'Toyota',
  model: 'Camry',
  year_min: 2019,
  price_max: 200000,
  location: '上海',
  sort_by: 'price_asc',
  limit: 10
});
```
