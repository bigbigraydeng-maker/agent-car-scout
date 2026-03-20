/**
 * Supabase 配置
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl        = process.env.SUPABASE_URL;
const supabaseAnonKey    = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const isConfigured = supabaseUrl && supabaseUrl.startsWith('http');

if (!isConfigured) {
  console.warn('⚠️  Supabase not configured — running in offline mode (no DB)');
}

// 客户端（用于前端）
const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// 服务端客户端（用于后端操作，RLS 已关闭可用 anon key 回退）
const supabaseAdmin = isConfigured ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
}) : null;

// 数据库表名
const TABLES = {
  LISTINGS:     'listings',
  EVALUATIONS:  'auction_evaluations',
  PIPELINE:     'pipeline',
  VALUATION_MODELS: 'valuation_models',
  TRAINING_REPORTS: 'training_reports',
  SCRAPING_JOBS:    'scraping_jobs',
};

module.exports = {
  supabase,
  supabaseAdmin,
  TABLES
};