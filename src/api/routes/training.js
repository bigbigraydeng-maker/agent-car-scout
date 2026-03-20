/**
 * 训练相关API路由
 */

const express = require('express');
const router = express.Router();
const trainingService = require('../../services/training');

// 开始训练
router.post('/start', async (req, res) => {
  try {
    const result = await trainingService.runTraining();
    
    res.json({
      success: true,
      message: '训练已开始',
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取训练报告
router.get('/reports', async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const reports = await trainingService.getTrainingReports(limit, offset);
    
    res.json({
      success: true,
      reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取最新训练报告
router.get('/reports/latest', async (req, res) => {
  try {
    const report = await trainingService.getLatestTrainingReport();
    
    res.json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取训练状态
router.get('/status', async (req, res) => {
  try {
    const status = await trainingService.getTrainingStatus();
    
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

// 手动触发训练
router.post('/trigger', async (req, res) => {
  try {
    const result = await trainingService.runTraining();
    
    res.json({
      success: true,
      message: '训练已触发',
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
