const { AdvancedPricePredictor } = require('../../../advanced-price-predictor');
const path = require('path');

class PricePredictionSkill {
  constructor() {
    this.predictor = new AdvancedPricePredictor();
    this.modelPath = path.join(__dirname, '../../../data/advanced_price_predictor.json');
    this.isLoaded = false;
    this.modelInfo = {
      accuracy: '89.79%',
      training_data: 164,
      last_trained: '2026-03-02T13:56:29.464Z',
      model_type: 'Random Forest + Tier Strategy'
    };
  }

  async init() {
    try {
      this.predictor.loadModel(this.modelPath);
      this.isLoaded = true;
      console.log('✅ Price Prediction Skill 初始化成功');
      console.log(`   准确率: ${this.modelInfo.accuracy}`);
      console.log(`   训练数据: ${this.modelInfo.training_data} 条`);
    } catch (error) {
      console.error('❌ Price Prediction Skill 初始化失败:', error.message);
      throw error;
    }
  }

  async predictPrice(params) {
    if (!this.isLoaded) {
      await this.init();
    }

    const { make, model, year, mileage, location, seller_type } = params;

    if (!make || !model || !year || !mileage) {
      return {
        success: false,
        error: '缺少必要参数: make, model, year, mileage'
      };
    }

    if (year < 2000 || year > 2026) {
      return {
        success: false,
        error: '年份必须在 2000-2026 之间'
      };
    }

    if (mileage < 0 || mileage > 500000) {
      return {
        success: false,
        error: '里程必须在 0-500000 km 之间'
      };
    }

    try {
      const prediction = this.predictor.predict({
        make: make.toLowerCase(),
        model: model.toLowerCase(),
        year,
        mileage,
        location: location || 'Unknown',
        sellerType: seller_type || 'private'
      });

      return {
        success: true,
        data: {
          predicted_price: prediction.predictedPrice,
          price_range: prediction.priceRange,
          confidence: prediction.confidence,
          tier_predictions: prediction.tierPredictions,
          features: prediction.features
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async batchPredict(params) {
    if (!this.isLoaded) {
      await this.init();
    }

    const { vehicles } = params;

    if (!Array.isArray(vehicles) || vehicles.length === 0) {
      throw new Error('vehicles 参数必须是数组');
    }

    const predictions = [];
    const errors = [];

    for (const vehicle of vehicles) {
      try {
        const prediction = this.predictor.predict({
          make: vehicle.make.toLowerCase(),
          model: vehicle.model.toLowerCase(),
          year: vehicle.year,
          mileage: vehicle.mileage,
          location: vehicle.location || 'Unknown',
          sellerType: vehicle.seller_type || 'private'
        });

        predictions.push({
          vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          predicted_price: prediction.predictedPrice,
          price_range: prediction.priceRange,
          confidence: prediction.confidence,
          tier_predictions: prediction.tierPredictions
        });
      } catch (error) {
        errors.push({
          vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          error: error.message
        });
      }
    }

    const prices = predictions.map(p => p.predicted_price);
    const summary = {
      total: predictions.length,
      avg_price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      price_range: {
        min: Math.min(...prices),
        max: Math.max(...prices)
      }
    };

    return {
      success: true,
      data: {
        predictions,
        summary,
        errors
      }
    };
  }

  async getModelInfo() {
    return {
      success: true,
      data: this.modelInfo
    };
  }

  async execute(action, params) {
    switch (action) {
      case 'predict_price':
        return await this.predictPrice(params);
      case 'batch_predict':
        return await this.batchPredict(params);
      case 'get_model_info':
        return await this.getModelInfo();
      default:
        return {
          success: false,
          error: `未知操作: ${action}`
        };
    }
  }
}

module.exports = { PricePredictionSkill };
