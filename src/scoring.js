/**
 * Car Scout - Scoring Module
 * Re-exports from scoring-v3.js for compatibility
 */

const scoring = require('./scoring-v3');

module.exports = {
  scoreVehicles: scoring.scoreVehicles,
  hasMechanicalIssue: scoring.hasMechanicalIssue,
  calculateFlipScore: scoring.calculateFlipScore,
  estimateSellPrice: scoring.estimateSellPrice,
  estimatePrepCost: scoring.estimatePrepCost,
  detectUrgentSignals: scoring.detectUrgentSignals,
  getPredictedPrice: scoring.getPredictedPrice,
  EXCLUDE_KEYWORDS: scoring.EXCLUDE_KEYWORDS,
  PRICING_CONFIG: scoring.PRICING_CONFIG
};
