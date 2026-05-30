# 股票分析助手

> 将本项目作为一个可调用的股票分析服务部署，通过 HTTP API 完成 A 股 / 港股 / 美股全流程智能分析。

---

## 快速部署

### 第一步：克隆项目

```bash
git clone https://github.com/darrenli6/stock-analysis-helper.git
cd stock-analysis-helper
```

### 第二步：安装依赖

```bash
pnpm install
```

### 第三步：配置环境变量

复制示例文件，再按提示逐项填写：

```bash
cp .env.example .env
```

打开 `.env`，按以下说明填入你的值：

```env
# ✅ [必填] PostgreSQL 数据库连接串
# 本地示例：
DATABASE_URL=postgresql://postgres:password@localhost:5432/stock_analysis
# Supabase 免费套餐：注册 https://supabase.com → 新建项目
#   → Settings → Database → Connection string (URI)
# DATABASE_URL=postgresql://postgres.<ref>:<password>@*.pooler.supabase.com:5432/postgres

# ✅ [生产必填 / 开发可留空] NextAuth 签名密钥
# 生成命令：openssl rand -base64 32
AUTH_SECRET=

# 🔶 [可选] OpenAI API Key
# 填写后启用：财务报表 / 筹码 / 股东 / 分红 AI 摘要，以及自然语言意图识别
# 获取：https://platform.openai.com/api-keys
# 不填：跳过 AI 摘要模块，其余功能正常
OPENAI_API_KEY=

# 🔶 [可选] Tavily API Key
# 填写后启用：资讯情报（公司动态 / 行业 / 竞品 / 财报新闻）
# 获取：https://tavily.com → 注册 → API Keys（免费额度每月 1000 次）
# 不填：跳过资讯情报模块，其余功能正常
TAVILY_API_KEY=

# 运行环境：本地填 development，部署填 production
NODE_ENV=development
```

> **最简启动**：只需填 `DATABASE_URL`，其余可选项留空也能正常运行核心分析功能。

### 第四步：初始化数据库

```bash
pnpm db:push
```

### 第五步：启动服务

```bash
# 开发模式
pnpm dev

# 生产模式
pnpm build && pnpm start
```

服务默认运行在 `http://localhost:3000`。

---

## API 说明

### 1. 提交股票分析任务

**POST** `/api/analyze`

**请求体：**

```json
{
  "userInput": "分析腾讯控股"
}
```

`userInput` 支持自然语言，例如：
- `"分析贵州茅台"`
- `"NVDA 现在能买吗"`
- `"帮我看看比亚迪的技术面"`
- `"腾讯 hk00700"`

**响应示例：**

```json
{
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending"
}
```

---

### 2. 轮询任务状态与结果

**GET** `/api/tasks/{taskId}?afterLogId={lastLogId}`

| 参数 | 类型 | 说明 |
|------|------|------|
| `taskId` | string | 由 `/api/analyze` 返回的任务 ID |
| `afterLogId` | number | 可选，上次收到的最大日志 ID，用于增量拉取日志 |

**响应结构：**

```json
{
  "task": {
    "id": "550e8400-...",
    "status": "running",
    "destination": "腾讯控股",
    "userInput": "分析腾讯控股",
    "createdAt": "2025-05-27T10:00:00Z",
    "updatedAt": "2025-05-27T10:00:05Z"
  },
  "logs": [
    {
      "id": 1,
      "step": 1,
      "logType": "step_start",
      "message": "解析用户意图",
      "createdAt": "2025-05-27T10:00:01Z"
    }
  ],
  "result": null
}
```

**任务状态流转：**

```
pending → running → completed
                 ↘ failed
```

当 `status` 为 `completed` 时，`result` 字段包含完整分析结果。

---

### 3. 完整分析结果结构（result 字段）

```json
{
  "taskId": "...",
  "stock": {
    "code": "hk00700",
    "name": "腾讯控股",
    "market": "HK"
  },
  "company": {
    "name": "腾讯控股有限公司",
    "industry": "互联网",
    "listedDate": "2004-06-16",
    "website": "https://www.tencent.com",
    "introduction": "..."
  },
  "technical": {
    "price": 380.2,
    "currency": "HKD",
    "signal": "偏强",
    "score": 75,
    "rating": "推荐买入",
    "buySatisfied": 5,
    "warningCount": 1,
    "buyConditions": [
      { "name": "均线多头排列", "passed": true, "reason": "MA5=375, MA10=370..." },
      { "name": "MACD金叉", "passed": true, "reason": "DIF=2.1, DEA=1.8" }
    ],
    "warnings": [
      { "name": "RSI超买", "triggered": false, "reason": "RSI12=62.3" }
    ]
  },
  "backtest": {
    "window": "180 个交易日",
    "trend": "上行",
    "returnPct": 12.5,
    "maxClose": 395.0,
    "minClose": 310.0,
    "summary": "过去 180 个交易日区间收益 12.50%，走势判定为上行。"
  },
  "macro": {
    "industryCycle": "行业处于上行期...",
    "governance": "公司治理良好...",
    "macroEconomy": "宏观经济环境中性...",
    "summary": "综合调整系数 0.990，综合风险系数 0.990"
  },
  "recommendation": {
    "action": "buy",
    "confidence": 78,
    "rationale": ["技术信号：偏强", "历史走势：近阶段收益 12.50%"],
    "takeProfit": 425.8,
    "stopLoss": 357.4
  },
  "financialAnalysis": { ... },
  "fundAnalysis": { ... },
  "macroAnalysis": { ... },
  "chipData": null,
  "shareholderData": { ... },
  "dividendData": { ... },
  "newsData": { ... }
}
```

