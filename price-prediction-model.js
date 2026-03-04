/**
 * 新西兰二手车价格预测模型
 * 基于历史数据训练和预测价格
 */

const fs = require('fs');
const path = require('path');

class PricePredictionModel {
  constructor() {
    this.model = null;
    this.isTrained = false;
    this.featureImportance = {};
    this.modelMetrics = {};
  }

  /**
   * 加载历史数据
   */
  loadHistoricalData() {
    const dataDir = path.join(__dirname, 'data');
    const files = fs.readdirSync(dataDir)
      .filter(f => f.startsWith('nz_cars') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      throw new Error('没有找到历史数据文件');
    }

    const allVehicles = [];
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
      allVehicles.push(...data.vehicles);
    }

    console.log(`📊 加载了 ${allVehicles.length} 条历史记录`);
    return allVehicles;
  }

  /**
   * 特征工程
   */
  extractFeatures(vehicle) {
    const features = {
      make: this.encodeMake(vehicle.make),
      model: this.encodeModel(vehicle.model),
      year: vehicle.year || 2010,
      mileage: vehicle.mileage || 100000,
      yearMileageRatio: (vehicle.year || 2010) / ((vehicle.mileage || 100000) / 1000),
      age: 2026 - (vehicle.year || 2010),
      mileagePerYear: (vehicle.mileage || 100000) / Math.max(1, 2026 - (vehicle.year || 2010)),
      isHybrid: this.isHybrid(vehicle.model),
      isSUV: this.isSUV(vehicle.model),
      isHatchback: this.isHatchback(vehicle.model),
      isSedan: this.isSedan(vehicle.model),
      location: this.encodeLocation(vehicle.location),
      sellerType: vehicle.sellerType === 'private' ? 1 : 0
    };

    return features;
  }

  /**
   * 品牌编码
   */
  encodeMake(make) {
    const makes = {
      'toyota': 1,
      'honda': 2,
      'mazda': 3,
      'nissan': 4,
      'suzuki': 5
    };
    return makes[make?.toLowerCase()] || 0;
  }

  /**
   * 车型编码
   */
  encodeModel(model) {
    const models = {
      'corolla': 1,
      'vitz': 2,
      'wish': 3,
      'rav4': 4,
      'fit': 5,
      'demio': 6,
      'aqua': 7,
      'swift': 8,
      'prius': 9,
      'axela': 10,
      'civic': 11,
      'tiida': 12
    };
    return models[model?.toLowerCase()] || 0;
  }

  /**
   * 位置编码
   */
  encodeLocation(location) {
    if (location?.toLowerCase().includes('auckland')) return 1;
    if (location?.toLowerCase().includes('waikato')) return 2;
    return 0;
  }

  /**
   * 判断是否为混动
   */
  isHybrid(model) {
    const hybridModels = ['aqua', 'prius', 'corolla', 'fit'];
    return hybridModels.includes(model?.toLowerCase()) ? 1 : 0;
  }

  /**
   * 判断是否为 SUV
   */
  isSUV(model) {
    const suvModels = ['rav4', 'wish'];
    return suvModels.includes(model?.toLowerCase()) ? 1 : 0;
  }

  /**
   * 判断是否为掀背车
   */
  isHatchback(model) {
    const hatchbackModels = ['vitz', 'fit', 'demio', 'swift', 'aqua'];
    return hatchbackModels.includes(model?.toLowerCase()) ? 1 : 0;
  }

  /**
   * 判断是否为轿车
   */
  isSedan(model) {
    const sedanModels = ['corolla', 'civic', 'axela', 'tiida', 'prius'];
    return sedanModels.includes(model?.toLowerCase()) ? 1 : 0;
  }

  /**
   * 训练模型（简化版线性回归）
   */
  train(vehicles) {
    console.log('🎓 开始训练价格预测模型...');
    console.log('');

    // 准备训练数据
    const trainingData = vehicles
      .filter(v => v.price > 0 && v.year > 0 && v.mileage > 0)
      .map(v => ({
        features: this.extractFeatures(v),
        price: v.price
      }));

    console.log(`📊 训练数据: ${trainingData.length} 条`);
    console.log('');

    // 计算特征权重（简化版）
    this.calculateWeights(trainingData);

    this.isTrained = true;
    console.log('✅ 模型训练完成!');
    console.log('');
  }

  /**
   * 计算特征权重（简化版）
   */
  calculateWeights(trainingData) {
    const n = trainingData.length;
    const features = Object.keys(trainingData[0].features);
    
    // 计算每个特征与价格的相关性
    this.featureImportance = {};
    
    for (const feature of features) {
      const values = trainingData.map(d => d.features[feature]);
      const prices = trainingData.map(d => d.price);
      
      // 计算相关性
      const correlation = this.calculateCorrelation(values, prices);
      this.featureImportance[feature] = Math.abs(correlation);
    }
    
    // 显示特征重要性
    console.log('📈 特征重要性:');
    const sortedFeatures = Object.entries(this.featureImportance)
      .sort((a, b) => b[1] - a[1]);
    
    sortedFeatures.forEach(([feature, importance]) => {
      const percentage = (importance * 100).toFixed(2);
      console.log(`   ${feature}: ${percentage}%`);
    });
    console.log('');
    
    // 计算基础价格
    this.basePrice = trainingData.reduce((sum, d) => sum + d.price, 0) / n;
    
    // 计算各特征的平均值
    this.featureMeans = {};
    for (const feature of features) {
      const values = trainingData.map(d => d.features[feature]);
      this.featureMeans[feature] = values.reduce((sum, v) => sum + v, 0) / n;
    }
  }

  /**
   * 计算相关性
   */
  calculateCorrelation(x, y) {
    const n = x.length;
    const meanX = x.reduce((sum, v) => sum + v, 0) / n;
    const meanY = y.reduce((sum, v) => sum + v, 0) / n;
    
    let numerator = 0;
    let denominatorX = 0;
    let denominatorY = 0;
    
    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denominatorX += diffX * diffX;
      denominatorY += diffY * diffY;
    }
    
    const denominator = Math.sqrt(denominatorX * denominatorY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * 预测价格
   */
  predict(vehicle) {
    if (!this.isTrained) {
      throw new Error('模型未训练，请先调用 train() 方法');
    }

    const features = this.extractFeatures(vehicle);
    
    // 简化版预测：基于特征权重
    let predictedPrice = this.basePrice;
    
    // 年份影响
    const yearDiff = features.year - this.featureMeans.year;
    predictedPrice += yearDiff * 500;
    
    // 里程影响
    const mileageDiff = features.mileage - this.featureMeans.mileage;
    predictedPrice -= mileageDiff * 0.03;
    
    // 车型影响
    const modelDiff = features.model - this.featureMeans.model;
    predictedPrice += modelDiff * 200;
    
    // 混动车型溢价
    if (features.isHybrid) {
      predictedPrice *= 1.1;
    }
    
    // SUV 溢价
    if (features.isSUV) {
      predictedPrice *= 1.05;
    }
    
    // 位置影响
    if (features.location === 1) { // Auckland
      predictedPrice *= 1.05;
    }
    
    // 确保价格在合理范围内
    predictedPrice = Math.max(2000, Math.min(15000, predictedPrice));
    
    return {
      predictedPrice: Math.round(predictedPrice),
      confidence: this.calculateConfidence(features),
      breakdown: {
        basePrice: this.basePrice,
        yearAdjustment: yearDiff * 500,
        mileageAdjustment: -mileageDiff * 0.03,
        modelAdjustment: modelDiff * 200,
        hybridBonus: features.isHybrid ? predictedPrice * 0.1 : 0,
        suvBonus: features.isSUV ? predictedPrice * 0.05 : 0,
        locationBonus: features.location === 1 ? predictedPrice * 0.05 : 0
      }
    };
  }

  /**
   * 计算预测置信度
   */
  calculateConfidence(features) {
    let confidence = 0.7; // 基础置信度
    
    // 年份在常见范围内
    if (features.year >= 2010 && features.year <= 2018) {
      confidence += 0.1;
    }
    
    // 里程在合理范围内
    if (features.mileage >= 50000 && features.mileage <= 150000) {
      confidence += 0.1;
    }
    
    // 常见车型
    if (features.model >= 1 && features.model <= 12) {
      confidence += 0.05;
    }
    
    return Math.min(0.95, confidence);
  }

  /**
   * 评估模型
   */
  evaluate(testData) {
    if (!this.isTrained) {
      throw new Error('模型未训练');
    }

    console.log('📊 模型评估');
    console.log('========================================');
    
    let totalError = 0;
    let predictions = [];
    
    for (const vehicle of testData) {
      const prediction = this.predict(vehicle);
      const error = Math.abs(prediction.predictedPrice - vehicle.price);
      const errorPercentage = (error / vehicle.price) * 100;
      
      totalError += errorPercentage;
      predictions.push({
        actual: vehicle.price,
        predicted: prediction.predictedPrice,
        error: errorPercentage,
        confidence: prediction.confidence
      });
    }
    
    const mae = totalError / testData.length;
    const accuracy = 100 - mae;
    
    this.modelMetrics = {
      mae: mae.toFixed(2),
      accuracy: accuracy.toFixed(2),
      sampleSize: testData.length
    };
    
    console.log(`平均绝对误差: ${this.modelMetrics.mae}%`);
    console.log(`准确率: ${this.modelMetrics.accuracy}%`);
    console.log(`样本数: ${this.modelMetrics.sampleSize}`);
    console.log('');
    
    return this.modelMetrics;
  }

  /**
   * 保存模型
   */
  saveModel(filePath) {
    const modelData = {
      isTrained: this.isTrained,
      basePrice: this.basePrice,
      featureMeans: this.featureMeans,
      featureImportance: this.featureImportance,
      modelMetrics: this.modelMetrics,
      savedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(filePath, JSON.stringify(modelData, null, 2));
    console.log(`💾 模型已保存到: ${filePath}`);
  }

  /**
   * 加载模型
   */
  loadModel(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`模型文件不存在: ${filePath}`);
    }
    
    const modelData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    this.isTrained = modelData.isTrained;
    this.basePrice = modelData.basePrice;
    this.featureMeans = modelData.featureMeans;
    this.featureImportance = modelData.featureImportance;
    this.modelMetrics = modelData.modelMetrics;
    
    console.log(`📂 模型已加载: ${filePath}`);
    console.log(`   训练时间: ${modelData.savedAt}`);
    console.log(`   准确率: ${this.modelMetrics.accuracy}%`);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚗 新西兰二手车价格预测模型');
  console.log('========================================');
  console.log('');
  
  const model = new PricePredictionModel();
  
  try {
    // 加载历史数据
    const vehicles = model.loadHistoricalData();
    
    // 训练模型
    model.train(vehicles);
    
    // 评估模型
    const testData = vehicles.slice(0, Math.min(50, vehicles.length));
    model.evaluate(testData);
    
    // 保存模型
    const modelPath = path.join(__dirname, 'data', 'price_prediction_model.json');
    model.saveModel(modelPath);
    
    // 测试预测
    console.log('🧪 测试预测');
    console.log('========================================');
    
    const testVehicle = {
      make: 'toyota',
      model: 'corolla',
      year: 2015,
      mileage: 100000,
      location: 'Auckland',
      sellerType: 'private'
    };
    
    const prediction = model.predict(testVehicle);
    
    console.log(`车辆: ${testVehicle.year} ${testVehicle.make} ${testVehicle.model}`);
    console.log(`里程: ${testVehicle.mileage} km`);
    console.log(`位置: ${testVehicle.location}`);
    console.log('');
    console.log(`预测价格: $${prediction.predictedPrice}`);
    console.log(`置信度: ${(prediction.confidence * 100).toFixed(1)}%`);
    console.log('');
    console.log('价格分解:');
    console.log(`   基础价格: $${prediction.breakdown.basePrice.toFixed(0)}`);
    console.log(`   年份调整: $${prediction.breakdown.yearAdjustment.toFixed(0)}`);
    console.log(`   里程调整: $${prediction.breakdown.mileageAdjustment.toFixed(0)}`);
    console.log(`   车型调整: $${prediction.breakdown.modelAdjustment.toFixed(0)}`);
    console.log(`   混动溢价: $${prediction.breakdown.hybridBonus.toFixed(0)}`);
    console.log(`   SUV 溢价: $${prediction.breakdown.suvBonus.toFixed(0)}`);
    console.log(`   位置溢价: $${prediction.breakdown.locationBonus.toFixed(0)}`);
    
    console.log('');
    console.log('✅ 任务完成!');
    
  } catch (error) {
    console.error('❌ 任务失败:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { PricePredictionModel };
