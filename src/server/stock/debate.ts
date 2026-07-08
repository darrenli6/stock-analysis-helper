import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "~/server/db";
import { stockDebates, stockDebateMessages } from "~/server/db/schema";
import { env } from "~/env";
import type { AnalysisResult } from "~/types";

const TOTAL_ROUNDS = 10;

// ── BATTLE_PRD / BATTLE_MODEL 解析 ───────────────────────────────────────────

// BATTLE_PRD="KIMI,DEEPSEEK"  →  bullPrd="KIMI"  bearPrd="DEEPSEEK"
// BATTLE_MODEL="kimi-k2.6,deepseek-v4-pro"  →  bullModel="kimi-k2.6"  bearModel="deepseek-v4-pro"

function parseBattleConfig() {
  const prds = (env.BATTLE_PRD ?? "DEEPSEEK,OPENAI").split(",").map((s) => s.trim().toUpperCase());
  const models = (env.BATTLE_MODEL ?? "deepseek-v4-pro,gpt-4o-mini").split(",").map((s) => s.trim());
  return {
    bullPrd: prds[0] ?? "DEEPSEEK",
    bearPrd: prds[1] ?? "OPENAI",
    bullModel: models[0] ?? "deepseek-v4-pro",
    bearModel: models[1] ?? "gpt-4o-mini",
  };
}

// ── 分析摘要 ──────────────────────────────────────────────────────────────────

function buildAnalysisSummary(result: AnalysisResult): string {
  const { stock, technical, backtest, macro, recommendation, financialAnalysis } = result;
  const actionText =
    recommendation.action === "buy" ? "买入" :
    recommendation.action === "watch" ? "观察" : "回避";

  const lines = [
    `股票：${stock.name}（${stock.code.toUpperCase()}）`,
    `最新价：${technical.price?.toFixed(2) ?? "—"} ${technical.currency}`,
    `技术评分：${technical.score}/100，评级：${technical.rating}，信号：${technical.signal}`,
    `技术摘要：${technical.summary}`,
    `买入条件满足：${technical.buySatisfied}/7，高位预警触发：${technical.warningCount}/6`,
    `历史回测（${backtest.window}）：收益 ${backtest.returnPct?.toFixed(2) ?? "—"}%，趋势 ${backtest.trend}，最高 ${backtest.maxClose?.toFixed(2) ?? "—"}，最低 ${backtest.minClose?.toFixed(2) ?? "—"}`,
    `行业景气：${macro.industryCycle}`,
    `公司治理：${macro.governance}`,
    `宏观经济：${macro.macroEconomy}`,
    `综合建议：${actionText}，置信度 ${recommendation.confidence}%`,
    `止盈参考：${recommendation.takeProfit?.toFixed(2) ?? "—"}，止损参考：${recommendation.stopLoss?.toFixed(2) ?? "—"}`,
  ];

  if (financialAnalysis?.summary) {
    lines.push(`财务摘要：${financialAnalysis.summary}`);
  }

  return lines.join("\n");
}

// ── AI 调用 ───────────────────────────────────────────────────────────────────

type Message = { role: "system" | "user" | "assistant"; content: string };

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  label: string;
}

function getProviderConfig(prd: string, model: string): ProviderConfig {
  switch (prd) {
    case "KIMI":
      return {
        baseUrl: "https://api.moonshot.cn/v1/chat/completions",
        apiKey: env.KIMI_AI_KEY ?? "",
        model,
        label: "kimi",
      };
    case "DEEPSEEK":
      return {
        baseUrl: "https://api.deepseek.com/chat/completions",
        apiKey: env.DEEPSEEK_API_KEY ?? "",
        model,
        label: "deepseek",
      };
    case "OPENAI":
    default:
      return {
        baseUrl: "https://api.openai.com/v1/chat/completions",
        apiKey: env.OPENAI_API_KEY ?? "",
        model,
        label: "openai",
      };
  }
}

