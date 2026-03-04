/**
 * 爬取相关API路由
 */

const express = require('express');
const router = express.Router();
const scraperService = require('../../services/scraper');

// 开始爬取任务
router.post('/start', async (req, res) => {
  try {
    const { platform, model, limit } = req.body;
    
    const job = await scraperService.startScraping(platform, model, limit);
    
    res.json({
      success: true,
      message: '爬取任务已开始',
      jobId: job.id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取爬取任务状态
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await scraperService.getJobStatus(jobId);
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取爬取历史
router.get('/history', async (req, res) => {
  try {
    const history = await scraperService.getScrapingHistory();
    
    res.json({
      success: true,
      history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 取消爬取任务
router.post('/cancel/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    await scraperService.cancelScraping(jobId);
    
    res.json({
      success: true,
      message: '爬取任务已取消'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;