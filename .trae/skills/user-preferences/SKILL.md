---
name: "user-preferences"
description: "管理用户偏好和个性化推荐。当需要学习用户喜好、提供个性化推荐或管理用户画像时调用此技能。"
---

# 用户偏好管理技能

## 功能概述

这个技能负责学习和管理用户偏好，构建用户画像，提供个性化的汽车推荐服务。

### 核心能力
- 学习用户偏好和习惯
- 构建用户画像
- 个性化推荐
- 搜索历史管理
- 偏好更新和优化

## 使用场景

### 场景1：记录用户偏好
```
用户：我喜欢SUV，预算20万左右，偏好日系车
→ 调用 user-preferences 技能
→ 操作：update_preferences
```

### 场景2：个性化推荐
```
用户：给我推荐几辆车
→ 调用 user-preferences 技能获取用户画像
→ 结合 car-search 提供个性化推荐
```

### 场景3：查看搜索历史
```
用户：我之前看过什么车？
→ 调用 user-preferences 技能
→ 操作：get_search_history
```

### 场景4：偏好调整
```
用户：我预算提高到30万了
→ 调用 user-preferences 技能
→ 操作：update_preferences
```

## 用户画像维度

| 维度 | 说明 | 示例值 |
|------|------|--------|
| budget_range | 预算范围 | [150000, 200000] |
| preferred_brands | 偏好品牌 | ["Toyota", "Honda"] |
| preferred_body_types | 偏好车型 | ["SUV", "sedan"] |
| fuel_preference | 燃油偏好 | "hybrid" |
| usage_scenario | 使用场景 | "daily_commute" |
| purchase_timeline | 购买时间计划 | "within_3_months" |
| must_have_features | 必需配置 | ["sunroof", "360_camera"] |
| deal_breakers | 不可接受的 | ["manual_transmission"] |

## 操作类型

| 操作 | 说明 |
|------|------|
| get_profile | 获取用户画像 |
| update_preferences | 更新偏好设置 |
| get_search_history | 获取搜索历史 |
| clear_history | 清空搜索历史 |
| get_recommendations | 获取个性化推荐 |
| add_favorite | 添加收藏 |
| remove_favorite | 移除收藏 |
| get_favorites | 获取收藏列表 |

## 输入参数

### 获取用户画像
```json
{
  "operation": "get_profile",
  "user_id": "user_001"
}
```

### 更新偏好
```json
{
  "operation": "update_preferences",
  "user_id": "user_001",
  "preferences": {
    "budget_range": [200000, 300000],
    "preferred_brands": ["Tesla", "BYD"],
    "fuel_preference": "electric"
  }
}
```

### 获取搜索历史
```json
{
  "operation": "get_search_history",
  "user_id": "user_001",
  "limit": 10
}
```

### 获取个性化推荐
```json
{
  "operation": "get_recommendations",
  "user_id": "user_001",
  "limit": 5,
  "include_reason": true
}
```

## 输出格式

### 用户画像

```json
{
  "status": "success",
  "operation": "get_profile",
  "user_profile": {
    "user_id": "user_001",
    "created_at": "2025-12-01T10:00:00Z",
    "updated_at": "2026-02-24T08:30:00Z",
    "preferences": {
      "budget_range": {
        "min": 200000,
        "max": 300000,
        "currency": "CNY"
      },
      "preferred_brands": ["Tesla", "BYD", "NIO"],
      "preferred_body_types": ["SUV", "sedan"],
      "fuel_preference": "electric",
      "transmission_preference": "automatic",
      "usage_scenario": "daily_commute",
      "purchase_timeline": "within_3_months",
      "must_have_features": ["autopilot", "heated_seats"],
      "deal_breakers": ["manual_transmission"],
      "preferred_colors": ["white", "black", "silver"],
      "max_mileage": 50000,
      "min_year": 2020
    },
    "behavior_data": {
      "total_searches": 45,
      "total_views": 128,
      "favorite_count": 8,
      "most_viewed_brand": "Tesla",
      "most_viewed_body_type": "SUV",
      "average_price_viewed": 245000
    },
    "tags": ["新能源偏好", "科技爱好者", "SUV倾向"]
  }
}
```