async function callProvider(cfg: ProviderConfig, messages: Message[]): Promise<string> {
  if (!cfg.apiKey) throw new Error(`${cfg.label} API Key 未配置`);

  const res = await fetch(cfg.baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream: false,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${cfg.label} error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error(`${cfg.label} 返回内容为空`);
  return text;
}

// ── Prompt 构建 ───────────────────────────────────────────────────────────────

const BULL_SYSTEM = (stockName: string) =>
  `你是 Bull（多头买方），一位激进的基金经理。\
你的目标是基于量化分析数据，说服对方现在应该买入${stockName}。\
每次发言不超过180字，观点犀利，必须引用具体数据。\
只输出你的发言正文，不要有任何前缀或说明。`;

const BEAR_SYSTEM = (stockName: string) =>
  `你是 Bear（空头卖方），一位谨慎的风险分析师。\
你的目标是基于量化分析数据，说服对方现在应该回避或卖出${stockName}。\
每次发言不超过180字，观点犀利，必须引用具体数据。\
只输出你的发言正文，不要有任何前缀或说明。`;

const ROUND_INSTRUCTION: Record<number, { bull: string; bear: string }> = {
  1: {
    bull: "请给出3个最强的买入理由，结合具体技术指标和宏观数据。",
    bear: "请针对多头的买入理由逐一反驳，并给出3个做空/回避的核心论据。",
  },
  2: {
    bull: "针对空方的反驳，逐条回应并补充新的多头证据。",
    bear: "继续攻防，抓住多头最薄弱的论点深入反驳，并提出新的风险警示。",
  },
  3: {
    bull: "这是最后一轮，给出你最有力的总结性买入陈词，点明核心逻辑。",
    bear: "这是最后一轮，给出你最有力的总结性回避陈词，点明核心风险。",
  },
};

function buildMessages(
  side: "bull" | "bear",
  round: number,
  stockName: string,
  analysisSummary: string,
  history: { side: string; content: string }[],
): Message[] {
  const system = side === "bull" ? BULL_SYSTEM(stockName) : BEAR_SYSTEM(stockName);
  const instruction = ROUND_INSTRUCTION[round]?.[side] ?? "请继续辩论。";

  const userContent = [
    "【量化分析数据】",
    analysisSummary,
    "",
    ...(history.length > 0
      ? ["【辩论历史】", ...history.map((m) => `${m.side === "bull" ? "🐂 买方" : "🐻 卖方"}：${m.content}`), ""]
      : []),
    `【你的任务（第${round}轮）】${instruction}`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ];
}

// ── 数据库操作 ─────────────────────────────────────────────────────────────────

async function getDebate(debateId: string) {
  const [debate] = await db
    .select()
    .from(stockDebates)
    .where(eq(stockDebates.id, debateId))
    .limit(1);
  return debate ?? null;
}

async function getExistingMessage(debateId: string, round: number, side: string) {
  const [msg] = await db
    .select()
    .from(stockDebateMessages)
    .where(
      and(
        eq(stockDebateMessages.debateId, debateId),
        eq(stockDebateMessages.round, round),
        eq(stockDebateMessages.side, side),
      )
    )
    .limit(1);
  return msg ?? null;
}

async function getAllMessages(debateId: string) {
  return db
    .select()
    .from(stockDebateMessages)
    .where(eq(stockDebateMessages.debateId, debateId))
    .orderBy(asc(stockDebateMessages.id));
}

async function saveMessage(
  debateId: string,
  round: number,
  side: "bull" | "bear",
  provider: string,
  content: string,
) {
  await db.insert(stockDebateMessages).values({ debateId, round, side, provider, content });
}

async function setDebateStatus(debateId: string, status: string) {
  await db
    .update(stockDebates)
    .set({ status, updatedAt: new Date() })
    .where(eq(stockDebates.id, debateId));
}

// ── 核心辩论流程 ──────────────────────────────────────────────────────────────

async function processDebate(debateId: string, result: AnalysisResult) {
  const analysisSummary = buildAnalysisSummary(result);
  const stockName = result.stock.name;
  const { bullPrd, bearPrd, bullModel, bearModel } = parseBattleConfig();
  const bullCfg = getProviderConfig(bullPrd, bullModel);
  const bearCfg = getProviderConfig(bearPrd, bearModel);

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    for (const side of ["bull", "bear"] as const) {
      // 已有该消息则跳过（断点续传）
      const existing = await getExistingMessage(debateId, round, side);
      if (existing) continue;

      // 检查是否暂停
      const debate = await getDebate(debateId);
      if (!debate || debate.status === "paused") return;

      // 获取已有消息作为上下文
      const history = (await getAllMessages(debateId)).map((m) => ({
        side: m.side,
        content: m.content,
      }));

      const messages = buildMessages(side, round, stockName, analysisSummary, history);
      const cfg = side === "bull" ? bullCfg : bearCfg;

      console.log(
        `\n${"─".repeat(60)}\n` +
        `[debate] debateId=${debateId} round=${round} side=${side} provider=${cfg.label} model=${cfg.model}\n` +
        `${"─".repeat(60)}\n` +
        messages.map((m) => `[${m.role.toUpperCase()}]\n${m.content}`).join("\n\n") +
        `\n${"─".repeat(60)}\n`
      );

      try {
        const content = await callProvider(cfg, messages);

        console.log(
          `[debate] round=${round} side=${side} provider=${cfg.label} ✅ 回复长度=${content.length}\n` +
          `[REPLY]\n${content}\n${"─".repeat(60)}\n`
        );

        await saveMessage(debateId, round, side, cfg.label, content);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI 调用失败";
        console.error(`[debate] round=${round} side=${side} ❌ error: ${msg}`);
        await saveMessage(debateId, round, side, cfg.label, `[生成失败：${msg}]`);
      }
    }
  }

  await setDebateStatus(debateId, "completed");
}

