/**
 * 进口成本计算器
 *
 * 日本拍卖 → 新西兰落地的完整成本链路:
 *
 *   [日本]
 *   拍卖价 (JPY)
 *   + 代理佣金 (8%)
 *   + 日本国内运费 (到出口港)
 *   + 出口手续费
 *   ──────────────────
 *   FOB 离港价 (JPY) → 换算 NZD
 *
 *   [海运]
 *   + 海运费 (NZD, 按车型不同)
 *   + 海运保险 (FOB 的 0.8%)
 *
 *   [新西兰]
 *   + 关税 (一般为 0%, 日本 FTA)
 *   + GST (15% × 进口价值)
 *   + MAF 生物安全检查
 *   + WOF 认证 + 合规改装
 *   + 注册费
 *   + 杂费 (银行电汇、文件等)
 *   ──────────────────
 *   = 落地总成本 (NZD)
 *
 * 付款节点:
 *   1. 拍卖得标后: 支付定金 (拍卖价 10%)
 *   2. 落地后 60 天内: 支付尾款 (全部剩余费用)
 */

const { VEHICLES } = require('../data/vehicles');

// ─── 固定成本配置 (NZD, 除非特别说明) ──────────────────────
const COST_CONFIG = {
  // 日本端
  agentCommissionRate:  0.08,    // 代理佣金 8% of 拍卖价
  japanDomesticFreight: 650,     // 日本国内运费 (NZD 约等值)
  japanExportDocs:      200,     // 出口文件费

  // 海运
  shippingRoRo: {
    alphard:  2200,              // RoRo 船运费 (NZD)
    vellfire: 2200,
    prius:    1900,
  },
  marineInsuranceRate: 0.008,    // 海运险: FOB 总价的 0.8%

  // NZ 进口
  customsDutyRate: 0.0,          // 关税 0% (日本-NZ FTA)
  gstRate:         0.15,         // 进口 GST 15%
  // GST 计税基数 = 关税价值 (CIF: 成本+运费+保险) × (1 + 关税率)

  // NZ 合规与行政
  nzMaf:           420,          // MAF 生物安全 + 洗车
  nzWof:           80,           // WOF
  nzRegistration:  300,          // 首次注册
  bankWire:        80,           // 银行电汇手续费 (每笔)
  miscAdmin:       250,          // 文件、邮费等杂费

  // 合规费用按车型不同 (含灯光改装、EFTPOS 认证等)
  // 高配双电动门车型合规费更高
  complianceFees: {
    alphard:  { base: 4500, premium: 6000 },   // base: G/S grade, premium: Exec Lounge
    vellfire: { base: 4500, premium: 6000 },
    prius:    { base: 2500, premium: 3200 },
  },
};

/**
 * 计算完整进口成本
 *
 * @param {object} params
 * @param {string} params.modelKey        - 'alphard' | 'vellfire' | 'prius'
 * @param {string} params.grade           - 配置等级 (影响合规费)
 * @param {number} params.auctionPriceJpy - 拍卖价 (日元)
 * @param {number} params.jpyToNzd        - 汇率 (e.g. 0.0115)
 * @param {object} params.overrides       - 手动覆盖某些费用
 * @returns {CostBreakdown}
 */
