/**
 * 飞书事件回调服务器
 * 用于接收飞书消息和事件推送
 */

const http = require('http');
const crypto = require('crypto');

// 配置
const CONFIG = {
  port: process.env.PORT || 3000,
  // 从飞书后台获取的 Verification Token
  verificationToken: process.env.FEISHU_VERIFICATION_TOKEN || 'your-verification-token',
  // 从飞书后台获取的 Encrypt Key（可选，用于加密）
  encryptKey: process.env.FEISHU_ENCRYPT_KEY || '',
};

// 解析请求体
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// 验证签名
function verifySignature(timestamp, nonce, body, signature, encryptKey) {
  if (!encryptKey) return true; // 如果没有配置加密密钥，跳过验证
  
  const content = `${timestamp}${nonce}${JSON.stringify(body)}`;
  const hash = crypto.createHmac('sha256', encryptKey)
    .update(content)
    .digest('hex');
  return hash === signature;
}

// 解密消息（如果需要）
function decryptMessage(encryptKey, encrypt) {
  if (!encryptKey || !encrypt) return encrypt;
  
  try {
    // 飞书使用 AES-256-CBC 加密
    const key = crypto.createHash('sha256').update(encryptKey).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, key.slice(0, 16));
    let decrypted = decipher.update(encrypt, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (e) {
    console.error('解密失败:', e);
    return null;
  }
}

// 创建服务器
const server = http.createServer(async (req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // 只处理 POST 请求
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  
  // 只处理 webhook 路径
  if (req.url !== '/webhook/feishu' && req.url !== '/feishu/events') {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }
  
  try {
    const body = await parseBody(req);
    console.log('收到请求:', JSON.stringify(body, null, 2));
    
    // 获取请求头
    const timestamp = req.headers['x-lark-request-timestamp'] || '';
    const nonce = req.headers['x-lark-request-nonce'] || '';
    const signature = req.headers['x-lark-signature'] || '';
    
    // 处理 URL 验证（配置回调地址时）
    if (body.type === 'url_verification') {
      console.log('处理 URL 验证请求');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        challenge: body.challenge
      }));
      console.log('URL 验证成功，返回 challenge:', body.challenge);
      return;
    }
    
    // 验证签名
    if (!verifySignature(timestamp, nonce, body, signature, CONFIG.encryptKey)) {
      console.error('签名验证失败');
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Invalid signature' }));
      return;
    }
    
    // 处理事件回调
    if (body.schema === '2.0' && body.header) {
      const eventType = body.header.event_type;
      const event = body.event;
      
      console.log('收到事件:', eventType);
      
      switch (eventType) {
        case 'im.message.receive_v1':
          await handleMessage(event);
          break;
          
        case 'im.chat.member.bot.added_v1':
          await handleBotAdded(event);
          break;
          
        case 'im.chat.member.bot.deleted_v1':
          await handleBotDeleted(event);
          break;
          
        case 'im.chat.disbanded_v1':
          await handleChatDisbanded(event);
          break;
          
        default:
          console.log('未知事件类型:', eventType);
      }
    }
    
    // 返回成功响应
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 0, msg: 'success' }));
    
  } catch (error) {
    console.error('处理请求出错:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

// 处理接收到的消息
async function handleMessage(event) {
  const message = event.message;
  const sender = event.sender;
  const chat = event.message.chat_id;
  
  console.log('收到消息:');
  console.log('  消息类型:', message.message_type);
  console.log('  发送者:', sender.sender_id.user_id);
  console.log('  群聊ID:', chat);
  
  // 解析消息内容
  let content = '';
  try {
    content = JSON.parse(message.content);
    console.log('  消息内容:', content);
  } catch (e) {
    content = message.content;
    console.log('  消息内容:', content);
  }
  
  // TODO: 在这里调用 Car Scout Agent 处理消息
  // const response = await processWithCarScoutAgent(content);
  // await sendMessageToFeishu(chat, response);
  
  console.log('消息处理完成');
}

// 处理机器人被添加到群聊
async function handleBotAdded(event) {
  console.log('机器人被添加到群聊:', event.chat_id);
  console.log('操作者:', event.operator_id);
  
  // TODO: 发送欢迎消息
  // await sendMessageToFeishu(event.chat_id, '大家好！我是 Car Scout 助手，可以帮助您搜索和分析汽车信息。');
}

// 处理机器人被移出群聊
async function handleBotDeleted(event) {
  console.log('机器人被移出群聊:', event.chat_id);
  console.log('操作者:', event.operator_id);
}

// 处理群聊被解散
async function handleChatDisbanded(event) {
  console.log('群聊被解散:', event.chat_id);
}

// 启动服务器 - 监听 0.0.0.0 以允许外部访问（内网穿透需要）
server.listen(CONFIG.port, '0.0.0.0', () => {
  console.log('========================================');
  console.log('  飞书事件回调服务器已启动');
  console.log('========================================');
  console.log('');
  console.log('服务器地址:');
  console.log(`  http://localhost:${CONFIG.port}`);
  console.log(`  http://0.0.0.0:${CONFIG.port} (外部访问)`);
  console.log('');
  console.log('回调地址:');
  console.log(`  http://localhost:${CONFIG.port}/webhook/feishu`);
  console.log(`  http://localhost:${CONFIG.port}/feishu/events`);
  console.log('');
  console.log('配置说明:');
  console.log('  1. 将此服务器部署到公网或使用内网穿透');
  console.log('  2. 在飞书后台配置回调地址');
  console.log('  3. 设置环境变量 FEISHU_VERIFICATION_TOKEN');
  console.log('');
  console.log('========================================');
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
