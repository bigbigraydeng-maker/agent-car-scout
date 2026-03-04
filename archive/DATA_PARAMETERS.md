# 新西兰二手车数据抓取参数清单

## 一、核心车辆参数（必需）

### 1. 基础信息
| 参数名 | 类型 | 说明 | 示例 | 优先级 |
|--------|------|------|------|--------|
| id | string | 车辆唯一标识 | "tm_5810649639" | P0 |
| make | string | 品牌 | "Toyota" | P0 |
| model | string | 型号 | "Corolla" | P0 |
| year | number | 年份 | 2015 | P0 |
| price | number | 当前价格 (NZD) | 13000 | P0 |
| mileage | number | 里程 (km) | 127500 | P0 |

### 2. 位置信息
| 参数名 | 类型 | 说明 | 示例 | 优先级 |
|--------|------|------|------|--------|
| location | string | 城市/地区 | "Auckland" | P0 |
| region | string | 大区 | "Auckland" | P1 |
| suburb | string | 郊区 | "North Shore" | P2 |

### 3. 车辆详情
| 参数名 | 类型 | 说明 | 示例 | 优先级 |
|--------|------|------|------|--------|
| bodyType | string | 车身类型 | "Hatchback" | P1 |
| engineSize | number | 排量 (cc) | 1800 | P1 |
| fuelType | string | 燃料类型 | "Petrol", "Hybrid" | P1 |
| transmission | string | 变速箱 | "Automatic" | P1 |
| driveType | string | 驱动方式 | "2WD", "4WD" | P2 |
| color | string | 颜色 | "Silver" | P2 |
| seats | number | 座位数 | 5 | P2 |
| doors | number | 门数 | 5 | P2 |

### 4. 卖家信息
| 参数名 | 类型 | 说明 | 示例 | 优先级 |
|--------|------|------|------|--------|
| sellerType | string | 卖家类型 | "Private", "Dealer" | P0 |
| sellerName | string | 卖家名称 | "John Smith" | P1 |
| sellerRating | number | 卖家评分 | 4.5 | P2 |
| sellerResponseRate | number | 响应率 (%) | 95 | P2 |

### 5. 车辆描述
| 参数名 | 类型 | 说明 | 示例 | 优先级 |
|--------|------|------|------|--------|
| description | string | 完整描述 | "Well maintained, full service history..." | P0 |
| condition | string | 车况 | "Excellent", "Good", "Fair" | P1 |
| hasWof | boolean | 是否有 WOF | true | P1 |
| wofExpiry | date | WOF 到期日 | "2026-06-15" | P1 |
| registration | string | 注册号 | "ABC123" | P2 |
| regExpiry | date | 注册到期日 | "2026-12-01" | P2 |

### 6. 历史信息
| 参数名 | 类型 | 说明 | 示例 | 优先级 |
|--------|------|------|------|--------|
| listingUrl | string | 列表链接 | "https://..." | P0 |
| postedDate | date | 发布日期 | "2026-02-28" | P1 |
| priceHistory | array | 价格历史 | [{"date": "2026-02-28", "price": 13000}] | P1 |
| daysOnMarket | number | 上架天数 | 15 | P1 |
| viewCount | number | 浏览次数 | 245 | P2 |
| watchCount | number | 收藏次数 | 12 | P2 |

### 7. 图片信息
| 参数名 | 类型 | 说明 | 示例 | 优先级 |
|--------|------|------|------|--------|
| imageUrls | array | 图片链接 | ["https://...", "https://..."] | P1 |
| imageCount | number | 图片数量 | 12 | P2 |

### 8. 元数据
| 参数名 | 类型 | 说明 | 示例 | 优先级 |
|--------|------|------|------|--------|
| platform | string | 平台名称 | "trademe", "facebook", "autotrader" | P0 |
| scrapedAt | date | 抓取时间 | "2026-03-03T10:00:00Z" | P0 |
| scrapeDate | date | 抓取日期 | "2026-03-03" | P0 |

## 二、筛选条件

### 当前筛选条件
```javascript
{
  minYear: 2006,           // 最小年份
  maxMileage: 180000,      // 最大里程 (km)
  minPrice: 2000,          // 最小价格 (NZD)
  maxPrice: 7500,          // 最大价格 (NZD)
  sellerType: 'private',    // 仅私人卖家
  locations: ['Auckland', 'Waikato']  // 地区
}
```

### 可选筛选条件
- 车身类型（Hatchback, Sedan, SUV, Wagon）
- 燃料类型（Petrol, Diesel, Hybrid, Electric）
- 变速箱（Automatic, Manual）
- 有 WOF
- 有完整服务记录

## 三、数据源优先级

### P0 - 主要数据源（必须抓取）
1. **TradeMe Motors** - 新西兰最大的二手车平台
2. **Facebook Marketplace** - 私人交易活跃

### P1 - 次要数据源（建议抓取）
1. **AutoTrader New Zealand** - 专业汽车平台
2. **Carsales New Zealand** - 澳洲/新西兰平台
3. **Mighty Ape Motors** - 新兴平台

### P2 - 补充数据源（可选）
1. **Turners Auctions** - 拍卖平台
2. **CarJam** - 车辆历史记录
3. **AA Motoring** - 汽车协会平台

## 四、数据质量标准

### 必需字段完整性
- P0 字段：100% 完整
- P1 字段：≥ 90% 完整
- P2 字段：≥ 70% 完整

### 数据准确性
- 价格：必须准确到 NZD
- 里程：必须准确到 km
- 年份：必须准确到年
- 位置：至少到城市级别

### 数据时效性
- 每日更新：活跃 listing
- 每周更新：价格变化
- 每月更新：历史数据归档

## 五、数据存储结构

### JSON 格式示例
```json
{
  "scrapeDate": "2026-03-03T10:00:00.000Z",
  "totalCount": 198,
  "config": {
    "minYear": 2006,
    "maxMileage": 180000,
    "minPrice": 2000,
    "maxPrice": 7500
  },
  "vehicles": [
    {
      "id": "tm_5810649639",
      "make": "Toyota",
      "model": "Corolla",
      "year": 2015,
      "price": 13000,
      "mileage": 127500,
      "location": "Auckland",
      "sellerType": "Private",
      "description": "Well maintained...",
      "listingUrl": "https://...",
      "platform": "trademe",
      "scrapedAt": "2026-03-03T10:00:00.000Z"
    }
  ]
}
```

## 六、抓取频率

| 数据源 | 抓取频率 | 说明 |
|--------|----------|------|
| TradeMe | 每日 | 主要数据源，每日更新 |
| Facebook Marketplace | 每日 | 私人交易活跃 |
| AutoTrader | 每周 | 次要数据源 |
| 其他平台 | 每月 | 补充数据源 |

## 七、数据去重策略

### 去重规则
1. 基于 `id` 去重（同一平台）
2. 基于 `make + model + year + mileage + price` 去重（跨平台）
3. 基于 `listingUrl` 去重（完全相同）

### 去重优先级
1. 优先保留最新数据
2. 优先保留信息更完整的数据
3. 优先保留来自主要平台的数据
