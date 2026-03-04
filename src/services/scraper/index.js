/**
 * 数据爬取服务
 * 
 * 功能：
 *   1. 从多个平台抓取车辆数据
 *   2. 管理爬取任务
 *   3. 处理爬取结果
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { supabaseAdmin, TABLES } = require('../../config/supabase');

puppeteer.use(StealthPlugin());

// 平台爬取器
const platforms = {
  trademe: require('./platforms/trademe'),
  facebook: require('./platforms/facebook')
};

// 爬取任务管理
class ScrapingJob {
  constructor(id, platform, model, limit) {
    this.id = id;
    this.platform = platform;
    this.model = model;
    this.limit = limit || 50;
    this.status = 'pending';
    this.startTime = new Date();
    this.endTime = null;
    this.totalListings = 0;
    this.errorMessage = null;
  }

  async start() {
    this.status = 'running';
    await this.save();

    try {
      const scraper = platforms[this.platform];
      if (!scraper) {
        throw new Error(`Unsupported platform: ${this.platform}`);
      }

      const listings = await scraper.scrape(this.model, this.limit);
      this.totalListings = listings.length;
      
      // 保存数据到数据库
      if (listings.length > 0) {
        await this.saveListings(listings);
      }

      this.status = 'completed';
      this.endTime = new Date();
    } catch (error) {
      this.status = 'failed';
      this.errorMessage = error.message;
      this.endTime = new Date();
    } finally {
      await this.save();
    }

    return this;
  }

  async save() {
    const { data, error } = await supabaseAdmin
      .from(TABLES.SCRAPING_JOBS)
      .upsert({
        id: this.id,
        platform: this.platform,
        status: this.status,
        start_time: this.startTime.toISOString(),
        end_time: this.endTime ? this.endTime.toISOString() : null,
        total_listings: this.totalListings,
        error_message: this.errorMessage
      });

    if (error) {
      console.error('Failed to save scraping job:', error);
    }
  }

  async saveListings(listings) {
    // 批量插入数据
    const { error } = await supabaseAdmin
      .from(TABLES.LISTINGS)
      .upsert(listings, { onConflict: 'url' });

    if (error) {
      console.error('Failed to save listings:', error);
    }
  }
}

// 爬取服务
const scraperService = {
  // 开始爬取任务
  async startScraping(platform, model, limit) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job = new ScrapingJob(jobId, platform, model, limit);
    
    // 异步执行爬取
    job.start().catch(console.error);
    
    return job;
  },

  // 获取任务状态
  async getJobStatus(jobId) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.SCRAPING_JOBS)
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      throw new Error('Job not found');
    }

    return data;
  },

  // 获取爬取历史
  async getScrapingHistory(limit = 10) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.SCRAPING_JOBS)
      .select('*')
      .order('start_time', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error('Failed to get scraping history');
    }

    return data;
  },

  // 取消爬取任务
  async cancelScraping(jobId) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.SCRAPING_JOBS)
      .update({ status: 'cancelled' })
      .eq('id', jobId)
      .eq('status', 'running');

    if (error) {
      throw new Error('Failed to cancel job');
    }

    return data;
  },

  // 批量爬取
  async batchScrape(platforms = ['trademe', 'facebook'], models = ['Corolla', 'RAV4'], limit = 50) {
    const jobs = [];

    for (const platform of platforms) {
      for (const model of models) {
        const job = await this.startScraping(platform, model, limit);
        jobs.push(job);
        // 避免并发请求过多
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return jobs;
  }
};

module.exports = scraperService;