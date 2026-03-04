/**
 * Car Scout 集成脚本
 * 将价格预测系统集成到 Car Scout 工作流程
 */

const { PricePredictionSkill } = require('./.trae/skills/price-prediction/index');
const fs = require('fs');
const path = require('path');

class CarScoutIntegration {
  constructor() {
    this.priceSkill = new PricePredictionSkill();
    this.dataDir = path.join(__dirname, 'data');
  }

  async init() {
    console.log('🚀 初始化 Car Scout 集成...');
    await this.priceSkill.init();
    console.log('✅ 初始化完成');
    console.log('');
  }

  /**
   * 为车辆列表添加价格预测
   */
  async predictPricesForListings(vehicles) {
    console.log('🎯 为车辆列表添加价格预测...');
    
    const enrichedVehicles = [];
    let goodDeals = 0;
    let fairDeals = 0;
    let overpriced = 0;

    for (const vehicle of vehicles) {
      try {
        const prediction = await this.priceSkill.predictPrice({
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          mileage: vehicle.mileage,
          location: vehicle.location,
          seller_type: vehicle.sellerType
        });

        if (prediction.success) {
          const predictedPrice = prediction.data.predicted_price;
          const actualPrice = vehicle.price;
          const priceGap = actualPrice - predictedPrice;
          const priceGapPercentage = (priceGap / predictedPrice) * 100;

          // 判断交易类型
          let dealType = 'fair';
          let dealScore = 50;

          if (priceGap < -500) {
            dealType = 'good';
            dealScore = Math.min(100, 50 + Math.abs(priceGapPercentage));
            goodDeals++;
          } else if (priceGap > 500) {
            dealType = 'overpriced';
            dealScore = Math.max(0, 50 - priceGapPercentage);
            overpriced++;
          } else {
            fairDeals++;
            dealScore = 50 + (priceGap / 10);
          }

          enrichedVehicles.push({
            ...vehicle,
            predictedPrice: predictedPrice,
            priceRange: prediction.data.price_range,
            confidence: prediction.data.confidence,
            priceGap: priceGap,
            priceGapPercentage: priceGapPercentage.toFixed(1),
            dealType: dealType,
            dealScore: Math.round(dealScore),
            isGoodDeal: dealType === 'good',
            recommendation: this.getRecommendation(dealType, priceGap)
          });
        } else {
          enrichedVehicles.push({
            ...vehicle,
            predictionError: prediction.error
          });
        }
      } catch (error) {
        console.error(`   ❌ 预测失败 ${vehicle.title}:`, error.message);
        enrichedVehicles.push({
          ...vehicle,
          predictionError: error.message
        });
      }
    }

    // 按性价比排序
    enrichedVehicles.sort((a, b) => (a.priceGap || 0) - (b.priceGap || 0));

    console.log(`   ✅ 完成 ${enrichedVehicles.length} 辆车的价格预测`);
    console.log(`   🟢 超值交易: ${goodDeals} 辆`);
    console.log(`   🟡 合理价格: ${fairDeals} 辆`);
    console.log(`   🔴 价格偏高: ${overpriced} 辆`);
    console.log('');

    return enrichedVehicles;
  }

  /**
   * 获取购买建议
   */
  getRecommendation(dealType, priceGap) {
    switch (dealType) {
      case 'good':
        if (priceGap < -1000) {
          return '🔥 强烈推荐！价格远低于市场价，立即购买';
        } else if (priceGap < -500) {
          return '✅ 推荐！价格低于市场价，值得考虑';
        }
        return '👍 价格略低于市场价';
      
      case 'fair':
        return '➡️ 价格合理，符合市场行情';
      
      case 'overpriced':
        if (priceGap > 1000) {
          return '❌ 价格过高，建议议价或寻找其他选择';
        }
        return '⚠️ 价格略高，可以尝试议价';
      
      default:
        return '❓ 无法评估';
    }
  }

