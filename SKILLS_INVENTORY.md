# Main Agent Skill 清单与工作交接

## 交接概述

| 项目 | 详情 |
|------|------|
| **交接日期** | 2026-02-24 |
| **交接方** | Main Agent |
| **接收方** | Car Scout Agent (cli_a917a9e3af391cbb) |
| **交接类型** | Skill 与工作职责全面交接 |

---

## 一、现有 Skill 清单

### 1.1 Content Repository (内容仓库)

**Skill 路径**: `open claw/.trae/skills/content-repository/`

**功能描述**:
- 从用户提供的链接中提取文案内容
- 支持抖音、小红书、微博、公众号等平台
- 全网搜索新西兰打工、新西兰签证等咨询信息
- 不进行改写，仅提取和搜索

**使用场景**:
```
@OpenClaw 请帮我提取这个链接的文案：https://v.douyin.com/iE78a4B5/
@OpenClaw 请帮我搜索新西兰打工的相关信息
```

**技术工具**:
- `web_fetch`: 获取网页内容
- `browser`: 控制浏览器访问需要 JavaScript 渲染的页面
- `feishu_doc`: 将提取的文案保存到飞书文档
- `web_search`: 全网搜索相关信息

**交接状态**: ⏳ 待交接

---

### 1.2 Content Rewriter (内容改写器)

**Skill 路径**: `open claw/.trae/skills/content-rewriter/`

**功能描述**:
- 抓取公众号和抖音链接内容
- 改写成新文档
- 支持多种改写风格（正式、轻松、营销、小红书风格等）

**使用场景**:
```
@OpenClaw 请帮我抓取这个公众号文章并改写：https://mp.weixin.qq.com/s/xxxxx
@OpenClaw 请帮我改写这段内容，风格要轻松活泼，适合抖音平台
```

**改写风格**:
- 正式风格：适合企业号、专业平台
- 轻松活泼：适合抖音、快手等短视频平台
- 小红书风格：适合种草、分享类内容
- 营销文案：适合广告、推广类内容
- 故事叙述：适合情感类、故事类内容

**技术工具**:
- `web_fetch`: 获取网页内容
- `browser`: 控制浏览器访问
- `feishu_doc`: 将改写后的内容保存到飞书文档

**交接状态**: ⏳ 待交接

---

## 二、Car Scout Agent 专属 Skills

### 2.1 Car Search Skill

**功能描述**:
- 根据用户需求搜索合适的汽车 listings
- 支持多维度筛选（品牌、型号、价格、年份等）
- 整合多个汽车交易平台数据

**输入参数**:
```json
{
  "make": "string, 品牌",
  "model": "string, 型号",
  "year_min": "integer, 最小年份",
  "year_max": "integer, 最大年份",
  "price_min": "integer, 最低价格",
  "price_max": "integer, 最高价格",
  "location": "string, 地区",
  "fuel_type": "string, 燃油类型",
  "transmission": "string, 变速箱类型"
}
```

**输出格式**:
```json
{
  "results": [
    {
      "id": "车辆ID",
      "title": "车辆标题",
      "price": "价格",
      "year": "年份",
      "mileage": "里程",
      "location": "位置",
      "source": "数据来源",
      "url": "链接"
    }
  ],
  "total_count": "总结果数",
  "search_time": "搜索耗时"
}
```

---

### 2.2 Price Analysis Skill

**功能描述**:
- 分析汽车价格趋势
- 提供定价建议
- 对比历史价格数据

**输入参数**:
```json
{
  "car_id": "string, 车辆ID",
  "market_data_days": "integer, 市场数据天数(默认90)",
  "comparison_cars": "array, 对比车辆ID列表"
}
```

**分析维度**:
- 当前市场价格区间
- 价格趋势（上涨/下跌/稳定）
- 同类车型价格对比
- 性价比评分

---

### 2.3 Listing Comparison Skill

**功能描述**:
- 对比多个汽车 listing
- 生成对比报告
- 帮助用户做出决策

**输入参数**:
```json
{
  "car_ids": "array, 车辆ID列表(2-5辆)",
  "criteria": "array, 对比维度",
  "highlight_differences": "boolean, 是否高亮差异"
}
```

**对比维度**:
- 价格
- 年份/车龄
- 里程数
- 配置
- 燃油效率
- 保值率

---

### 2.4 Market Research Skill

**功能描述**:
- 提供汽车市场趋势和洞察
- 分析热门车型
- 预测价格走势

**研究内容**:
- 市场热门车型排行
- 品牌销量趋势
- 新能源汽车市场分析
- 二手车市场报告
- 地区性市场差异

---

### 2.5 User Preferences Skill

**功能描述**:
- 学习和管理用户偏好
- 提供个性化推荐
- 保存用户搜索历史

**用户画像维度**:
- 预算范围
- 品牌偏好
- 车型偏好
- 使用场景
- 购买时间计划

**推荐算法**:
- 基于历史搜索的协同过滤
- 基于偏好的内容推荐
- 热门趋势结合

---

## 三、通用能力清单

### 3.1 代码开发能力
- 代码编写与调试
- 代码审查与优化
- 技术方案设计
- 文档编写

### 3.2 项目管理能力
- 任务规划与跟踪
- 进度管理
- 风险评估
- 资源协调

### 3.3 沟通协作能力
- 需求分析
- 方案汇报
- 跨团队沟通
- 用户支持

