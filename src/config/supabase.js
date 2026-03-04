/**
 * Supabase 配置
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

// 客户端（用于前端）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 服务端客户端（用于后端操作）
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 数据库表名
export const TABLES = {
  LISTINGS: 'listings',
  VALUATION_MODELS: 'valuation_models',
  TRAINING_REPORTS: 'training_reports',
  SCRAPING_JOBS: 'scraping_jobs'
};

module.exports = {
  supabase,
  supabaseAdmin,
  TABLES
};