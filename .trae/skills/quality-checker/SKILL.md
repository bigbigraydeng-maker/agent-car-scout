---
name: "quality-checker"
description: "检查输出质量，防止重复错误。在发送报告、生成最终输出前必须调用，验证链接、去重、黑名单过滤等关键环节。"
---

# 质量检查器 (Quality Checker)

## 🎯 目的

防止"粗心大意"导致的重复错误，确保每次输出都经过严格验证。

## 📋 何时调用

**强制调用场景：**
1. 发送飞书报告前
2. 生成最终评分结果后
3. 用户反馈质量问题时
4. 发现重复错误时

## ✅ 检查清单

### 1. 数据完整性检查

```javascript
// 检查项：
- [ ] 车辆数据是否包含必需字段
- [ ] 价格、里程、年份是否合理
- [ ] 链接格式是否正确
- [ ] 是否有null/undefined值
- [ ] 里程是否超标（≤160,000km）
```

**必需字段：**
- `id` - 唯一标识
- `listingUrl` - 有效链接
- `price` - 价格（数字）
- `mileage` - 里程（数字，≤160,000）
- `year` - 年份（数字）
- `model` - 车型

**里程限制验证：**
```javascript
function validateMileage(vehicles) {
  const violations = vehicles.filter(v => v.mileage > 160000);
  
  return {
    passed: violations.length === 0,
    violations: violations.map(v => ({
      model: v.model,
      year: v.year,
      mileage: v.mileage,
      limit: 160000
    }))
  };
}
```

### 2. 链接有效性检查

```javascript
// 验证规则：
- [ ] 链接必须以 https:// 开头
- [ ] TradeMe链接格式: https://www.trademe.co.nz/a/motors/cars/.../listing/{ID}
- [ ] 链接不能包含占位符（如 {id}, [id]）
- [ ] 每辆车的链接必须唯一
```

**常见错误：**
```javascript
❌ "https://www.trademe.co.nz/listing/{id}"  // 占位符未替换
❌ "www.trademe.co.nz/..."                    // 缺少https://
❌ 重复链接                                    // 多辆车使用相同链接
```

### 3. 去重检查

```javascript
// 去重策略：
- [ ] 按listing ID去重（主要）
- [ ] 按车辆特征去重（备用）
  - 特征签名: `${make}_${model}_${year}_${price}_${mileage}`
- [ ] 过滤广告车（标题包含"Advertisement"）
```

**验证代码：**
```javascript
function validateDeduplication(vehicles) {
  const idSet = new Set();
  const signatureSet = new Set();
  const duplicates = [];

  vehicles.forEach(v => {
    // 检查ID重复
    if (idSet.has(v.id)) {
      duplicates.push({ type: 'ID', id: v.id, vehicle: v });
    }
    idSet.add(v.id);

    // 检查特征重复
    const sig = `${v.make}_${v.model}_${v.year}_${v.price}_${v.mileage}`;
    if (signatureSet.has(sig)) {
      duplicates.push({ type: 'SIGNATURE', signature: sig, vehicle: v });
    }
    signatureSet.add(sig);
  });

  return {
    passed: duplicates.length === 0,
    duplicates: duplicates
  };
}
```

### 4. 黑名单过滤检查

```javascript
// 验证规则：
- [ ] 黑名单文件存在且格式正确
- [ ] 所有黑名单车辆已被过滤
- [ ] 黑名单ID格式正确
```

**验证代码：**
```javascript
function validateBlacklist(vehicles, blacklistPath) {
  const blacklist = JSON.parse(fs.readFileSync(blacklistPath, 'utf8'));
  const blacklistIds = new Set(blacklist.vehicles.map(v => v.id));

  const violations = vehicles.filter(v => {
    const listingId = v.listingUrl?.match(/listing\/(\d+)/)?.[1];
    return listingId && blacklistIds.has(listingId);
  });

  return {
    passed: violations.length === 0,
    violations: violations,
    blacklistCount: blacklistIds.size
  };
}
```

