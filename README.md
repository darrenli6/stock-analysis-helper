# 达轮-股票分析助手

[English](README_EN.md) | 中文

> 自然语言驱动的全市场智能股票分析工作台，支持 A 股、港股、美股一键深度分析。

![股票分析助手](public/达轮-股票分析助手.png)

---

## 功能概览

输入一句话，例如「分析腾讯」「NVDA 现在能买吗」「帮我看看茅台」，系统自动完成以下全流程分析：

| 模块 | 内容 |
|------|------|
| **技术面分析** | MA / MACD / KDJ / RSI / DMI / BOLL 全套指标，7 项买入条件 + 6 项高位预警，综合评分 0–100 |
| **K 线图表** | 近 180 个交易日日 K 线，成交量、换手率可视化 |
| **财务报表** | 近 4 期营收、净利润、毛利率、负债率、现金流，A 股 / 港股 / 美股三套解析逻辑，AI 摘要 |
| **资金与交易** | A 股资金流向、融资融券、龙虎榜、大宗交易；港股北向资金；美股卖空数据 |
| **宏观环境** | 行业景气度、公司治理风险、宏观经济环境三维评估，实时 Bing 搜索 |
| **筹码成本** | 获利盘比例、筹码均价、70%/90% 筹码集中度，AI 解读（仅 A 股） |
| **股东结构** | 十大股东、十大流通股东、股东户数趋势，AI 解读 |
| **分红历史** | 近 5 年分红记录、当前股息率测算，AI 解读 |
| **资讯情报** | Tavily 实时搜索公司动态、行业分析、竞品信息、财报业绩四类新闻 |
| **买卖建议** | 综合技术面、宏观面、历史回测，给出买入 / 观察 / 回避建议，附止盈止损参考价 |
| **买卖方辩论** | 分析完成后一键开启 AI 辩论：DeepSeek 扮演多头买方 🐂，OpenAI 扮演空头卖方 🐻，最多 10 轮交锋，支持暂停 / 继续，实时流式展示 |
| **导出 PDF** | 一键将完整分析报告打印为 PDF，自动隐藏交互控件，保留所有图表与数据 |
| **发送邮件** | 填入收件邮箱，将分析摘要（评分、建议、止盈止损）通过 163 SMTP 发送到邮箱 |

---

## 买卖方辩论

![买卖方辩论](public/达轮-股票分析助手.png)

分析完成后，点击页面底部「🐂 开启买卖方辩论 🐻」按钮，系统将自动启动 AI 双方对话：

- **买方**（DeepSeek）：激进基金经理视角，逐轮给出买入理由
- **卖方**（OpenAI）：谨慎风险分析师视角，逐轮反驳并给出回避论据
- 最多进行 **10 轮**交锋，每轮买方先发言、卖方后反驳
- 支持随时**暂停 / 继续**，对话记录持久化存储
- 气泡式聊天界面，买方居左（绿色）、卖方居右（红色）

---

## 市场热门

![市场热门](public/达轮-市场热门.png)

---

## 技术栈

- **框架**：[Next.js 15](https://nextjs.org/) + [React 19](https://react.dev/)（Pages Router）
- **语言**：TypeScript 5
- **样式**：[Tailwind CSS v4](https://tailwindcss.com/)
- **数据库**：PostgreSQL + [Drizzle ORM](https://orm.drizzle.team/)
- **认证**：[NextAuth v5](https://authjs.dev/)（可选）
- **数据源**：[westock-data-clawhub](https://www.npmjs.com/package/westock-data-clawhub) CLI（行情、技术指标、财报等）
- **AI 摘要**：OpenAI GPT-4o-mini（财务、筹码、股东、分红摘要，可选）
- **新闻搜索**：[Tavily](https://tavily.com/)（可选）
- **宏观搜索**：Bing 公开搜索

---

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 10
- PostgreSQL 数据库

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

复制并编辑 `.env` 文件：

```bash
cp .env.example .env
```

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接串，如 `postgresql://user:pass@localhost:5432/stock` |
| `AUTH_SECRET` | 生产必填 | NextAuth 签名密钥，可用 `openssl rand -base64 32` 生成 |
| `OPENAI_API_KEY` | 否 | 填写后启用财务/筹码/股东/分红 AI 摘要 + 买卖方辩论卖方（OpenAI） |
| `DEEPSEEK_API_KEY` | 否 | 填写后用于意图识别优先调用 + 买卖方辩论买方（DeepSeek） |
| `TAVILY_API_KEY` | 否 | 填写后启用资讯情报功能 |
| `SHOUQUAN_163_EMAIL` | 否 | 163 邮箱授权码，填写后启用邮件发送功能（格式：`user@163.com----授权码`） |
| `FROM_EMAIL` | 否 | 发件人邮箱地址，如 `user@163.com` |

### 初始化数据库

```bash
pnpm db:push
```

### 启动开发服务器

```bash
pnpm dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)

---

## 部署

```bash
pnpm build
pnpm start
```

支持部署到任何支持 Node.js 的平台（Vercel、Railway、自建服务器等）。

> 注意：`westock-data-clawhub` CLI 会在运行时通过 `npx` 按需下载，服务器需有外网访问能力。

---

## 项目结构

```
src/
├── pages/
│   ├── index.tsx          # 主页面（股票分析工作台）
│   └── api/
│       ├── analyze.ts     # 提交分析任务
│       ├── tasks/[id].ts  # 轮询任务状态与日志
│       └── market.ts      # 市场热门数据
├── components/index/      # 各分析模块 UI 组件
├── server/
│   ├── stock/workflow.ts  # 核心分析工作流
│   └── db/                # 数据库 schema 与连接
└── types/                 # 全局类型定义
```

---

## 使用示例

在搜索框输入：

- `分析贵州茅台` — A 股全量分析
- `腾讯控股现在能买吗` — 港股分析
- `NVDA 技术面如何` — 美股分析
- `帮我看看比亚迪` — 自然语言意图识别

---

## 许可证

本项目采用自定义非商业开源许可证，详见 [LICENSE](LICENSE)。

- 允许查看源码、Fork、学习、非商业使用
- **禁止**未经授权的商业用途
- 商业使用请联系作者获得书面授权

---

## 联系作者

如需商业授权或有任何问题，请通过 GitHub Issues 联系。

---

## 深度内容 · 达轮的AI星球

![达轮的AI星球](public/达轮的AI星球.webp)

更多 AI 工具实战、智能体开发、前沿模型探索等深度内容，欢迎关注 **达轮的AI星球**。