  /**
   * 生成 Car Scout 报告
   */
  async generateCarScoutReport(vehicles) {
    console.log('📊 生成 Car Scout 报告...');

    const enrichedVehicles = await this.predictPricesForListings(vehicles);

    // 统计
    const stats = {
      total: enrichedVehicles.length,
      goodDeals: enrichedVehicles.filter(v => v.dealType === 'good').length,
      fairDeals: enrichedVehicles.filter(v => v.dealType === 'fair').length,
      overpriced: enrichedVehicles.filter(v => v.dealType === 'overpriced').length,
      avgPriceGap: enrichedVehicles.reduce((sum, v) => sum + (v.priceGap || 0), 0) / enrichedVehicles.length
    };

    // 最佳交易
    const bestDeals = enrichedVehicles
      .filter(v => v.dealType === 'good')
      .slice(0, 5);

    // 按车型分组
    const byModel = {};
    for (const v of enrichedVehicles) {
      const key = `${v.make} ${v.model}`;
      if (!byModel[key]) {
        byModel[key] = { count: 0, avgPriceGap: 0, deals: [] };
      }
      byModel[key].count++;
      byModel[key].deals.push(v);
      byModel[key].avgPriceGap = byModel[key].deals.reduce((sum, d) => sum + (d.priceGap || 0), 0) / byModel[key].deals.length;
    }

    const report = {
      generatedAt: new Date().toISOString(),
      summary: stats,
      bestDeals: bestDeals,
      byModel: byModel,
      allVehicles: enrichedVehicles
    };

    // 保存报告
    const reportPath = path.join(__dirname, 'reports', `car_scout_report_${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`   ✅ 报告已保存: ${reportPath}`);
    console.log('');

    return report;
  }

  /**
   * 打印报告摘要
   */
  printReportSummary(report) {
    console.log('📊 Car Scout 报告摘要');
    console.log('========================================');
    console.log(`生成时间: ${new Date().toLocaleString()}`);
    console.log('');

    console.log('📈 总体统计:');
    console.log(`   总车辆数: ${report.summary.total}`);
    console.log(`   超值交易: ${report.summary.goodDeals} 🟢`);
    console.log(`   合理价格: ${report.summary.fairDeals} 🟡`);
    console.log(`   价格偏高: ${report.summary.overpriced} 🔴`);
    console.log(`   平均价差: $${Math.round(report.summary.avgPriceGap)}`);
    console.log('');

    if (report.bestDeals.length > 0) {
      console.log('🏆 最佳交易 (Top 5):');
      report.bestDeals.forEach((deal, i) => {
        console.log(`   ${i + 1}. ${deal.year} ${deal.make} ${deal.model}`);
        console.log(`      价格: $${deal.price} | 预测: $${deal.predictedPrice}`);
        console.log(`      节省: $${Math.abs(deal.priceGap)} (${Math.abs(deal.priceGapPercentage)}%)`);
        console.log(`      评分: ${deal.dealScore}/100`);
        console.log(`      ${deal.recommendation}`);
        console.log('');
      });
    }

    console.log('📊 各车型分析:');
    Object.entries(report.byModel)
      .sort((a, b) => a[1].avgPriceGap - b[1].avgPriceGap)
      .forEach(([model, data]) => {
        const status = data.avgPriceGap < -200 ? '🟢' : 
                      data.avgPriceGap > 200 ? '🔴' : '🟡';
        console.log(`   ${status} ${model}: ${data.count} 辆, 平均价差 $${Math.round(data.avgPriceGap)}`);
      });
    console.log('');

    console.log('✅ 报告生成完成!');
    console.log('');
  }

  /**
   * 生成飞书消息格式
   */
  generateFeishuMessage(report) {
    const bestDeals = report.bestDeals.slice(0, 3);
    
    let message = `🚗 Car Scout 每日报告\n`;
    message += `📅 ${new Date().toLocaleDateString()}\n\n`;
    
    message += `📊 今日统计:\n`;
    message += `• 总车辆: ${report.summary.total}\n`;
    message += `• 超值交易: ${report.summary.goodDeals} 🟢\n`;
    message += `• 合理价格: ${report.summary.fairDeals} 🟡\n`;
    message += `• 价格偏高: ${report.summary.overpriced} 🔴\n\n`;

    if (bestDeals.length > 0) {
      message += `🏆 今日最佳交易:\n\n`;
      bestDeals.forEach((deal, i) => {
        message += `${i + 1}. ${deal.year} ${deal.make} ${deal.model}\n`;
        message += `   💰 价格: $${deal.price}\n`;
        message += `   📊 预测: $${deal.predictedPrice}\n`;
        message += `   💵 节省: $${Math.abs(deal.priceGap)}\n`;
        message += `   ⭐ 评分: ${deal.dealScore}/100\n`;
        message += `   ${deal.recommendation}\n\n`;
      });
    }

    message += `💡 模型准确率: 89.79%\n`;
    message += `📈 数据来源: TradeMe, 2CheapCars, AutoTrader\n`;

    return message;
  }

  /**
   * 运行完整 Car Scout 流程
   */
  async run() {
    console.log('🚗 Car Scout 集成系统');
    console.log('========================================');
    console.log('');

    try {
      // 1. 初始化
      await this.init();

      // 2. 加载最新数据
      console.log('📂 加载车辆数据...');
      const dataFile = path.join(this.dataDir, 'nz_cars_20260302.json');
      
      if (!fs.existsSync(dataFile)) {
        throw new Error('数据文件不存在');
      }

      const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      const vehicles = data.vehicles || [];
      
      console.log(`   ✅ 加载了 ${vehicles.length} 辆车辆数据`);
      console.log('');

      // 3. 生成报告
      const report = await this.generateCarScoutReport(vehicles);

      // 4. 打印摘要
      this.printReportSummary(report);

      // 5. 生成飞书消息
      const feishuMessage = this.generateFeishuMessage(report);
      
      console.log('📱 飞书消息预览:');
      console.log('========================================');
      console.log(feishuMessage);
      console.log('========================================');
      console.log('');

      // 6. 保存飞书消息
      const messagePath = path.join(__dirname, 'reports', `feishu_message_${new Date().toISOString().split('T')[0]}.txt`);
      fs.writeFileSync(messagePath, feishuMessage);
      console.log(`💾 飞书消息已保存: ${messagePath}`);
      console.log('');

      console.log('✅ Car Scout 集成完成!');
      console.log('');
      console.log('📋 下一步:');
      console.log('   1. 将飞书消息发送到飞书群');
      console.log('   2. 继续抓取更多数据');
      console.log('   3. 优化价格预测模型');

      return {
        report,
        feishuMessage
      };

    } catch (error) {
      console.error('❌ Car Scout 运行失败:', error.message);
      throw error;
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const carScout = new CarScoutIntegration();
  await carScout.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { CarScoutIntegration };
