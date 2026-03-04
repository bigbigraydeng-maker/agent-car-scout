const fs = require('fs');
const path = require('path');

console.log('🔍 Car Scout 质量检查器');
console.log('='.repeat(60));

const dataDir = path.join(__dirname, 'data');
const blacklistPath = path.join(__dirname, 'blacklist_vehicles.json');

// 指定要检查的文件
const targetFile = 'scored_20260303_final.json';
const scoredPath = path.join(dataDir, targetFile);

console.log(`\n📂 检查文件: ${targetFile}\n`);

if (!fs.existsSync(scoredPath)) {
  console.log('❌ 未找到评分文件');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(scoredPath, 'utf8'));
const vehicles = data.vehicles || [];

const errors = [];
const warnings = [];

// 1. 数据完整性检查
console.log('✅ 1. 数据完整性检查');
const requiredFields = ['id', 'listingUrl', 'price', 'mileage', 'year', 'model'];
let integrityPassed = true;
const mileageViolations = [];

vehicles.forEach((v, i) => {
  requiredFields.forEach(field => {
    if (v[field] === undefined || v[field] === null) {
      errors.push(`车辆${i + 1}: 缺少字段 "${field}"`);
      integrityPassed = false;
    }
  });

  if (typeof v.price !== 'number' || v.price <= 0) {
    errors.push(`车辆${i + 1}: 价格无效 (${v.price})`);
    integrityPassed = false;
  }

  if (typeof v.mileage !== 'number' || v.mileage < 0) {
    warnings.push(`车辆${i + 1}: 里程异常 (${v.mileage})`);
  }

  // 检查里程是否超标（评分系统限制：160,000km）
  if (v.mileage > 160000) {
    mileageViolations.push({
      index: i,
      model: v.model,
      year: v.year,
      mileage: v.mileage,
      price: v.price
    });
  }
});

if (integrityPassed) {
  console.log('   ✓ 所有必需字段完整');
  console.log(`   ✓ 车辆数: ${vehicles.length}`);
}

// 里程限制检查
if (mileageViolations.length > 0) {
  console.log(`\n❌ 里程超标检查`);
  mileageViolations.forEach(v => {
    errors.push(`车辆${v.index + 1}: 里程超标 - ${v.year} ${v.model} | ${(v.mileage/1000).toFixed(0)}k km | $${v.price} (限制: ≤160k km)`);
    console.log(`   ❌ ${v.year} ${v.model} | ${(v.mileage/1000).toFixed(0)}k km | $${v.price}`);
  });
} else {
  console.log(`   ✓ 所有车辆里程在限制内 (≤160k km)`);
}

// 2. 链接有效性检查
console.log('\n✅ 2. 链接有效性检查');
const linkErrors = [];
const linkSet = new Set();

vehicles.forEach((v, i) => {
  if (!v.listingUrl) {
    linkErrors.push(`车辆${i + 1}: 缺少链接`);
    return;
  }

  if (!v.listingUrl.startsWith('https://')) {
    linkErrors.push(`车辆${i + 1}: 链接格式错误 (${v.listingUrl})`);
  }

  if (v.listingUrl.includes('{id}') || v.listingUrl.includes('[id]')) {
    linkErrors.push(`车辆${i + 1}: 链接包含占位符 (${v.listingUrl})`);
  }

  if (linkSet.has(v.listingUrl)) {
    linkErrors.push(`车辆${i + 1}: 重复链接 (${v.listingUrl})`);
  }
  linkSet.add(v.listingUrl);
});

if (linkErrors.length === 0) {
  console.log('   ✓ 所有链接有效');
  console.log(`   ✓ 唯一链接: ${linkSet.size}/${vehicles.length}`);
} else {
  linkErrors.forEach(err => errors.push(err));
  console.log(`   ❌ 发现 ${linkErrors.length} 个链接错误`);
}

// 3. 去重检查
console.log('\n✅ 3. 去重检查');
const idSet = new Set();
const signatureSet = new Set();
const duplicates = [];