### 3.4 技术栈
- **前端**: HTML, CSS, JavaScript, React, Vue
- **后端**: Node.js, Python, REST API
- **数据库**: SQL, NoSQL
- **工具**: Git, Docker, CI/CD
- **AI/ML**: LLM, 自然语言处理

---

## 四、交接清单

### 4.1 Skill 交接

| Skill 名称 | 路径 | 优先级 | 状态 |
|------------|------|--------|------|
| content-repository | open claw/.trae/skills/content-repository/ | 高 | ⏳ 待交接 |
| content-rewriter | open claw/.trae/skills/content-rewriter/ | 高 | ⏳ 待交接 |
| car-search | Agent Car Scout/skills/car-search/ | 高 | 🆕 新建 |
| price-analysis | Agent Car Scout/skills/price-analysis/ | 高 | 🆕 新建 |
| listing-comparison | Agent Car Scout/skills/listing-comparison/ | 中 | 🆕 新建 |
| market-research | Agent Car Scout/skills/market-research/ | 中 | 🆕 新建 |
| user-preferences | Agent Car Scout/skills/user-preferences/ | 中 | 🆕 新建 |

### 4.2 工作职责交接

| 职责领域 | 当前负责人 | 新负责人 | 状态 |
|----------|------------|----------|------|
| 内容仓库管理 | Main Agent | Car Scout Agent | ⏳ 待交接 |
| 内容改写服务 | Main Agent | Car Scout Agent | ⏳ 待交接 |
| 汽车搜索服务 | - | Car Scout Agent | 🆕 新增 |
| 价格分析服务 | - | Car Scout Agent | 🆕 新增 |
| 市场研究服务 | - | Car Scout Agent | 🆕 新增 |
| 用户偏好管理 | - | Car Scout Agent | 🆕 新增 |

### 4.3 资源交接

| 资源类型 | 详情 | 位置 | 状态 |
|----------|------|------|------|
| 配置文件 | agent-config.json | Agent Car Scout/ | ✅ 已创建 |
| 部署脚本 | deploy.ps1 | Agent Car Scout/ | ✅ 已创建 |
| 交接文档 | HANDOVER.md | Agent Car Scout/ | ✅ 已创建 |
| Skill 清单 | SKILLS_INVENTORY.md | Agent Car Scout/ | ✅ 已创建 |
| API Key | JbyS6Xdb1ZuMe6BmXbi9XbGByUkzW7HU | agent-config.json | ✅ 已配置 |

---

## 五、交接步骤

### 步骤 1: Skill 迁移 (优先级: 高)
1. [ ] 复制 content-repository skill 到 Car Scout Agent
2. [ ] 复制 content-rewriter skill 到 Car Scout Agent
3. [ ] 验证 skill 功能正常
4. [ ] 更新 skill 路径配置

### 步骤 2: 新建 Car Scout 专属 Skills (优先级: 高)
1. [ ] 创建 car-search skill
2. [ ] 创建 price-analysis skill
3. [ ] 创建 listing-comparison skill
4. [ ] 创建 market-research skill
5. [ ] 创建 user-preferences skill

### 步骤 3: 配置更新 (优先级: 中)
1. [ ] 更新 agent-config.json 添加 skill 列表
2. [ ] 配置 skill 调用权限
3. [ ] 设置 skill 优先级

### 步骤 4: 测试验证 (优先级: 高)
1. [ ] 测试所有 skill 功能
2. [ ] 验证 API 连通性
3. [ ] 检查日志记录
4. [ ] 性能测试

### 步骤 5: 上线切换 (优先级: 高)
1. [ ] 通知相关团队
2. [ ] 更新文档
3. [ ] 监控运行状态
4. [ ] 处理反馈问题

---

## 六、注意事项

### 6.1 Skill 依赖关系
- content-rewriter 依赖 content-repository 的数据
- car-search 是基础 skill，其他 car 相关 skill 可能依赖它
- user-preferences 影响所有推荐类 skill 的结果

### 6.2 配置注意事项
- API Key 需要保密，不要提交到代码仓库
- Skill 路径需要正确配置
- 环境变量需要同步更新

### 6.3 风险评估
- 迁移期间可能出现服务中断
- 需要准备回滚方案
- 建议先在小范围测试

---

## 七、支持与联系

### 7.1 技术支持
- **紧急问题**: 联系 DevOps 团队
- **Skill 问题**: 查看 SKILL.md 文档
- **API 问题**: 查看 API 文档

### 7.2 文档资源
- Skill 开发指南: `https://docs.trae.ai/skills`
- API 文档: `https://docs.trae.ai/api`
- 部署指南: `./deploy.ps1`

---

## 八、交接确认

### 交接双方确认

**交接方 (Main Agent)**:
- [ ] 所有 skill 文档已更新
- [ ] 配置文件已准备
- [ ] 已知问题已说明
- [ ] 支持联系方式已提供

**接收方 (Car Scout Agent)**:
- [ ] 已阅读所有文档
- [ ] 已了解所有 skill 功能
- [ ] 已测试关键功能
- [ ] 已准备接管工作

### 交接完成时间
**日期**: 2026-02-24  
**交接人**: Main Agent  
**接收人**: Car Scout Agent (cli_a917a9e3af391cbb)

---

**备注**: 本清单将作为交接的主要参考文档，请双方认真核对每一项内容。
