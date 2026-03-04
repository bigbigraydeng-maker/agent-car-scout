/**
 * 飞书连接诊断工具
 * 用于检查配置和连接问题
 */

const http = require('http');
const https = require('https');
const url = require('url');

console.log('========================================');
console.log('  飞书连接诊断工具');
console.log('========================================\n');

// 检查 1: 本地服务器是否可访问
console.log('[检查 1] 本地服务器状态');
console.log('----------------------------------------');

const checkLocalServer = () => {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/webhook/feishu', (res) => {
      console.log('✅ 本地服务器运行正常');
      console.log(`   状态码: ${res.statusCode}`);
      resolve(true);
    });
    
    req.on('error', (err) => {
      console.log('❌ 本地服务器未启动或无法访问');
      console.log(`   错误: ${err.message}`);
      resolve(false);
    });
    
    req.setTimeout(3000, () => {
      console.log('❌ 连接超时');
      req.destroy();
      resolve(false);
    });
  });
};

// 检查 2: 测试 URL 验证响应
console.log('\n[检查 2] URL 验证响应测试');
console.log('----------------------------------------');

const testUrlVerification = () => {
  return new Promise((resolve) => {
    const testData = JSON.stringify({
      type: 'url_verification',
      challenge: 'test-challenge-123'
    });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/webhook/feishu',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(testData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.challenge === 'test-challenge-123') {
            console.log('✅ URL 验证响应正确');
            console.log(`   返回的 challenge: ${response.challenge}`);
            resolve(true);
          } else {
            console.log('❌ URL 验证响应不正确');
            console.log(`   返回数据: ${data}`);
            resolve(false);
          }
        } catch (e) {
          console.log('❌ 响应格式错误');
          console.log(`   原始响应: ${data}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ 请求失败');
      console.log(`   错误: ${err.message}`);
      resolve(false);
    });
    
    req.write(testData);
    req.end();
  });
};

// 检查 3: 检查公网可访问性
console.log('\n[检查 3] 公网可访问性检查');
console.log('----------------------------------------');
console.log('⚠️  此检查需要你先配置好内网穿透');
console.log('   请提供你的公网回调地址（如 https://xxx.ngrok-free.app/webhook/feishu）');

// 检查 4: 配置建议
console.log('\n[检查 4] 配置建议');
console.log('----------------------------------------');

const printSuggestions = () => {
  console.log('\n📋 常见问题及解决方案:\n');
  
  console.log('1. 如果飞书提示 "请求失败":');
  console.log('   - 确保内网穿透工具已启动');
  console.log('   - 确保使用的是 HTTPS 地址');
  console.log('   - 检查防火墙是否放行了端口');
  console.log('');
  
  console.log('2. 如果飞书提示 "响应超时":');
  console.log('   - 服务器必须在 3 秒内响应');
  console.log('   - 检查服务器是否有阻塞操作');
  console.log('   - 确保返回了正确的 challenge');
  console.log('');
  
  console.log('3. 如果飞书提示 "验证失败":');
  console.log('   - 确保返回的 challenge 与请求中的一致');
  console.log('   - 确保响应格式是 JSON');
  console.log('   - 确保 Content-Type 是 application/json');
  console.log('');
  
  console.log('4. 回调地址格式要求:');
  console.log('   - 必须以 https:// 开头');
  console.log('   - 必须是公网可访问的地址');
  console.log('   - 路径建议: /webhook/feishu 或 /feishu/events');
  console.log('');
};

// 检查 5: 快速修复
console.log('\n[检查 5] 快速修复建议');
console.log('----------------------------------------');

const printQuickFix = () => {
  console.log('\n🔧 如果服务器已启动但无法连接，请检查:\n');
  
  console.log('1. 服务器是否监听 0.0.0.0:');
  console.log('   当前代码: server.listen(3000)');
  console.log('   应该改为: server.listen(3000, "0.0.0.0")');
  console.log('');
  
  console.log('2. 端口是否被占用:');
  console.log('   检查命令: netstat -ano | findstr :3000');
  console.log('');
  
  console.log('3. 防火墙设置:');
  console.log('   Windows: 检查 Windows Defender 防火墙');
  console.log('   确保端口 3000 允许入站连接');
  console.log('');
};

// 运行检查
async function runDiagnostics() {
  await checkLocalServer();
  await testUrlVerification();
  printSuggestions();
  printQuickFix();
  
  console.log('\n========================================');
  console.log('  诊断完成');
  console.log('========================================\n');
  
  console.log('如果以上检查都通过，但仍无法建立连接，');
  console.log('请提供以下信息以便进一步诊断:');
  console.log('  1. 你的内网穿透工具（ngrok/花生壳/其他）');
  console.log('  2. 公网回调地址');
  console.log('  3. 飞书后台显示的具体错误信息');
}

runDiagnostics();
