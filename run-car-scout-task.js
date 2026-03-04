/**
 * Car Scout 任务执行脚本
 * 执行 TradeMe 数据抓取、评分和飞书发送
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const CONFIG = {
  carScoutDir: 'C:\\Users\\Zhong\\.openclaw\\workspace\\skills\\car-scout',
  dataFile: 'vehicles_20260228.json',
  outputDir: path.join(__dirname, 'car-scout-output')
};

/**
 * 执行命令
 */
function executeCommand(command, cwd) {
  console.log(`执行命令: ${command}`);
  try {
    const output = execSync(command, { cwd, stdio: 'inherit', encoding: 'utf8' });
    console.log('命令执行成功');
    return output;
  } catch (error) {
    console.error('命令执行失败:', error.message);
    throw error;
  }
}

/**
 * 检查目录
 */
function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`创建目录: ${dir}`);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('Car Scout 任务执行');
  console.log('========================================\n');
  
  try {
    // 确保输出目录存在
    ensureDirectory(CONFIG.outputDir);
    
    console.log('📁 切换到 Car Scout 目录...');
    console.log(`   目录: ${CONFIG.carScoutDir}`);
    console.log('');
    
    // Step 1: 运行评分
    console.log('🚗 Step 1: 运行 Flip Score 评分');
    console.log('----------------------------------------');
    executeCommand('node src/run-flip.js', CONFIG.carScoutDir);
    console.log('');
    
    // Step 2: 发送飞书
    console.log('📱 Step 2: 发送飞书报告');
    console.log('----------------------------------------');
    executeCommand('node src/send-feishu.js', CONFIG.carScoutDir);
    console.log('');
    
    // 检查结果文件
    console.log('📊 检查结果文件:');
    const dataFiles = fs.readdirSync(path.join(CONFIG.carScoutDir, 'data'));
    const flipFiles = dataFiles.filter(file => file.includes('flip'));
    
    console.log('   生成的文件:');
    flipFiles.forEach(file => {
      console.log(`   - ${file}`);
    });
    console.log('');
    
    console.log('✅ 任务完成!');
    console.log('');
    console.log('💡 结果:');
    console.log('   - 评分已完成');
    console.log('   - 飞书报告已发送');
    console.log('');
    
  } catch (error) {
    console.error('❌ 任务执行失败:', error.message);
  }
}

// 运行
if (require.main === module) {
  main();
}
