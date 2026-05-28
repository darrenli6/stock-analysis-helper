# Dalun Stock Analysis Assistant

[中文](README.md) | English

> A natural-language-driven intelligent stock analysis workbench supporting A-shares, Hong Kong stocks, and US stocks with one-click deep analysis.

![Stock Analysis Assistant](public/达轮-股票分析助手.png)

---

## Features

Just type a sentence like "Analyze Tencent", "Should I buy NVDA now?", or "Check Tesla for me" — the system automatically runs a full analysis pipeline:

| Module | Description |
|--------|-------------|
| **Technical Analysis** | Full suite: MA / MACD / KDJ / RSI / DMI / BOLL. 7 buy conditions + 6 overbought warnings. Composite score 0–100 |
| **Candlestick Chart** | 180 trading days of daily K-line with volume and turnover rate visualization |
| **Financial Reports** | Last 4 periods: revenue, net profit, gross margin, debt ratio, cash flow. Separate parsing logic for A-share / HK / US stocks with AI summary |
| **Fund & Trading** | A-share: fund flow, margin trading, top trader board, block trades. HK: northbound capital. US: short interest data |
| **Macro Environment** | Three-dimensional assessment: industry cycle, corporate governance risk, macroeconomic environment — powered by real-time Bing search |
| **Chip Distribution** | Profit ratio, average chip cost, 70%/90% chip concentration with AI interpretation (A-share only) |
| **Shareholder Structure** | Top 10 holders, top 10 tradable holders, shareholder count trend with AI interpretation |
| **Dividend History** | Last 5 years of dividend records, current yield calculation with AI interpretation |
| **News Intelligence** | Tavily real-time search: company news, industry analysis, competitor info, earnings reports |
| **Buy/Sell Recommendation** | Combines technical, macro, and backtest data to give Buy / Watch / Avoid with take-profit and stop-loss reference prices |
| **AI Bull vs Bear Debate** | After analysis, launch an AI debate: DeepSeek plays the bull 🐂, OpenAI plays the bear 🐻. Up to 10 rounds, supports pause/resume, persisted to database |
| **Export PDF** | One-click print the full analysis report to PDF — interactive controls hidden, all charts preserved |
| **Email Report** | Enter a recipient email and send the analysis summary (score, recommendation, take-profit/stop-loss) via SMTP |

---

## AI Bull vs Bear Debate

After analysis completes, click the "🐂 Start Bull vs Bear Debate 🐻" button at the bottom of the page:

- **Bull** (DeepSeek): Aggressive fund manager perspective, builds the buy case each round
- **Bear** (OpenAI): Cautious risk analyst perspective, rebuts each round and argues for avoidance
- Up to **10 rounds** — bull speaks first, bear responds
- Supports **pause / resume** at any time; conversation persisted to database
- Bubble-style chat UI: bull on the left (green), bear on the right (red)

---

## Market Hot Stocks

![Market Hot Stocks](public/达轮-市场热门.png)

---

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) + [React 19](https://react.dev/) (Pages Router)
- **Language**: TypeScript 5
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database**: PostgreSQL + [Drizzle ORM](https://orm.drizzle.team/)
- **Auth**: [NextAuth v5](https://authjs.dev/) (optional)
- **Data Source**: [westock-data-clawhub](https://www.npmjs.com/package/westock-data-clawhub) CLI (quotes, technical indicators, financials, etc.)
- **AI Debate**: DeepSeek (bull) + OpenAI GPT-4o-mini (bear)
- **AI Summaries**: OpenAI GPT-4o-mini (financial, chip, shareholder, dividend, optional)
- **News Search**: [Tavily](https://tavily.com/) (optional)
- **Macro Search**: Bing public search

---

## Quick Start

### Requirements

- Node.js >= 20
- pnpm >= 10
- PostgreSQL database

### Install Dependencies

```bash
git clone https://github.com/darrenli6/stock-analysis-helper.git
cd stock-analysis-helper
pnpm install
```

### Configure Environment Variables

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/stock` |
| `AUTH_SECRET` | Production | NextAuth signing key — generate with `openssl rand -base64 32` |
| `OPENAI_API_KEY` | Optional | Enables AI summaries + bear side of debate (OpenAI) |
| `DEEPSEEK_API_KEY` | Optional | Enables intent classification priority + bull side of debate (DeepSeek) |
| `TAVILY_API_KEY` | Optional | Enables news intelligence feature |
| `SHOUQUAN_163_EMAIL` | Optional | 163 mail authorization code for email sending (format: `user@163.com----authcode`) |
| `FROM_EMAIL` | Optional | Sender email address, e.g. `user@163.com` |

### Initialize Database

```bash
pnpm db:push
```

### Start Dev Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment

```bash
pnpm build
pnpm start
```

Supports any Node.js-compatible platform (Vercel, Railway, self-hosted, etc.).

> Note: `westock-data-clawhub` CLI is downloaded on demand via `npx` at runtime — your server needs outbound internet access.

---

## Example Queries

Type in the search box:

- `Analyze Kweichow Moutai` — Full A-share analysis
- `Should I buy Tencent now?` — HK stock analysis
- `How is NVDA's technical setup?` — US stock analysis
- `Check BYD for me` — Natural language intent recognition

---

## License

This project uses a custom non-commercial open-source license. See [LICENSE](LICENSE).

- Permitted: view source, fork, learn, non-commercial use
- **Prohibited**: unauthorized commercial use
- Commercial use requires written authorization from the author

---

## Contact

For commercial licensing or any questions, please open a GitHub Issue.

---

## More Content · Dalun's AI Universe

![Dalun's AI Universe](public/达轮的AI星球.webp)

Follow **达轮的AI星球** for in-depth content on AI tools, agent development, and frontier model exploration.
