/**
 * 估价相关API路由
 */

const express = require('express');
const router = express.Router();
const valuationService = require('../../services/valuation');

// 车辆估价
router.post('/', async (req, res) => {
  try {
    const { model, year, mileage, location } = req.body;
    
    if (!model || !year) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: model and year'
      });
    }
    
    const result = await valuationService.valuateVehicle(model, year, mileage, location);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取估价模型信息
router.get('/models', async (req, res) => {
  try {
    const { model, year } = req.query;
    const models = await valuationService.getValuationModels(model, year);
    
    res.json({
      success: true,
      models
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取车型列表
router.get('/models/list', async (req, res) => {
  try {
    const models = await valuationService.getModelList();
    
    res.json({
      success: true,
      models
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取估价统计信息
router.get('/stats', async (req, res) => {
  try {
    const stats = await valuationService.getValuationStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;