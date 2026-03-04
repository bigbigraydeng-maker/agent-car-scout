/**
 * 高级二手车价格预测器
 * 使用随机森林 + 特征工程 + 分层模型
 */

const fs = require('fs');
const path = require('path');

class AdvancedPricePredictor {
  constructor() {
    this.models = {
      low: null,    // $2,000 - $4,500
      mid: null,    // $4,500 - $6,000
      high: null    // $6,000 - $7,500
    };
    this.isTrained = false;
    this.featureStats = {};
    this.modelPerformance = {};
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
   * 高级特征工程
   */
  extractFeatures(vehicle) {
    const year = vehicle.year || 2010;
    const mileage = vehicle.mileage || 100000;
    const age = 2026 - year;
    const model = (vehicle.model || '').toLowerCase();
    const make = (vehicle.make || '').toLowerCase();

    const features = {
      // 基础特征
      year: year,
      mileage: mileage,
      age: age,
      
      // 交互特征
      mileagePerYear: mileage / Math.max(1, age),
      yearSquared: year * year,
      mileageSquared: mileage * mileage,
      ageSquared: age * age,
      
      // 对数特征（处理长尾分布）
      logMileage: Math.log(Math.max(1, mileage)),
      logAge: Math.log(Math.max(1, age)),
      
      // 比率特征
      yearMileageRatio: year / (mileage / 1000),
      ageMileageRatio: age / (mileage / 10000),
      
      // 品牌编码（使用目标编码）
      makeToyota: make === 'toyota' ? 1 : 0,
      makeHonda: make === 'honda' ? 1 : 0,
      makeMazda: make === 'mazda' ? 1 : 0,
      makeNissan: make === 'nissan' ? 1 : 0,
      makeSuzuki: make === 'suzuki' ? 1 : 0,
      
      // 车型编码
      modelCorolla: model === 'corolla' ? 1 : 0,
      modelVitz: model === 'vitz' ? 1 : 0,
      modelWish: model === 'wish' ? 1 : 0,
      modelRav4: model === 'rav4' ? 1 : 0,
      modelFit: model === 'fit' ? 1 : 0,
      modelDemio: model === 'demio' ? 1 : 0,
      modelAqua: model === 'aqua' ? 1 : 0,
      modelSwift: model === 'swift' ? 1 : 0,
      modelPrius: model === 'prius' ? 1 : 0,
      modelAxela: model === 'axela' ? 1 : 0,
      modelCivic: model === 'civic' ? 1 : 0,
      modelTiida: model === 'tiida' ? 1 : 0,
      
      // 车身类型
      isHatchback: ['vitz', 'fit', 'demio', 'swift', 'aqua'].includes(model) ? 1 : 0,
      isSedan: ['corolla', 'civic', 'axela', 'tiida', 'prius'].includes(model) ? 1 : 0,
      isSUV: ['rav4', 'wish'].includes(model) ? 1 : 0,
      
      // 混动车型
      isHybrid: ['aqua', 'prius', 'corolla', 'fit'].includes(model) ? 1 : 0,
      
      // 热门车型
      isPopular: ['corolla', 'aqua', 'swift', 'fit'].includes(model) ? 1 : 0,
      
      // 位置
      locationAuckland: (vehicle.location || '').toLowerCase().includes('auckland') ? 1 : 0,
      locationWaikato: (vehicle.location || '').toLowerCase().includes('waikato') ? 1 : 0,
      
      // 卖家类型
      isPrivate: vehicle.sellerType === 'private' ? 1 : 0,
      
      // 价格区间特征（用于分层）
      priceTier: this.getPriceTier(vehicle.price)
    };

    return features;
  }

  /**
   * 获取价格层级
   */
  getPriceTier(price) {
    if (price <= 4500) return 'low';
    if (price <= 6000) return 'mid';
    return 'high';
  }

  /**
   * 标准化特征
   */
  normalizeFeatures(features, stats) {
    const normalized = {};
    for (const [key, value] of Object.entries(features)) {
      if (stats[key]) {
        const { mean, std } = stats[key];
        normalized[key] = std > 0 ? (value - mean) / std : 0;
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  }

  /**
   * 计算特征统计
   */
  calculateFeatureStats(data) {
    const stats = {};
    const featureKeys = Object.keys(data[0].features);
    
    for (const key of featureKeys) {
      const values = data.map(d => d.features[key]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);
      
      stats[key] = { mean, std, min: Math.min(...values), max: Math.max(...values) };
    }
    
    return stats;
  }

  /**
   * 随机森林回归树节点
   */
  createTreeNode(data, features, depth = 0, maxDepth = 10, minSamples = 5) {
    const prices = data.map(d => d.price);
    const meanPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    // 停止条件
    if (depth >= maxDepth || data.length < minSamples || prices.length < 2) {
      return { isLeaf: true, prediction: meanPrice, samples: data.length };
    }

    // 寻找最佳分裂
    let bestFeature = null;
    let bestThreshold = null;
    let bestMse = Infinity;

    // 随机选择特征子集
    const featureSubset = features
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.max(1, Math.floor(features.length * 0.7)));

    for (const feature of featureSubset) {
      const values = data.map(d => d.features[feature]).sort((a, b) => a - b);
      
      // 尝试多个阈值
      for (let i = 1; i < values.length - 1; i += Math.max(1, Math.floor(values.length / 10))) {
        const threshold = values[i];
        const leftData = data.filter(d => d.features[feature] <= threshold);
        const rightData = data.filter(d => d.features[feature] > threshold);
        
        if (leftData.length < minSamples || rightData.length < minSamples) continue;
        
        const leftPrices = leftData.map(d => d.price);
        const rightPrices = rightData.map(d => d.price);
        const leftMean = leftPrices.reduce((a, b) => a + b, 0) / leftPrices.length;
        const rightMean = rightPrices.reduce((a, b) => a + b, 0) / rightPrices.length;
        
        const leftMse = leftPrices.reduce((sum, p) => sum + Math.pow(p - leftMean, 2), 0);
        const rightMse = rightPrices.reduce((sum, p) => sum + Math.pow(p - rightMean, 2), 0);
        const totalMse = (leftMse + rightMse) / data.length;
        
        if (totalMse < bestMse) {
          bestMse = totalMse;
          bestFeature = feature;
          bestThreshold = threshold;
        }
      }
    }

    // 如果没有找到好的分裂，返回叶子节点
    if (!bestFeature) {
      return { isLeaf: true, prediction: meanPrice, samples: data.length };
    }

    // 递归创建子树
    const leftData = data.filter(d => d.features[bestFeature] <= bestThreshold);
    const rightData = data.filter(d => d.features[bestFeature] > bestThreshold);

    return {
      isLeaf: false,
      feature: bestFeature,
      threshold: bestThreshold,
      left: this.createTreeNode(leftData, features, depth + 1, maxDepth, minSamples),
      right: this.createTreeNode(rightData, features, depth + 1, maxDepth, minSamples),
      samples: data.length
    };
  }

  /**
   * 预测单棵树
   */
  predictTree(node, features) {
    if (node.isLeaf) {
      return node.prediction;
    }
    
    if (features[node.feature] <= node.threshold) {
      return this.predictTree(node.left, features);
    } else {
      return this.predictTree(node.right, features);
    }
  }

  /**
   * 训练随机森林
   */
  trainRandomForest(data, nTrees = 50) {
    console.log(`🌲 训练随机森林 (${nTrees} 棵树)...`);
    
    const trees = [];
    const featureKeys = Object.keys(data[0].features);
    
    for (let i = 0; i < nTrees; i++) {
      // Bootstrap 采样
      const bootstrapData = [];
      for (let j = 0; j < data.length; j++) {
        bootstrapData.push(data[Math.floor(Math.random() * data.length)]);
      }
      
      // 训练单棵树
      const tree = this.createTreeNode(bootstrapData, featureKeys, 0, 12, 3);
      trees.push(tree);
      
      if ((i + 1) % 10 === 0) {
        console.log(`   ✅ 已训练 ${i + 1}/${nTrees} 棵树`);
      }
    }
    
    return trees;
  }

  /**
   * 训练分层模型
   */
  train(vehicles) {
    console.log('🎓 开始训练高级价格预测模型...');
    console.log('');

    // 准备训练数据
    const allData = vehicles
      .filter(v => v.price > 0 && v.year > 0 && v.mileage > 0)
      .map(v => ({
        features: this.extractFeatures(v),
        price: v.price
      }));

    console.log(`📊 总训练数据: ${allData.length} 条`);
    console.log('');

    // 计算特征统计
    this.featureStats = this.calculateFeatureStats(allData);

    // 按价格分层
    const tierData = {
      low: allData.filter(d => d.price <= 4500),
      mid: allData.filter(d => d.price > 4500 && d.price <= 6000),
      high: allData.filter(d => d.price > 6000)
    };

    console.log('📊 分层数据分布:');
    console.log(`   低价层 ($2,000-$4,500): ${tierData.low.length} 条`);
    console.log(`   中价层 ($4,500-$6,000): ${tierData.mid.length} 条`);
    console.log(`   高价层 ($6,000-$7,500): ${tierData.high.length} 条`);
    console.log('');

    // 训练每个价格层的模型
    for (const [tier, data] of Object.entries(tierData)) {
      if (data.length >= 10) {
        console.log(`🌲 训练 ${tier} 价格层模型...`);
        this.models[tier] = this.trainRandomForest(data, 30);
        console.log(`   ✅ ${tier} 模型训练完成 (${data.length} 条数据)`);
      } else {
        console.log(`   ⚠️  ${tier} 价格层数据不足 (${data.length} 条)，跳过`);
      }
    }

    this.isTrained = true;
    console.log('');
    console.log('✅ 所有模型训练完成!');
    console.log('');
  }

  /**
   * 预测价格
   */
  predict(vehicle) {
    if (!this.isTrained) {
      throw new Error('模型未训练');
    }

    const features = this.extractFeatures(vehicle);
    const normalizedFeatures = this.normalizeFeatures(features, this.featureStats);

    // 使用所有可用模型进行预测
    const predictions = [];
    const confidences = [];

    for (const [tier, trees] of Object.entries(this.models)) {
      if (trees && trees.length > 0) {
        // 随机森林预测（平均所有树的预测）
        const treePredictions = trees.map(tree => this.predictTree(tree, normalizedFeatures));
        const tierPrediction = treePredictions.reduce((a, b) => a + b, 0) / treePredictions.length;
        
        // 计算置信度（基于树的预测方差）
        const variance = treePredictions.reduce((sum, p) => sum + Math.pow(p - tierPrediction, 2), 0) / treePredictions.length;
        const confidence = Math.max(0.5, 1 - Math.sqrt(variance) / tierPrediction);
        
        predictions.push({ tier, price: tierPrediction, confidence });
        confidences.push(confidence);
      }
    }

    if (predictions.length === 0) {
      throw new Error('没有可用的预测模型');
    }

    // 加权平均所有预测
    const totalWeight = confidences.reduce((a, b) => a + b, 0);
    const weightedPrice = predictions.reduce((sum, p) => sum + p.price * p.confidence, 0) / totalWeight;
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

    // 确定推荐价格区间
    const minPrice = Math.min(...predictions.map(p => p.price));
    const maxPrice = Math.max(...predictions.map(p => p.price));

    return {
      predictedPrice: Math.round(weightedPrice),
      priceRange: {
        min: Math.round(minPrice * 0.95),
        max: Math.round(maxPrice * 1.05)
      },
      confidence: Math.round(avgConfidence * 100) / 100,
      tierPredictions: predictions,
      features: {
        year: features.year,
        mileage: features.mileage,
        age: features.age,
        isHybrid: features.isHybrid,
        isPopular: features.isPopular
      }
    };
  }

  /**
   * 评估模型
   */
  evaluate(testData) {
    console.log('📊 模型评估');
    console.log('========================================');

    let totalError = 0;
    let totalAbsError = 0;
    const errors = [];

    for (const vehicle of testData) {
      try {
        const prediction = this.predict(vehicle);
        const error = prediction.predictedPrice - vehicle.price;
        const absError = Math.abs(error);
        const errorPercentage = (absError / vehicle.price) * 100;

        totalError += errorPercentage;
        totalAbsError += absError;
        errors.push(errorPercentage);
      } catch (e) {
        console.log(`   ⚠️  预测失败: ${e.message}`);
      }
    }

    const mae = totalError / errors.length;
    const rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
    const accuracy = 100 - mae;

    this.modelPerformance = {
      mae: mae.toFixed(2),
      rmse: rmse.toFixed(2),
      accuracy: accuracy.toFixed(2),
      sampleSize: errors.length,
      meanAbsError: (totalAbsError / errors.length).toFixed(0)
    };

    console.log(`平均绝对误差 (MAE): ${this.modelPerformance.mae}%`);
    console.log(`均方根误差 (RMSE): ${this.modelPerformance.rmse}%`);
    console.log(`平均绝对误差 ($): $${this.modelPerformance.meanAbsError}`);
    console.log(`准确率: ${this.modelPerformance.accuracy}%`);
    console.log(`测试样本数: ${this.modelPerformance.sampleSize}`);
    console.log('');

    return this.modelPerformance;
  }

  /**
   * 保存模型
   */
  saveModel(filePath) {
    const modelData = {
      models: this.models,
      featureStats: this.featureStats,
      modelPerformance: this.modelPerformance,
      isTrained: this.isTrained,
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

    this.models = modelData.models;
    this.featureStats = modelData.featureStats;
    this.modelPerformance = modelData.modelPerformance;
    this.isTrained = modelData.isTrained;

    console.log(`📂 模型已加载: ${filePath}`);
    console.log(`   训练时间: ${modelData.savedAt}`);
    console.log(`   准确率: ${this.modelPerformance.accuracy}%`);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚗 高级二手车价格预测器');
  console.log('========================================');
  console.log('');

  const predictor = new AdvancedPricePredictor();

  try {
    // 加载历史数据
    const vehicles = predictor.loadHistoricalData();

    // 训练模型
    predictor.train(vehicles);

    // 评估模型
    const testData = vehicles.slice(0, Math.min(50, vehicles.length));
    predictor.evaluate(testData);

    // 保存模型
    const modelPath = path.join(__dirname, 'data', 'advanced_price_predictor.json');
    predictor.saveModel(modelPath);

    // 测试预测
    console.log('🧪 测试预测');
    console.log('========================================');

    const testVehicles = [
      { make: 'toyota', model: 'corolla', year: 2015, mileage: 100000, location: 'Auckland', sellerType: 'private' },
      { make: 'honda', model: 'fit', year: 2012, mileage: 80000, location: 'Auckland', sellerType: 'private' },
      { make: 'toyota', model: 'aqua', year: 2014, mileage: 120000, location: 'Waikato', sellerType: 'private' }
    ];

    for (const vehicle of testVehicles) {
      const prediction = predictor.predict(vehicle);
      
      console.log(`\n车辆: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
      console.log(`里程: ${vehicle.mileage} km | 位置: ${vehicle.location}`);
      console.log(`预测价格: $${prediction.predictedPrice}`);
      console.log(`价格区间: $${prediction.priceRange.min} - $${prediction.priceRange.max}`);
      console.log(`置信度: ${(prediction.confidence * 100).toFixed(1)}%`);
      console.log(`分层预测:`, prediction.tierPredictions.map(p => 
        `${p.tier}: $${Math.round(p.price)} (${(p.confidence * 100).toFixed(0)}%)`
      ).join(' | '));
    }

    console.log('');
    console.log('✅ 任务完成!');

  } catch (error) {
    console.error('❌ 任务失败:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  main();
}

module.exports = { AdvancedPricePredictor };
