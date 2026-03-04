# 飞书应用长连接配置指南

## 问题描述
**错误信息**: 应用未建立长连接

**原因**: 飞书应用需要订阅特定事件才能建立长连接，用于实时接收消息和事件推送。

---

## 解决步骤

### 步骤 1: 登录飞书开发者后台
1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 登录你的开发者账号
3. 进入你的应用管理页面

### 步骤 2: 配置事件订阅

#### 2.1 进入事件订阅设置
1. 在应用详情页，点击左侧菜单 **「事件订阅」**
2. 确保 **「启用事件订阅」** 开关已打开

#### 2.2 配置请求地址
- **请求地址**: 你的服务器回调 URL
  - 格式: `https://your-domain.com/webhook/feishu`
  - 或: `https://your-domain.com/api/feishu/events`

#### 2.3 配置验证令牌
- **Verification Token**: 用于验证请求来自飞书
- **Encrypt Key**: 用于加密消息（可选，但建议配置）

---

## 必须添加的事件

### 消息事件（必需）
| 事件名称 | 事件 Key | 说明 |
|----------|----------|------|
| 接收消息 | `im.message.receive_v1` | 接收用户发送的消息 |

### 机器人事件（必需）
| 事件名称 | 事件 Key | 说明 |
|----------|----------|------|
| 机器人被添加 | `im.chat.member.bot.added_v1` | 机器人被添加到群聊 |
| 机器人被移除 | `im.chat.member.bot.deleted_v1` | 机器人被移出群聊 |

### 群组事件（推荐）
| 事件名称 | 事件 Key | 说明 |
|----------|----------|------|
| 群成员增加 | `im.chat.member.user.added_v1` | 群成员增加事件 |
| 群成员减少 | `im.chat.member.user.deleted_v1` | 群成员减少事件 |

### 用户事件（可选）
| 事件名称 | 事件 Key | 说明 |
|----------|----------|------|
| 用户状态变更 | `user.status_change` | 用户在线状态变化 |

---

## 权限配置

### 必需权限
在 **「权限管理」** 中申请以下权限：

#### 消息权限
- `im:chat:readonly` - 读取群聊信息
- `im:message:send` - 发送消息
- `im:message.group_msg` - 发送群消息
- `im:message.p2p_msg` - 发送单聊消息

#### 机器人权限
- `im:bot` - 机器人相关权限
- `im:bot:group` - 机器人群聊权限

#### 用户权限
- `contact:user.department:readonly` - 读取用户部门信息
- `contact:user.base:readonly` - 读取用户基本信息

---

## 配置检查清单

### 基础配置
- [ ] 事件订阅已启用
- [ ] 请求地址已配置（HTTPS）
- [ ] Verification Token 已设置
- [ ] Encrypt Key 已设置（可选但推荐）

### 事件订阅
- [ ] `im.message.receive_v1` - 接收消息事件
- [ ] `im.chat.member.bot.added_v1` - 机器人被添加事件
- [ ] `im.chat.member.bot.deleted_v1` - 机器人被移除事件

### 权限申请
- [ ] `im:message:send` - 发送消息权限
- [ ] `im:message.group_msg` - 发送群消息权限
- [ ] `im:chat:readonly` - 读取群聊信息权限
- [ ] `im:bot` - 机器人权限

---

## 代码示例

### 飞书事件回调处理（Node.js）

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// 飞书配置
const FEISHU_CONFIG = {
  verificationToken: 'your-verification-token',
  encryptKey: 'your-encrypt-key', // 可选
};

// 验证请求签名
function verifySignature(timestamp, nonce, body, signature) {
  const content = `${timestamp}${nonce}${JSON.stringify(body)}`;
  const hash = crypto.createHmac('sha256', FEISHU_CONFIG.encryptKey)
    .update(content)
    .digest('hex');
  return hash === signature;
}