function calculateImportCosts(params) {
  const {
    modelKey,
    grade,
    auctionPriceJpy,
    jpyToNzd = 0.0115,
    overrides = {},
  } = params;

  const vehicle = VEHICLES[modelKey];
  if (!vehicle) throw new Error(`Unknown model: ${modelKey}`);

  const rate = parseFloat(jpyToNzd);

  // ── 日本端 ─────────────────────────────────────────────────
  const agentCommRate   = overrides.agentCommissionRate ?? COST_CONFIG.agentCommissionRate;
  const auctionNzd      = Math.round(auctionPriceJpy * rate);
  const agentCommission = Math.round(auctionNzd * agentCommRate);
  const japanFreight    = overrides.japanFreight    ?? COST_CONFIG.japanDomesticFreight;
  const exportDocs      = overrides.exportDocs      ?? COST_CONFIG.japanExportDocs;
  const fobNzd          = auctionNzd + agentCommission + japanFreight + exportDocs;

  // ── 海运 ────────────────────────────────────────────────────
  const shipping        = overrides.shipping ?? COST_CONFIG.shippingRoRo[modelKey] ?? 2000;
  const marineRate      = overrides.marineInsuranceRate ?? COST_CONFIG.marineInsuranceRate;
  const insurance       = Math.round(fobNzd * marineRate);
  const cifNzd          = fobNzd + shipping + insurance;  // Cost + Insurance + Freight

  // ── NZ 进口税 ────────────────────────────────────────────────
  const customsDuty     = Math.round(cifNzd * COST_CONFIG.customsDutyRate);
  const gstBase         = cifNzd + customsDuty;
  const gst             = Math.round(gstBase * COST_CONFIG.gstRate);

  // ── NZ 合规 ──────────────────────────────────────────────────
  const complianceTiers  = COST_CONFIG.complianceFees[modelKey];
  const isPremiumGrade   = /executive|executive lounge|zg|a premium tss/i.test(grade || '');
  const compliance       = overrides.compliance ?? (
    isPremiumGrade ? complianceTiers.premium : complianceTiers.base
  );

  const nzMaf            = overrides.nzMaf         ?? COST_CONFIG.nzMaf;
  const nzWof            = COST_CONFIG.nzWof;
  const nzRegistration   = COST_CONFIG.nzRegistration;
  const bankWire         = COST_CONFIG.bankWire * 2;   // 两笔电汇 (定金 + 尾款)
  const miscAdmin        = COST_CONFIG.miscAdmin;

  // ── 合计 ─────────────────────────────────────────────────────
  const totalLandedCost = auctionNzd + agentCommission + japanFreight + exportDocs
    + shipping + insurance + customsDuty + gst
    + compliance + nzMaf + nzWof + nzRegistration + bankWire + miscAdmin;

  // ── 付款计划 ────────────────────────────────────────────────
  const deposit     = Math.round(auctionNzd * 0.10);   // 定金: 拍卖价 10%
  const balanceDue  = totalLandedCost - deposit;        // 尾款: 落地后 60 天

  return {
    // 汇率
    auctionPriceJpy,
    jpyToNzdRate: rate,

    // 日本端
    auctionPriceNzd:  auctionNzd,
    agentCommission,
    japanFreight,
    exportDocs,
    fobNzd,

    // 海运
    shipping,
    insurance,
    cifNzd,

    // NZ 进口税
    customsDuty,
    gst,

    // NZ 合规
    compliance,
    nzMaf,
    nzWof,
    nzRegistration,
    bankWire,
    miscAdmin,

    // 汇总
    totalLandedCost,
    deposit,
    balanceDue,

    // 元数据
    isPremiumGrade,
    modelKey,
    grade,
  };
}

/**
 * 计算利润分析
 *
 * @param {number} estimatedNzPrice  - 预测 NZ 售价
 * @param {CostBreakdown} costs      - calculateImportCosts() 的返回值
 * @param {number} sellingExpenses   - 销售费用 (广告、WOF 等, 默认 $800)
 * @returns {ProfitAnalysis}
 */
function analyzeProfits(estimatedNzPrice, costs, sellingExpenses = 800) {
  if (!estimatedNzPrice) {
    return { grossProfit: null, netProfit: null, recommendation: 'NO_DATA' };
  }

  const grossProfit = estimatedNzPrice - costs.totalLandedCost;
  const netProfit   = grossProfit - sellingExpenses;
  const marginPct   = ((netProfit / estimatedNzPrice) * 100).toFixed(1);
  const roi         = ((netProfit / costs.totalLandedCost) * 100).toFixed(1);

  let recommendation, recommendationColor;
  if (netProfit >= 8000 && parseFloat(marginPct) >= 15) {
    recommendation = 'STRONG_BUY';
    recommendationColor = 'green';
  } else if (netProfit >= 4000 && parseFloat(marginPct) >= 8) {
    recommendation = 'BUY';
    recommendationColor = 'green';
  } else if (netProfit >= 1500 && parseFloat(marginPct) >= 4) {
    recommendation = 'CONSIDER';
    recommendationColor = 'yellow';
  } else if (netProfit >= 0) {
    recommendation = 'MARGINAL';
    recommendationColor = 'orange';
  } else {
    recommendation = 'PASS';
    recommendationColor = 'red';
  }

  return {
    estimatedNzPrice,
    totalLandedCost:    costs.totalLandedCost,
    sellingExpenses,
    grossProfit,
    netProfit,
    marginPct:          parseFloat(marginPct),
    roi:                parseFloat(roi),
    recommendation,
    recommendationColor,
    deposit:            costs.deposit,
    balanceDue:         costs.balanceDue,
  };
}

