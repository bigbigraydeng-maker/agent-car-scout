/**
 * 飞书消息发送工具
 * 用于发送消息到飞书群聊或用户
 */

const https = require('https');

// 配置
const CONFIG = {
  // 飞书应用的 App ID
  appId: process.env.FEISHU_APP_ID || 'your-app-id',
  // 飞书应用的 App Secret
  appSecret: process.env.FEISHU_APP_SECRET || 'your-app-secret',
  // 访问令牌（会自动刷新）
  accessToken: null,
  // 令牌过期时间
  tokenExpireTime: 0,
};

// 发送 HTTP 请求
function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// 获取访问令牌
async function getAccessToken() {
  // 检查令牌是否过期
  if (CONFIG.accessToken && Date.now() < CONFIG.tokenExpireTime) {
    return CONFIG.accessToken;
  }
  
  const options = {
    hostname: 'open.feishu.cn',
    path: '/open-apis/auth/v3/tenant_access_token/internal',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const data = {
    app_id: CONFIG.appId,
    app_secret: CONFIG.appSecret,
  };
  
  try {
    const response = await request(options, data);
    
    if (response.code === 0) {
      CONFIG.accessToken = response.tenant_access_token;
      // 提前 5 分钟过期
      CONFIG.tokenExpireTime = Date.now() + (response.expire - 300) * 1000;
      console.log('获取访问令牌成功');
      return CONFIG.accessToken;
    } else {
      throw new Error(`获取令牌失败: ${response.msg}`);
    }
  } catch (error) {
    console.error('获取访问令牌失败:', error);
    throw error;
  }
}

// 发送文本消息
async function sendTextMessage(receiveId, text, receiveIdType = 'chat_id') {
  const token = await getAccessToken();
  
  const options = {
    hostname: 'open.feishu.cn',
    path: `/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
  
  const data = {
    receive_id: receiveId,
    msg_type: 'text',
    content: JSON.stringify({ text }),
  };
  
  try {
    const response = await request(options, data);
    
    if (response.code === 0) {
      console.log('发送文本消息成功');
      return response.data;
    } else {
      throw new Error(`发送消息失败: ${response.msg}`);
    }
  } catch (error) {
    console.error('发送文本消息失败:', error);
    throw error;
  }
}

// 发送富文本消息（卡片）
async function sendCardMessage(receiveId, card, receiveIdType = 'chat_id') {
  const token = await getAccessToken();
  
  const options = {
    hostname: 'open.feishu.cn',
    path: `/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
  
  const data = {
    receive_id: receiveId,
    msg_type: 'interactive',
    content: JSON.stringify(card),
  };
  
  try {
    const response = await request(options, data);
    
    if (response.code === 0) {
      console.log('发送卡片消息成功');
      return response.data;
    } else {
      throw new Error(`发送卡片消息失败: ${response.msg}`);
    }
  } catch (error) {
    console.error('发送卡片消息失败:', error);
    throw error;
  }
}

// 创建汽车信息卡片
function createCarInfoCard(carInfo) {
  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      title: {
        tag: 'plain_text',
        content: `🚗 ${carInfo.title}`,
      },
      subtitle: {
        tag: 'plain_text',
        content: `${carInfo.year}年 | ${carInfo.mileage}公里`,
      },
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**价格:** ¥${carInfo.price.toLocaleString()}`,
        },
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**位置:** ${carInfo.location}`,
        },
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**来源:** ${carInfo.source}`,
        },
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '查看详情',
            },
            type: 'primary',
            url: carInfo.url,
          },
        ],
      },
    ],
  };
}

// 创建对比结果卡片
function createComparisonCard(cars, recommendation) {
  const elements = cars.map((car, index) => ({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `${index + 1}. **${car.title}** - ¥${car.price.toLocaleString()}`,
    },
  }));
  
  elements.push({
    tag: 'hr',
  });
  
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `**💡 推荐:** ${recommendation}`,
    },
  });
  
  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      title: {
        tag: 'plain_text',
        content: '📊 车辆对比结果',
      },
    },
    elements: elements,
  };
}

// 导出函数
module.exports = {
  sendTextMessage,
  sendCardMessage,
  createCarInfoCard,
  createComparisonCard,
  getAccessToken,
};

// 如果直接运行此文件，执行测试
if (require.main === module) {
  console.log('飞书消息发送工具');
  console.log('================');
  console.log('');
  console.log('使用方法:');
  console.log('  const feishu = require("./feishu-message-sender");');
  console.log('  await feishu.sendTextMessage("chat_id", "Hello!");');
  console.log('');
  console.log('环境变量:');
  console.log('  FEISHU_APP_ID - 飞书应用 ID');
  console.log('  FEISHU_APP_SECRET - 飞书应用密钥');
}