---

### 4. 市场热门数据

**GET** `/api/market`

无需参数，返回实时热门数据（缓存 5 分钟）：

```json
{
  "hotStocks": [
    { "code": "sh600519", "name": "贵州茅台", "zdf": 2.35, "zxj": 1680.0 }
  ],
  "hotBoards": [
    { "rank": 1, "name": "白酒", "zdf": 1.8 }
  ],
  "hotEtf": [ ... ],
  "ipo": [ ... ],
  "suspension": [ ... ],
  "fetchedAt": "2025-05-27T10:00:00Z"
}
```

---

## 完整调用示例（JavaScript）

```javascript
const BASE_URL = 'http://localhost:3000';

async function analyzeStock(query) {
  // 1. 提交任务
  const submitRes = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userInput: query }),
  });
  const { taskId } = await submitRes.json();
  console.log('任务已提交，taskId:', taskId);

  // 2. 轮询直到完成
  let lastLogId = 0;
  while (true) {
    await new Promise(r => setTimeout(r, 2000));

    const pollRes = await fetch(`${BASE_URL}/api/tasks/${taskId}?afterLogId=${lastLogId}`);
    const snapshot = await pollRes.json();

    // 打印新增日志
    for (const log of snapshot.logs) {
      console.log(`[步骤${log.step}][${log.logType}] ${log.message}`);
      lastLogId = Math.max(lastLogId, log.id);
    }

    if (snapshot.task.status === 'completed') {
      console.log('分析完成！');
      return snapshot.result;
    }

    if (snapshot.task.status === 'failed') {
      throw new Error('分析失败');
    }
  }
}

// 使用
const result = await analyzeStock('分析腾讯控股');
console.log('建议操作:', result.recommendation.action);        // buy / watch / avoid
console.log('置信度:', result.recommendation.confidence);     // 0-100
console.log('止盈价:', result.recommendation.takeProfit);
console.log('止损价:', result.recommendation.stopLoss);
console.log('技术评分:', result.technical.score);             // 0-100
```

---

## 完整调用示例（Python）

```python
import time
import requests

BASE_URL = 'http://localhost:3000'

def analyze_stock(query: str) -> dict:
    # 1. 提交任务
    resp = requests.post(f'{BASE_URL}/api/analyze', json={'userInput': query})
    task_id = resp.json()['taskId']
    print(f'任务已提交，taskId: {task_id}')

    # 2. 轮询直到完成
    last_log_id = 0
    while True:
        time.sleep(2)
        snap = requests.get(f'{BASE_URL}/api/tasks/{task_id}?afterLogId={last_log_id}').json()

        for log in snap['logs']:
            print(f"[步骤{log['step']}][{log['logType']}] {log['message']}")
            last_log_id = max(last_log_id, log['id'])

        status = snap['task']['status']
        if status == 'completed':
            print('分析完成！')
            return snap['result']
        if status == 'failed':
            raise RuntimeError('分析失败')

# 使用
result = analyze_stock('NVDA 技术面分析')
rec = result['recommendation']
print(f"操作建议: {rec['action']}")        # buy / watch / avoid
print(f"置信度: {rec['confidence']}")
print(f"止盈价: {rec['takeProfit']}")
print(f"止损价: {rec['stopLoss']}")
print(f"技术评分: {result['technical']['score']}")
```

---

## recommendation.action 含义

| 值 | 含义 | 触发条件（置信度） |
|----|------|--------------------|
| `buy` | 可考虑买入 | ≥ 72 |
| `watch` | 建议观察 | 55 – 71 |
| `avoid` | 建议回避 | < 55 |

---

## 注意事项

- 分析耗时约 **15–60 秒**（取决于网络和 AI API 响应），请使用轮询方式获取结果，不要设置过短的超时
- `OPENAI_API_KEY` 和 `TAVILY_API_KEY` 均为可选，不填写时跳过对应模块，其余功能正常运行
- 筹码成本分析（`chipData`）仅支持沪深 A 股
- 服务依赖 `npx westock-data-clawhub` 在线拉取行情数据，部署服务器需保证能访问 npm 及外网

---

## 相关链接

- GitHub 仓库：[darrenli6/stock-analysis-helper](https://github.com/darrenli6/stock-analysis-helper)
- 许可证：[LICENSE](LICENSE)（非商业开源，商用需授权）
- 深度内容：**达轮的AI星球**