/**
 * 反算最高拍卖价
 *
 * 给定目标净利润，代入 NZ 预测售价，反推允许的最高拍卖价 (JPY)。
 *
 * 代数推导：
 *   totalLanded = A_nzd * (1+rc)*(1+ri)*(1+rg)  +  固定成本
 *   netProfit   = estimatedNzPrice - totalLanded - sellingExpenses
 *   → maxAuctionNzd = (estimatedNzPrice - fixedCosts - sellingExpenses - targetNetProfit)
 *                      / ((1+rc)*(1+ri)*(1+rg))
 *
 * @param {object} params
 * @param {string} params.modelKey
 * @param {string} params.grade
 * @param {number} params.estimatedNzPrice  - 系统预测的 NZ 售价
 * @param {number} params.jpyToNzd
 * @param {number} params.targetNetProfit   - 目标最低净利润 (NZD), 默认 0
 * @param {number} params.sellingExpenses   - 销售费用, 默认 800
 * @param {object} params.overrides
 */
function reverseAuctionPrice(params) {
  const {
    modelKey,
    grade,
    estimatedNzPrice,
    jpyToNzd = 0.0115,
    targetNetProfit = 0,
    sellingExpenses = 800,
    overrides = {},
  } = params;

  const rate    = parseFloat(jpyToNzd);
  const vehicle = VEHICLES[modelKey];
  if (!vehicle) throw new Error(`Unknown model: ${modelKey}`);

  const rc = overrides.agentCommissionRate  ?? COST_CONFIG.agentCommissionRate;
  const ri = overrides.marineInsuranceRate  ?? COST_CONFIG.marineInsuranceRate;
  const rg = COST_CONFIG.gstRate;

  const japanFreight = overrides.japanFreight ?? COST_CONFIG.japanDomesticFreight;
  const exportDocs   = overrides.exportDocs   ?? COST_CONFIG.japanExportDocs;
  const shipping     = overrides.shipping     ?? (COST_CONFIG.shippingRoRo[modelKey] ?? 2000);

  const complianceTiers = COST_CONFIG.complianceFees[modelKey];
  const isPremiumGrade  = /executive|executive lounge|zg|a premium tss/i.test(grade || '');
  const compliance = overrides.compliance ?? (isPremiumGrade ? complianceTiers.premium : complianceTiers.base);
  const nzMaf      = overrides.nzMaf ?? COST_CONFIG.nzMaf;

  // 固定成本 (与拍卖价无关)
  // fob_fixed 中含 japanFreight + exportDocs 的保险和 GST
  const fobFixed      = japanFreight + exportDocs;
  const insuranceFixed = fobFixed * ri;
  const cifFixed       = fobFixed + shipping + insuranceFixed;
  const gstFixed       = cifFixed * rg;
  const otherFixed     = nzMaf + COST_CONFIG.nzWof + COST_CONFIG.nzRegistration
                         + COST_CONFIG.bankWire * 2 + COST_CONFIG.miscAdmin + compliance;
  const totalFixed = japanFreight + exportDocs + shipping + insuranceFixed + gstFixed + otherFixed;

  // 拍卖价乘数: totalLanded_variable = A_nzd * (1+rc)*(1+ri)*(1+rg)
  const auctionMultiplier = (1 + rc) * (1 + ri) * (1 + rg);

  // 反算
  const maxAuctionNzd = (estimatedNzPrice - totalFixed - sellingExpenses - targetNetProfit) / auctionMultiplier;
  const maxAuctionJpy = Math.floor(maxAuctionNzd / rate);

  // 验证：以最高拍卖价计算实际利润 (应约等于 targetNetProfit)
  let verification = null;
  if (maxAuctionJpy > 0) {
    const verifyCosts  = calculateImportCosts({ modelKey, grade, auctionPriceJpy: maxAuctionJpy, jpyToNzd, overrides });
    const verifyProfit = analyzeProfits(estimatedNzPrice, verifyCosts, sellingExpenses);
    verification = { costs: verifyCosts, profit: verifyProfit };
  }

  return {
    maxAuctionJpy:    Math.max(0, maxAuctionJpy),
    maxAuctionNzd:    Math.max(0, Math.round(maxAuctionNzd)),
    auctionMultiplier,
    totalFixed:       Math.round(totalFixed),
    estimatedNzPrice,
    targetNetProfit,
    sellingExpenses,
    breakdown: {
      japanFreight, exportDocs, shipping, compliance, nzMaf,
      nzWof:         COST_CONFIG.nzWof,
      nzRegistration: COST_CONFIG.nzRegistration,
      bankWire:      COST_CONFIG.bankWire * 2,
      miscAdmin:     COST_CONFIG.miscAdmin,
      gstFixed:      Math.round(gstFixed),
      totalFixed:    Math.round(totalFixed),
    },
    verification,
  };
}

module.exports = { calculateImportCosts, analyzeProfits, reverseAuctionPrice, COST_CONFIG };
