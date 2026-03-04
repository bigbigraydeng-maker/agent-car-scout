const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 数据库表名常量
const TABLES = {
  LISTINGS: 'listings',
  SCRAPING_JOBS: 'scraping_jobs',
  TRAINING_REPORTS: 'training_reports',
  VALUATION_MODELS: 'valuation_models',
  SOLD_LISTINGS: 'sold_listings',
  BLACKLIST: 'blacklist'
};

// 为了兼容性，同时导出 supabaseAdmin 和 supabase
module.exports = { 
  supabase,
  supabaseAdmin: supabase,
  TABLES 
};
