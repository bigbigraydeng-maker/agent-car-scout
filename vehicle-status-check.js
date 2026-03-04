/**
 * 车辆状态检测模块 - Car Scout
 * 检测车辆是否已售、链接是否有效
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const path = require('path');

const DATA_DIR = 'C:/Users/Zhong/.openclaw/workspace/skills/car-scout/data';
const BLACKLIST_PATH = path.join(DATA_DIR, 'blacklist_vehicles.json');

/**
 * 加载黑名单
 */
function loadBlacklist() {
  if (!fs.existsSync(BLACKLIST_PATH)) {
    return { vehicles: [], lastUpdated: null };
  }
  try {
    return JSON.parse(fs.readFileSync(BLACKLIST_PATH, 'utf8'));
  } catch (e) {
    return { vehicles: [], lastUpdated: null };
  }
}

/**
 * 保存黑名单
 */
function saveBlacklist(blacklist) {
  blacklist.lastUpdated = new Date().toISOString();
  fs.writeFileSync(BLACKLIST_PATH, JSON.stringify(blacklist, null, 2));
}

/**
 * 检查车辆是否在黑名单中
 */
function isBlacklisted(listingId) {
  const blacklist = loadBlacklist();
  return blacklist.vehicles.some(v => v.id === listingId);
}

/**
 * 添加车辆到黑名单
 */
function addToBlacklist(vehicle) {
  const blacklist = loadBlacklist();
  
  const existing = blacklist.vehicles.find(v => v.id === vehicle.id);
  if (existing) {
    existing.reason = vehicle.reason;
    existing.addedAt = new Date().toISOString();
  } else {
    blacklist.vehicles.push({
      id: vehicle.id,
      listingUrl: vehicle.listingUrl,
      model: vehicle.model,
      year: vehicle.year,
      price: vehicle.price,
      reason: vehicle.reason,
      addedAt: new Date().toISOString()
    });
  }
  
  saveBlacklist(blacklist);
  console.log(`   ⛔ 已加入黑名单: ${vehicle.id}`);
}

/**
 * 检测车辆状态（已售/无效）
 */
async function checkVehicleStatus(page, listingUrl) {
  try {
    await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    const bodyText = await page.evaluate(() => document.body.innerText);
    
    const isUnavailable = /(sold|已售|已售出|已售罄|no longer available|unavailable|closed|item was sold)/i.test(bodyText.substring(0, 1000));
    const isRedirected = await page.evaluate(() => {
      const currentUrl = window.location.href;
      return !currentUrl.includes('/listing/') && currentUrl.includes('/motors/cars/');
    });
    
    if (isUnavailable) return { status: 'sold', reason: '页面显示已售' };
    if (isRedirected) return { status: 'invalid', reason: '链接跳转到列表页' };
    
    return { status: 'alive', reason: null };
  } catch (e) {
    return { status: 'error', reason: `检查失败: ${e.message}` };
  }
}

/**
 * 批量检查车辆状态
 */
async function checkVehiclesStatus(vehicles, limit = 20) {
  console.log('🚀 开始批量检查车辆状态...');
  console.log('📊 待检查车辆数:', vehicles.length, `(限制: ${limit})`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const results = [];
  const toCheck = vehicles.slice(0, limit);
  
  for (let i = 0; i < toCheck.length; i++) {
    const vehicle = toCheck[i];
    console.log(`\n[${i + 1}/${toCheck.length}] 检查: ${vehicle.year} ${vehicle.model}`);
    console.log('   链接:', vehicle.listingUrl);
    
    const listingId = vehicle.listingUrl.match(/listing\/(\d+)/)?.[1];
    if (listingId && isBlacklisted(listingId)) {
      console.log('   ⛔ 已在黑名单中');
      results.push({ ...vehicle, _status: 'blacklisted' });
      continue;
    }
    
    const result = await checkVehicleStatus(page, vehicle.listingUrl);
    console.log('   状态:', result.status, '-', result.reason || '正常');
    
    if (result.status === 'sold' || result.status === 'invalid') {
      addToBlacklist({
        id: listingId,
        listingUrl: vehicle.listingUrl,
        model: vehicle.model,
        year: vehicle.year,
        price: vehicle.price,
        reason: result.reason
      });
    }
    
    results.push({ ...vehicle, _status: result.status, _reason: result.reason });
    
    if (i < toCheck.length - 1) {
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
    }
  }
  
  await browser.close();
  
  const aliveCount = results.filter(r => r._status === 'alive').length;
  const invalidCount = results.filter(r => r._status === 'sold' || r._status === 'invalid').length;
  const blacklistCount = results.filter(r => r._status === 'blacklisted').length;
  
  console.log(`\n✅ 检查完成: 正常 ${aliveCount} | 无效 ${invalidCount} | 黑名单 ${blacklistCount}`);
  
  return results;
}

/**
 * 过滤有效车辆（排除已售/黑名单）
 */
function filterValidVehicles(vehicles) {
  const validVehicles = vehicles.filter(v => {
    if (!v.listingUrl) return false;
    
    const listingId = v.listingUrl.match(/listing\/(\d+)/)?.[1];
    if (listingId && isBlacklisted(listingId)) {
      console.log(`   ⛔ 黑名单过滤: ${v.year} ${v.model}`);
      return false;
    }
    
    return true;
  });
  
  console.log(`📊 车辆过滤: ${vehicles.length} → ${validVehicles.length}`);
  return validVehicles;
}

module.exports = {
  loadBlacklist,
  saveBlacklist,
  isBlacklisted,
  addToBlacklist,
  checkVehicleStatus,
  checkVehiclesStatus,
  filterValidVehicles
};
