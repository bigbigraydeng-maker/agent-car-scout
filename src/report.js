/**
 * Car Scout v3.0 - Flip Report Generator
 * 倒卖专用报告
 */

const fs = require('fs');
const path = require('path');

function formatPrice(p) { return `$${(p || 0).toLocaleString()}`; }
function formatKm(km) { return `${Math.round((km || 0) / 1000)}k`; }

const GRADE_EMOJI = { 'S': '🔥', 'A': '⭐', 'B': '📋', 'C': '⛔' };
const TURNOVER_TEXT = {
  'A': '⚡ 1-2周', 'B': '🟢 2-3周', 'C': '🟡 3-4周', 'D': '🔴 4周+'
};

/**
 * 生成单车 Flip 卡片
 */
function vehicleCard(v, rank) {
  const ge = GRADE_EMOJI[v.flipGrade] || '❓';
  const tt = TURNOVER_TEXT[v.turnoverGrade] || '未知';
  const urgentTag = v.urgentSignals && v.urgentSignals.length > 0
    ? `\n🏷️ 急售: ${v.urgentSignals.join(', ')}` : '';

  return `${ge} #${rank} | ${v.flipGrade}级 | Flip ${v.flipScore}/100
🚗 ${v.year} ${v.model} | ${formatPrice(v.price)} | ${formatKm(v.mileage)} km
📍 ${v.location} | ${v.seller || 'Private'} | ${v.platform || 'FB'}
━━━━━━━━━━━━━━━━━━━━━━
💰 预估售价: ${formatPrice(v.estimatedSellPrice)}
🔧 整备成本: ${formatPrice(v.estimatedPrepCost)}
📈 净利润: ${formatPrice(v.estimatedNetProfit)} (${v.profitMargin}%)
⏱️ 周转: ${tt}
💡 建议出价: ${formatPrice(v.suggestedBid)}
📊 评分: 利润${v.scoreBreakdown.profitMargin}/35 | 周转${v.scoreBreakdown.turnover}/30 | 整备${v.scoreBreakdown.prepCost}/15 | 议价${v.scoreBreakdown.negotiation}/20${urgentTag}
🔗 ${v.listingUrl || v.searchUrl || '无链接'}
`;
}

/**
 * 生成完整报告 (飞书长消息)
 */
function generateReport(vehicles) {
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Pacific/Auckland'
  });

  const sGrade = vehicles.filter(v => v.flipGrade === 'S');
  const aGrade = vehicles.filter(v => v.flipGrade === 'A');
  const bGrade = vehicles.filter(v => v.flipGrade === 'B');
  const avgProfit = vehicles.length > 0
    ? Math.round(vehicles.reduce((a, v) => a + (v.estimatedNetProfit || 0), 0) / vehicles.length)
    : 0;
  const avgMargin = vehicles.length > 0
    ? Math.round(vehicles.reduce((a, v) => a + (v.profitMargin || 0), 0) / vehicles.length)
    : 0;

  let r = `🚗 Car Scout 倒卖日报 | ${today}\n`;
  r += `v3.1 Flip Score\n\n`;

  // 概览
  r += `📊 今日概览\n`;
  r += `合格车辆: ${vehicles.length} 辆\n`;
  r += `S级(立即行动): ${sGrade.length} | A级(值得看): ${aGrade.length} | B级(谨慎): ${bGrade.length}\n`;
  r += `平均利润: ${formatPrice(avgProfit)} | 平均利润率: ${avgMargin}%\n`;
  r += `\n`;

  // S 级
  if (sGrade.length > 0) {
    r += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    r += `🔥 S级 - 立即行动 (${sGrade.length}辆)\n`;
    r += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    sGrade.forEach((v, i) => { r += vehicleCard(v, i + 1) + '\n'; });
  }

  // A 级
  if (aGrade.length > 0) {
    r += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    r += `⭐ A级 - 值得看车 (${aGrade.length}辆)\n`;
    r += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    const startRank = sGrade.length;
    aGrade.forEach((v, i) => { r += vehicleCard(v, startRank + i + 1) + '\n'; });
  }

  // B 级
  if (bGrade.length > 0) {
    r += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    r += `📋 B级 - 谨慎考虑 (${bGrade.length}辆)\n`;
    r += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    const startRank = sGrade.length + aGrade.length;
    bGrade.forEach((v, i) => { r += vehicleCard(v, startRank + i + 1) + '\n'; });
  }

  // 快速决策表
  r += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  r += `📋 快速决策表\n`;
  r += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  vehicles.forEach((v, i) => {
    const ge = GRADE_EMOJI[v.flipGrade];
    r += `${ge} ${v.year} ${v.model} | ${formatPrice(v.price)} → 利润${formatPrice(v.estimatedNetProfit)}(${v.profitMargin}%) | ${TURNOVER_TEXT[v.turnoverGrade] || '?'}\n`;
  });

  r += `\n筛选条件: $2,500-$8,000 | ≤160,000km | ≥2005年 | 仅个人卖家\n`;
  r += `评分版本: v3.1 Flip Score (利润35 + 周转30 + 整备15 + 议价20)\n`;

  return r;
}

/**
 * 生成简短报告 (飞书卡片消息)
 */
function generateShortReport(vehicles) {
  const today = new Date().toLocaleDateString('zh-CN', {
    month: 'short', day: 'numeric', timeZone: 'Pacific/Auckland'
  });

  const sGrade = vehicles.filter(v => v.flipGrade === 'S');
  const aGrade = vehicles.filter(v => v.flipGrade === 'A');

  let r = `🚗 Car Scout | ${today} | Flip Score v3.1\n\n`;
  r += `合格: ${vehicles.length}辆 | S级: ${sGrade.length} | A级: ${aGrade.length}\n\n`;

  // TOP 5
  r += `🏆 TOP 5:\n`;
  vehicles.slice(0, 5).forEach((v, i) => {
    const ge = GRADE_EMOJI[v.flipGrade];
    r += `${ge} ${v.year} ${v.model} | ${formatPrice(v.price)} → 净赚${formatPrice(v.estimatedNetProfit)}(${v.profitMargin}%) | ${TURNOVER_TEXT[v.turnoverGrade]}\n`;
  });

  if (vehicles.length === 0) {
    r += `今日无合格车辆。建议检查平台或放宽条件。\n`;
  }

  return r;
}

/**
 * 保存报告
 */
function saveReport(report, suffix) {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const filename = `report_${date}${suffix}.md`;
  const filepath = path.join(__dirname, '..', 'data', filename);
  fs.writeFileSync(filepath, report);
  return filepath;
}

function main() {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const scoredPath = path.join(__dirname, '..', 'data', `scored_${date}.json`);

  if (!fs.existsSync(scoredPath)) {
    console.error('No scored data:', scoredPath);
    return;
  }

  const data = JSON.parse(fs.readFileSync(scoredPath, 'utf8'));
  const vehicles = data.vehicles;

  const fullReport = generateReport(vehicles);
  saveReport(fullReport, '_full');

  const shortReport = generateShortReport(vehicles);
  saveReport(shortReport, '_short');

  console.log(shortReport);
  return { fullReport, shortReport };
}

if (require.main === module) { main(); }

module.exports = { generateReport, generateShortReport, saveReport };