### 5. 报告格式检查

```javascript
// 检查项：
- [ ] 版本号正确（当前v3.1）
- [ ] 每辆车都有完整链接
- [ ] 利润计算正确
- [ ] 评分分解完整
```

**格式验证：**
```javascript
function validateReport(report, vehicles) {
  const errors = [];

  // 检查版本号
  if (!report.includes('v3.1')) {
    errors.push('版本号错误：应显示v3.1');
  }

  // 检查链接数量
  const linkCount = (report.match(/https:\/\//g) || []).length;
  if (linkCount !== vehicles.length) {
    errors.push(`链接数量不匹配：报告${linkCount}个，实际${vehicles.length}辆车`);
  }

  // 检查必需字段
  vehicles.forEach(v => {
    if (!v.listingUrl) {
      errors.push(`车辆 ${v.id} 缺少链接`);
    }
  });

  return {
    passed: errors.length === 0,
    errors: errors
  };
}
```

## 🔧 使用方法

### 方法1：自动检查（推荐）

在发送报告前自动调用：

```javascript
const { runQualityCheck } = require('./quality-checker');

// 生成报告后
const report = generateReport(vehicles);

// 发送前检查
const check = runQualityCheck(vehicles, report);
if (!check.passed) {
  console.error('❌ 质量检查失败:', check.errors);
  // 修复问题后重新生成
  return;
}

// 检查通过，发送报告
await sendFeishu(report);
```

### 方法2：手动检查

```bash
node quality-checker.js --check-latest
```

## 📊 检查报告格式

```
🔍 质量检查报告
━━━━━━━━━━━━━━━━━━━━━━

✅ 数据完整性: 通过
   - 车辆数: 22
   - 必需字段: 100%完整

✅ 链接有效性: 通过
   - 有效链接: 22/22
   - 唯一链接: 22/22

❌ 去重检查: 失败
   - 发现重复: 3辆
   - 重复ID: tm_123, tm_456, tm_789

✅ 黑名单过滤: 通过
   - 黑名单车辆: 5辆
   - 已过滤: 5辆

✅ 报告格式: 通过
   - 版本号: v3.1 ✓
   - 链接完整: 22/22 ✓

━━━━━━━━━━━━━━━━━━━━━━
总评: ❌ 未通过（需修复去重问题）
```

## ⚠️ 常见错误模式

### 错误1：链接未替换占位符
```javascript
❌ "listingUrl": "https://trademe.co.nz/listing/{id}"
✅ "listingUrl": "https://trademe.co.nz/listing/5760328364"
```

### 错误2：重复车辆
```javascript
❌ 同一辆车出现多次（相同ID或特征）
✅ 每辆车只出现一次
```

### 错误3：黑名单车辆未被过滤
```javascript
❌ 已售车辆仍在推荐列表
✅ 黑名单车辆已全部过滤
```

### 错误4：版本号错误
```javascript
❌ 报告显示 "v3.0 Flip Score"
✅ 报告显示 "v3.1 Flip Score"
```

### 错误5：里程超标车辆未被过滤
```javascript
❌ 推荐里程超标的车辆（如291k km）
✅ 所有车辆里程 ≤160k km
```

## 🎯 质量标准

**必须达到100%通过才能发送：**
1. ✅ 数据完整性检查（含里程限制）
2. ✅ 链接有效性检查
3. ✅ 去重检查
4. ✅ 黑名单过滤检查
5. ✅ 报告格式检查

## 📝 修复流程

当检查失败时：

1. **立即停止发送**
2. **定位错误原因**（查看检查报告）
3. **修复问题**（不要绕过检查）
4. **重新运行检查**
5. **确认100%通过后发送**

## 🔄 持续改进

每次发现新错误时：

1. 更新检查清单
2. 添加新的验证规则
3. 记录错误模式
4. 完善修复建议

---

**记住：质量检查不是可选项，而是必须项！**