// ── 公开接口 ──────────────────────────────────────────────────────────────────

export async function createDebate(taskId: string, result: AnalysisResult) {
  const [debate] = await db
    .insert(stockDebates)
    .values({
      taskId,
      stockCode: result.stock.code,
      stockName: result.stock.name,
      status: "running",
      totalRounds: TOTAL_ROUNDS,
    })
    .returning();

  if (!debate) throw new Error("创建辩论失败");

  // 后台异步执行
  setTimeout(() => {
    void processDebate(debate.id, result).catch((err) => {
      console.error("[debate] processDebate failed", err);
      void setDebateStatus(debate.id, "failed");
    });
  }, 0);

  return debate;
}

export async function getDebateSnapshot(debateId: string, afterMessageId?: number) {
  const debate = await getDebate(debateId);
  if (!debate) return null;

  const conditions = [eq(stockDebateMessages.debateId, debateId)];
  if (afterMessageId) conditions.push(gt(stockDebateMessages.id, afterMessageId));

  const messages = await db
    .select()
    .from(stockDebateMessages)
    .where(and(...conditions))
    .orderBy(asc(stockDebateMessages.id));

  return { debate, messages };
}

export async function toggleDebate(debateId: string, result: AnalysisResult) {
  const debate = await getDebate(debateId);
  if (!debate) return null;

  if (debate.status === "paused") {
    // 恢复：设为 running 并重新启动后台处理
    await setDebateStatus(debateId, "running");
    setTimeout(() => {
      void processDebate(debateId, result).catch((err) => {
        console.error("[debate] resume processDebate failed", err);
        void setDebateStatus(debateId, "failed");
      });
    }, 0);
    return "running";
  }

  if (debate.status === "running") {
    await setDebateStatus(debateId, "paused");
    return "paused";
  }

  return debate.status;
}

// 供前端图例使用：返回当前配置的买卖方 provider label
export function getBattleLabels() {
  const { bullPrd, bearPrd, bullModel, bearModel } = parseBattleConfig();
  return {
    bull: { prd: bullPrd, model: bullModel, label: getProviderConfig(bullPrd, bullModel).label },
    bear: { prd: bearPrd, model: bearModel, label: getProviderConfig(bearPrd, bearModel).label },
  };
}
