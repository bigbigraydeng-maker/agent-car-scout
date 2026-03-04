/**
 * 自动训练服务
 * 
 * 功能：
 *   1. 定期执行多平台数据爬取
 *   2. 更新市场估价模型
 *   3. 生成训练报告
 *   4. 管理训练任务
 */

const { supabaseAdmin, TABLES } = require('../../config/supabase');
const scraperService = require('../scraper');
const valuationService = require('../valuation');

// 配置
const TRAINING_INTERVAL = process.env.TRAINING_INTERVAL || 24 * 60 * 60 * 1000; // 24小时
const MODELS_TO_SCRAPE = ['Corolla', 'RAV4', 'Vitz', 'Aqua', 'Prius', 'Demio', 'Swift'];
const PLATFORMS = ['trademe', 'facebook'];

// 训练服务
const trainingService = {
  trainingInterval: null,

  // 开始训练
  async runTraining() {
    console.log('🚀 开始自动训练流程...');
    
    try {
      // 1. 执行多平台数据爬取
      console.log('📡 执行多平台数据爬取...');
      const jobs = await scraperService.batchScrape(PLATFORMS, MODELS_TO_SCRAPE, 30);
      
      // 2. 等待爬取完成（简化处理，实际应该轮询状态）
      await new Promise(resolve => setTimeout(resolve, 60000)); // 等待1分钟
      
      // 3. 更新估价模型
      console.log('📊 更新估价模型...');
      await this.updateValuationModels();
      
      // 4. 生成训练报告
      console.log('📈 生成训练报告...');
      const report = await this.generateTrainingReport();
      
      // 5. 清理旧数据
      console.log('🧹 清理旧数据...');
      await this.cleanupOldData();
      
      console.log('🎉 训练流程完成！');
      return {
        success: true,
        reportId: report.report_id,
        message: 'Training completed successfully'
      };
    } catch (error) {
      console.error('❌ 训练流程失败:', error);
      throw error;
    }
  },

  // 更新估价模型
  async updateValuationModels() {
    for (const model of MODELS_TO_SCRAPE) {
      // 获取最近5年的车型数据
      for (let year = new Date().getFullYear(); year >= 2010; year--) {
        try {
          const valuation = await valuationService.valuateVehicle(model, year);
          if (valuation) {
            await valuationService.saveValuationModel({
              model_name: model,
              year: year,
              baseline_price: valuation.price,
              confidence: valuation.confidence,
              sample_count: valuation.sampleCount,
              platform_counts: valuation.platformCounts
            });
            console.log(`✅ 更新模型: ${model} ${year}`);
          }
        } catch (error) {
          console.error(`❌ 更新模型失败: ${model} ${year}`, error);
        }
      }
    }
  },

  // 生成训练报告
  async generateTrainingReport() {
    // 获取最新的爬取任务
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from(TABLES.SCRAPING_JOBS)
      .select('*')
      .order('start_time', { ascending: false })
      .limit(10);

    if (jobsError) {
      throw new Error('Failed to fetch scraping jobs');
    }

    // 获取最新的 listings
    const { data: listings, error: listingsError } = await supabaseAdmin
      .from(TABLES.LISTINGS)
      .select('*')
      .order('scraped_at', { ascending: false })
      .limit(1000);

    if (listingsError) {
      throw new Error('Failed to fetch listings');
    }

    // 统计数据
    const stats = {
      totalListings: listings.length,
      platforms: [...new Set(listings.map(l => l.platform))],
      modelDistribution: {},
      yearDistribution: {},
      priceDistribution: {
        min: Infinity,
        max: 0,
        average: 0
      }
    };

    let totalPrice = 0;
    listings.forEach(listing => {
      // 车型分布
      stats.modelDistribution[listing.model] = (stats.modelDistribution[listing.model] || 0) + 1;
      
      // 年份分布
      stats.yearDistribution[listing.year] = (stats.yearDistribution[listing.year] || 0) + 1;
      
      // 价格统计
      if (listing.price < stats.priceDistribution.min) stats.priceDistribution.min = listing.price;
      if (listing.price > stats.priceDistribution.max) stats.priceDistribution.max = listing.price;
      totalPrice += listing.price;
    });

    if (listings.length > 0) {
      stats.priceDistribution.average = Math.round(totalPrice / listings.length);
    }

    // 平台分布
    const platformDistribution = {};
    listings.forEach(listing => {
      platformDistribution[listing.platform] = (platformDistribution[listing.platform] || 0) + 1;
    });

    // 健康状态
    const healthStatus = this.assessDataHealth(stats);

    // 创建报告
    const reportId = `report_${Date.now()}`;
    const report = {
      report_id: reportId,
      data_source: 'multi-platform',
      total_listings: stats.totalListings,
      platforms: stats.platforms,
      statistics: stats,
      platform_distribution: platformDistribution,
      health_status: healthStatus,
      generated_at: new Date().toISOString()
    };

    // 保存报告
    const { error: saveError } = await supabaseAdmin
      .from(TABLES.TRAINING_REPORTS)
      .insert(report);

    if (saveError) {
      throw new Error('Failed to save training report');
    }

    return report;
  },

  // 评估数据健康状态
  assessDataHealth(stats) {
    if (stats.totalListings < 50) return 'poor';
    if (stats.totalListings < 100) return 'fair';
    if (stats.platforms.length < 2) return 'fair';
    return 'good';
  },

  // 清理旧数据
  async cleanupOldData() {
    // 删除30天前的爬取任务
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    await supabaseAdmin
      .from(TABLES.SCRAPING_JOBS)
      .delete()
      .lt('start_time', thirtyDaysAgo);

    // 删除90天前的训练报告
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    
    await supabaseAdmin
      .from(TABLES.TRAINING_REPORTS)
      .delete()
      .lt('generated_at', ninetyDaysAgo);

    console.log('✅ 旧数据清理完成');
  },

  // 启动定时训练
  startScheduledTraining() {
    console.log(`⏰ 启动定时训练，每 ${TRAINING_INTERVAL / (1000 * 60 * 60)} 小时执行一次`);
    
    // 立即执行一次
    this.runTraining().catch(console.error);
    
    // 设置定时执行
    this.trainingInterval = setInterval(() => {
      console.log('⏰ 执行定时训练...');
      this.runTraining().catch(console.error);
    }, TRAINING_INTERVAL);
  },

  // 停止定时训练
  stopScheduledTraining() {
    if (this.trainingInterval) {
      clearInterval(this.trainingInterval);
      console.log('⏹️ 定时训练已停止');
    }
  },

  // 获取训练报告
  async getTrainingReports(limit = 10, offset = 0) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.TRAINING_REPORTS)
      .select('*')
      .order('generated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error('Failed to fetch training reports');
    }

    return data;
  },

  // 获取最新训练报告
  async getLatestTrainingReport() {
    const { data, error } = await supabaseAdmin
      .from(TABLES.TRAINING_REPORTS)
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      throw new Error('Failed to fetch latest training report');
    }

    return data;
  },

  // 获取训练状态
  async getTrainingStatus() {
    // 获取最近的训练报告
    const latestReport = await this.getLatestTrainingReport().catch(() => null);
    
    // 获取最近的爬取任务
    const { data: recentJobs, error: jobsError } = await supabaseAdmin
      .from(TABLES.SCRAPING_JOBS)
      .select('*')
      .order('start_time', { ascending: false })
      .limit(5);

    return {
      latestReport,
      recentJobs: jobsError ? [] : recentJobs,
      nextTrainingTime: new Date(Date.now() + TRAINING_INTERVAL).toISOString(),
      status: this.trainingInterval ? 'running' : 'stopped'
    };
  }
};

module.exports = trainingService;