// 飞书事件回调接口
app.post('/webhook/feishu', async (req, res) => {
  const { timestamp, nonce, signature } = req.headers;
  const body = req.body;

  // 验证签名
  if (!verifySignature(timestamp, nonce, body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 处理 URL 验证（首次配置时）
  if (body.type === 'url_verification') {
    return res.json({ challenge: body.challenge });
  }

  // 处理事件回调
  const event = body.event;
  
  switch (body.header.event_type) {
    case 'im.message.receive_v1':
      // 处理接收到的消息
      await handleMessage(event);
      break;
      
    case 'im.chat.member.bot.added_v1':
      // 处理机器人被添加到群聊
      await handleBotAdded(event);
      break;
      
    case 'im.chat.member.bot.deleted_v1':
      // 处理机器人被移出群聊
      await handleBotDeleted(event);
      break;
      
    default:
      console.log('Unknown event:', body.header.event_type);
  }

  res.json({ code: 0, msg: 'success' });
});

// 处理消息
async function handleMessage(event) {
  const message = event.message;
  const sender = event.sender;
  
  console.log('收到消息:', message.content);
  console.log('发送者:', sender.sender_id);
  
  // 这里调用 Car Scout Agent 处理消息
  // const response = await carScoutAgent.process(message.content);
  // await sendMessageToFeishu(message.chat_id, response);
}

// 处理机器人被添加
async function handleBotAdded(event) {
  console.log('机器人被添加到群聊:', event.chat_id);
  // 发送欢迎消息
}

// 处理机器人被移除
async function handleBotDeleted(event) {
  console.log('机器人被移出群聊:', event.chat_id);
}

app.listen(3000, () => {
  console.log('飞书事件回调服务已启动，端口: 3000');
});
```

### 发送消息到飞书

```javascript
const axios = require('axios');

// 发送文本消息
async function sendTextMessage(chatId, text) {
  const url = 'https://open.feishu.cn/open-apis/im/v1/messages';
  const token = 'your-access-token';
  
  const data = {
    receive_id: chatId,
    msg_type: 'text',
    content: JSON.stringify({ text }),
  };
  
  try {
    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      params: {
        receive_id_type: 'chat_id',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('发送消息失败:', error);
    throw error;
  }
}

// 发送富文本消息（卡片）
async function sendCardMessage(chatId, cardContent) {
  const url = 'https://open.feishu.cn/open-apis/im/v1/messages';
  const token = 'your-access-token';
  
  const data = {
    receive_id: chatId,
    msg_type: 'interactive',
    content: JSON.stringify({ card: cardContent }),
  };
  
  try {
    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      params: {
        receive_id_type: 'chat_id',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('发送卡片消息失败:', error);
    throw error;
  }
}
```

---

## 常见问题

### Q1: 配置后仍然显示"未建立长连接"
**解决方案**:
1. 检查请求地址是否可以公网访问
2. 确认 HTTPS 证书有效
3. 检查防火墙是否放行了对应端口
4. 查看飞书后台的事件推送日志

### Q2: 收不到消息推送
**解决方案**:
1. 确认已订阅 `im.message.receive_v1` 事件
2. 检查服务器是否正确返回了响应
3. 查看服务器日志是否有错误
4. 确认应用已发布并通过审核

### Q3: 如何测试本地开发环境
**解决方案**:
使用内网穿透工具，如：
- ngrok: `ngrok http 3000`
- 花生壳
- 钉钉内网穿透

---

## 参考文档

- [飞书开放平台 - 事件订阅](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive)
- [飞书开放平台 - 权限说明](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/scope-authority)
- [飞书开放平台 - 机器人开发指南](https://open.feishu.cn/document/home/develop-a-bot-in-5-minutes/overview)

---

## 快速检查命令

如果你使用 curl 测试连接：

```bash
# 测试回调地址是否可达
curl -X POST https://your-domain.com/webhook/feishu \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url_verification",
    "challenge": "test-challenge"
  }'
```

---

**配置完成后，请确保：**
1. ✅ 所有必需事件已订阅
2. ✅ 所有必需权限已申请
3. ✅ 回调地址可以公网访问
4. ✅ 应用已发布（如果是正式环境）