vehicles.forEach((v, i) => {
  if (idSet.has(v.id)) {
    duplicates.push({ type: 'ID', id: v.id, index: i });
  }
  idSet.add(v.id);

  const sig = `${v.make || ''}_${v.model}_${v.year}_${v.price}_${v.mileage}`;
  if (signatureSet.has(sig)) {
    duplicates.push({ type: 'SIGNATURE', signature: sig, index: i });
  }
  signatureSet.add(sig);
});

if (duplicates.length === 0) {
  console.log('   ✓ 无重复车辆');
  console.log(`   ✓ 唯一ID: ${idSet.size}/${vehicles.length}`);
} else {
  duplicates.forEach(d => {
    warnings.push(`车辆${d.index + 1}: 重复${d.type} (${d.id || d.signature})`);
  });
  console.log(`   ⚠️  发现 ${duplicates.length} 个重复`);
}

// 4. 黑名单过滤检查
console.log('\n✅ 4. 黑名单过滤检查');
let blacklistCount = 0;
let blacklistViolations = [];

if (fs.existsSync(blacklistPath)) {
  const blacklist = JSON.parse(fs.readFileSync(blacklistPath, 'utf8'));
  const blacklistIds = new Set(blacklist.vehicles.map(v => v.id));
  blacklistCount = blacklistIds.size;

  vehicles.forEach((v, i) => {
    const listingId = v.listingUrl?.match(/listing\/(\d+)/)?.[1];
    if (listingId && blacklistIds.has(listingId)) {
      blacklistViolations.push({ index: i, id: listingId, model: v.model });
    }
  });

  if (blacklistViolations.length === 0) {
    console.log(`   ✓ 黑名单已正确过滤 (${blacklistCount}辆)`);
  } else {
    blacklistViolations.forEach(v => {
      errors.push(`车辆${v.index + 1}: 黑名单车辆未被过滤 (${v.model}, ID:${v.id})`);
    });
    console.log(`   ❌ 发现 ${blacklistViolations.length} 个黑名单车辆`);
  }
} else {
  warnings.push('黑名单文件不存在');
  console.log('   ⚠️  黑名单文件不存在');
}

// 5. 报告格式检查
console.log('\n✅ 5. 报告格式检查');
const reportFile = 'report_20260303_final_full.md';
const reportPath = path.join(dataDir, reportFile);

if (fs.existsSync(reportPath)) {
  const report = fs.readFileSync(reportPath, 'utf8');

  if (!report.includes('v3.1')) {
    errors.push('报告版本号错误：应显示v3.1');
    console.log('   ❌ 版本号错误');
  } else {
    console.log('   ✓ 版本号正确 (v3.1)');
  }

  const linkCount = (report.match(/https:\/\//g) || []).length;
  if (linkCount !== vehicles.length) {
    errors.push(`报告链接数量不匹配：报告${linkCount}个，实际${vehicles.length}辆车`);
    console.log(`   ❌ 链接数量不匹配 (${linkCount}/${vehicles.length})`);
  } else {
    console.log(`   ✓ 链接数量匹配 (${linkCount}/${vehicles.length})`);
  }
} else {
  warnings.push('未找到报告文件');
  console.log('   ⚠️  未找到报告文件');
}

// 总结
console.log('\n' + '='.repeat(60));
console.log('📊 质量检查总结\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ 所有检查通过！可以发送报告。');
  process.exit(0);
}

if (warnings.length > 0) {
  console.log(`⚠️  警告 (${warnings.length}):`);
  warnings.forEach(w => console.log(`   - ${w}`));
  console.log('');
}

if (errors.length > 0) {
  console.log(`❌ 错误 (${errors.length}):`);
  errors.forEach(e => console.log(`   - ${e}`));
  console.log('\n⛔ 必须修复以上错误才能发送报告！');
  process.exit(1);
}

console.log('✅ 可以发送报告（有警告但无错误）');
process.exit(0);