### 个性化推荐

```json
{
  "status": "success",
  "operation": "get_recommendations",
  "recommendations": [
    {
      "rank": 1,
      "car_id": "car_123",
      "title": "2023款 特斯拉 Model Y 长续航版",
      "match_score": 95,
      "match_reasons": [
        "符合预算范围",
        "您多次浏览特斯拉车型",
        "满足您的SUV偏好",
        "配备自动驾驶功能"
      ],
      "price": 263900,
      "image": "https://example.com/model-y.jpg"
    },
    {
      "rank": 2,
      "car_id": "car_456",
      "title": "2023款 比亚迪 汉 EV 创世版",
      "match_score": 88,
      "match_reasons": [
        "符合预算范围",
        "国产新能源热门车型",
        "性价比高"
      ],
      "price": 239800,
      "image": "https://example.com/han-ev.jpg"
    }
  ],
  "recommendation_insights": [
    "基于您的浏览历史，推荐新能源SUV",
    "您的预算范围内有多个优质选择",
    "建议关注近期上市的改款车型"
  ]
}
```

### 搜索历史

```json
{
  "status": "success",
  "operation": "get_search_history",
  "history": [
    {
      "timestamp": "2026-02-24T10:15:00Z",
      "query": {
        "make": "Tesla",
        "model": "Model Y",
        "price_max": 300000
      },
      "results_count": 12,
      "clicked_results": ["car_123", "car_124"]
    },
    {
      "timestamp": "2026-02-23T16:30:00Z",
      "query": {
        "body_type": "SUV",
        "fuel_type": "electric",
        "price_range": [200000, 300000]
      },
      "results_count": 28,
      "clicked_results": ["car_456", "car_789"]
    }
  ],
  "statistics": {
    "total_searches": 45,
    "most_searched_brand": "Tesla",
    "most_searched_price_range": "20-30万",
    "search_frequency": "每周2-3次"
  }
}
```

## 推荐算法

### 匹配评分因素

| 因素 | 权重 | 说明 |
|------|------|------|
| 预算匹配 | 25% | 价格是否在用户预算范围内 |
| 品牌偏好 | 20% | 是否符合用户偏好品牌 |
| 车型偏好 | 15% | 是否符合用户偏好车型 |
| 浏览历史 | 15% | 是否浏览过类似车型 |
| 配置匹配 | 10% | 是否包含用户必需配置 |
| 热门程度 | 10% | 市场热门程度 |
| 性价比 | 5% | 综合性价比评分 |

### 学习机制

- 记录每次搜索和点击行为
- 分析用户停留时间和互动
- 根据收藏和反馈调整推荐
- 定期更新用户画像

## 隐私保护

- 用户数据仅用于改善推荐体验
- 搜索历史保存30天
- 支持随时删除个人数据
- 遵守数据保护法规

## 使用限制

- 搜索历史最多保存50条
- 收藏列表最多100辆车
- 推荐结果基于历史数据，新用户推荐可能不够精准

## 示例代码

```javascript
// 获取用户画像
const profile = await invokeSkill('user-preferences', {
  operation: 'get_profile',
  user_id: 'user_001'
});

// 更新偏好
await invokeSkill('user-preferences', {
  operation: 'update_preferences',
  user_id: 'user_001',
  preferences: {
    budget_range: [250000, 350000],
    preferred_brands: ['Tesla', 'NIO', 'Xiaomi']
  }
});

// 获取个性化推荐
const recommendations = await invokeSkill('user-preferences', {
  operation: 'get_recommendations',
  user_id: 'user_001',
  limit: 5,
  include_reason: true
});

// 添加收藏
await invokeSkill('user-preferences', {
  operation: 'add_favorite',
  user_id: 'user_001',
  car_id: 'car_123'
});
```
