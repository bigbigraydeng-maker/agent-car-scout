# 内网穿透配置指南（ngrok）

飞书要求回调地址必须是公网可访问的 HTTPS 地址。如果你在本地开发，需要使用内网穿透工具。

## 方案一：ngrok（推荐）

### 1. 注册 ngrok 账号
访问 https://ngrok.com/ 注册免费账号

### 2. 下载并安装 ngrok
```bash
# Windows (使用 PowerShell)
choco install ngrok

# 或手动下载
# 访问 https://ngrok.com/download 下载 Windows 版本
```

### 3. 配置 ngrok
```bash
# 添加你的 authtoken（从 ngrok 后台获取）
ngrok config add-authtoken YOUR_AUTHTOKEN
```

### 4. 启动内网穿透
```bash
# 将本地 3000 端口映射到公网
ngrok http 3000
```

### 5. 获取公网地址
启动后会显示类似：
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

**你的飞书回调地址就是：**
```
https://abc123.ngrok-free.app/webhook/feishu
```

---

## 方案二：钉钉内网穿透（免费稳定）

### 1. 下载工具
```bash
# Windows
git clone https://github.com/open-dingtalk/pierced.git
cd pierced/windows_64
```

### 2. 启动穿透
```bash
# 命令格式
./ding.exe -config=./ding.cfg -subdomain=your-subdomain 3000

# 示例
./ding.exe -config=./ding.cfg -subdomain=carscout 3000
```

### 3. 访问地址
```
http://carscout.vaiwan.com
```

---

## 方案三：花生壳（国内稳定）

### 1. 注册花生壳账号
访问 https://hsk.oray.com/ 注册

### 2. 下载客户端
下载并安装花生壳客户端

### 3. 配置映射
1. 登录客户端
2. 添加映射
3. 内网主机: 127.0.0.1
4. 内网端口: 3000
5. 外网域名: 使用赠送的免费域名

---

## 完整启动流程

### 步骤 1: 启动飞书回调服务器
```bash
node feishu-webhook-server.js
```

服务器将在 http://localhost:3000 启动

### 步骤 2: 启动内网穿透（新终端）
```bash
ngrok http 3000
```

### 步骤 3: 复制 HTTPS 地址
```
https://your-id.ngrok-free.app/webhook/feishu
```

### 步骤 4: 配置飞书后台
1. 进入飞书开发者后台
2. 事件订阅 → 请求地址
3. 粘贴: `https://your-id.ngrok-free.app/webhook/feishu`
4. 点击保存

### 步骤 5: 验证配置
如果显示 **"长连接已建立"**，说明配置成功！

---

## 常见问题

### Q1: ngrok 免费版每次重启地址会变
**解决**: 
- 升级到付费版获取固定域名
- 或使用钉钉内网穿透的固定子域名

### Q2: 飞书要求 HTTPS，ngrok 提供的是 HTTP
**解决**: 
- ngrok 免费版自动提供 HTTPS
- 确保使用 `https://` 开头的地址

### Q3: 保存时提示 "请求失败"
**解决**:
1. 确保服务器已启动
2. 确保 ngrok 已启动
3. 检查防火墙是否放行 3000 端口
4. 查看服务器日志是否有错误

### Q4: 配置成功后收不到消息
**解决**:
1. 检查是否正确订阅了 `im.message.receive_v1` 事件
2. 确保应用已发布并通过审核
3. 检查服务器日志是否有消息到达
4. 确认机器人已被添加到群聊或用户已发送消息

---

## 生产环境部署

生产环境建议使用以下方式：

### 云服务器
- 阿里云 ECS
- 腾讯云 CVM
- AWS EC2

### Serverless
- 阿里云函数计算
- 腾讯云云函数
- Vercel
- Railway

### Docker 部署
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "feishu-webhook-server.js"]
```

---

## 快速测试

配置完成后，可以使用以下命令测试：

```bash
# 测试回调地址
curl -X POST https://your-id.ngrok-free.app/webhook/feishu \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url_verification",
    "challenge": "test123"
  }'

# 应该返回
# {"challenge":"test123"}
```

---

## 参考

- [ngrok 文档](https://ngrok.com/docs)
- [钉钉内网穿透](https://github.com/open-dingtalk/pierced)
- [飞书事件订阅文档](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive)
