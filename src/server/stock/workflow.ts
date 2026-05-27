import { and, asc, eq, gt } from "drizzle-orm";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "~/server/db";
import { travelTaskLogs, travelTasks } from "~/server/db/schema";
import { env } from "~/env";
import type { FundAnalysisData } from "~/types";

const execFileAsync = promisify(execFile);

type IntentResult = {
  supported: boolean;
  reason: string;
  stockQuery?: string;
};

type SearchMatch = {
  code: string;
  name: string;
  market?: string;
};

type AnalysisPayload = {
  taskId: string;
  stock: SearchMatch;
  company: {
    name: string;
    listedDate: string | null;
    website: string | null;
    chairman: string | null;
    industry: string | null;
    regAddress: string | null;
    tel: string | null;
    email: string | null;
    introduction: string | null;
    business: string | null;
  };
  overview: {
    query: string;
    status: string;
    generatedAt: string;
  };
  technical: {
    price: number | null;
    currency: string;
    indicators: Record<string, unknown>;
    signal: string;
    summary: string;
    score: number;
    rating: string;
    buySatisfied: number;
    warningCount: number;
    buyConditions: Array<{
      name: string;
      passed: boolean;
      reason: string;
    }>;
    warnings: Array<{
      name: string;
      triggered: boolean;
      reason: string;
    }>;
  };
  macro: {
    industryCycle: string;
    governance: string;
    macroEconomy: string;
    summary: string;
  };
  backtest: {
    window: string;
    trend: string;
    maxClose: number | null;
    minClose: number | null;
    returnPct: number | null;
    summary: string;
  };
  recommendation: {
    action: "buy" | "watch" | "avoid";
    confidence: number;
    rationale: string[];
    takeProfit: number | null;
    stopLoss: number | null;
  };
  fundAnalysis: FundAnalysisData | null;
};

type CliResult = {
  stdout: string;
  parsed: unknown;
};

function coerceTableValue(value: string) {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "-") return null;
  const normalized = trimmed.replace(/,/g, "");
  const asNumber = Number(normalized);
  return Number.isFinite(asNumber) ? asNumber : trimmed;
}

function setNestedValue(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = target;

  for (const [index, part] of parts.entries()) {
    if (index === parts.length - 1) {
      cursor[part] = value;
      return;
    }

    const current = cursor[part];
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
}

function parseMarkdownTable(stdout: string) {
  const rawLines = stdout.split("\n");
  const mergedLines: string[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trimEnd();
    if (!trimmed.trim()) continue;

    if (
      mergedLines.length > 0 &&
      !trimmed.trimStart().startsWith("|") &&
      !trimmed.trimStart().startsWith("---")
    ) {
      mergedLines[mergedLines.length - 1] =
        `${mergedLines[mergedLines.length - 1]} ${trimmed.trim()}`;
      continue;
    }

    mergedLines.push(trimmed.trim());
  }

  const lines = mergedLines.filter(Boolean);

  const headerIndex = lines.findIndex(
    (line, index) => line.startsWith("|") && lines[index + 1]?.match(/^\|\s*-+/)
  );

  if (headerIndex === -1) return null;

  const headerLine = lines[headerIndex]!;
  const headers = headerLine
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);

  const records: Record<string, unknown>[] = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter((_, index, arr) => !(index === 0 && arr[index] === ""));

    if (cells.length < headers.length) continue;

    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      setNestedValue(row, header, coerceTableValue(cells[index] ?? ""));
    });
    records.push(row);
  }

  return records.length > 0 ? records : null;
}

function debugTask(taskId: string, scope: string, message: string, payload?: unknown) {
  const prefix = `[stock-task:${taskId}] [${scope}]`;
  if (payload === undefined) {
    console.log(prefix, message);
    return;
  }

  console.log(prefix, message, payload);
}

const stepLabel: Record<number, string> = {
  0: "初始化任务",
  1: "解析用户意图",
  2: "搜索股票并识别标的",
  3: "采集技术面与基本面数据",
  4: "生成宏观环境与回测结论",
  5: "整理买卖建议",
  6: "写入最终结果",
};

function getStepLabel(step: number) {
  return stepLabel[step] ?? `步骤 ${step}`;
}

const stockIntentKeywords = [
  "股票",
  "个股",
  "港股",
  "美股",
  "a股",
  "基金",
  "etf",
  "买入",
  "卖出",
  "止盈",
  "止损",
  "技术指标",
  "回测",
  "腾讯",
  "苹果",
  "特斯拉",
];

const stockRequestNoise = [
  "分析",
  "现在是否适合买入",
  "是否适合买入",
  "适合买入吗",
  "值不值得买",
  "给我",
  "技术指标",
  "宏观环境",
  "历史回测",
  "止盈止损建议",
  "止盈止损",
  "买卖建议",
  "建议",
  "情况",
  "一下",
  "看看",
  "帮我",
  "请问",
  "推荐",
  "怎么操作",
];

function extractStockQuery(userInput: string) {
  const normalized = userInput
    .replace(/[，。！？、；：,.!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const codeMatch = normalized.match(/\b(hk\d{5}|us[A-Za-z.\-]+|sh\d{6}|sz\d{6}|bj\d{6})\b/);
  if (codeMatch) {
    return codeMatch[1]!.trim();
  }

  const patterns = [
    /分析\s*([^\s]{2,20}?)(?:现在|是否|适不适合|值不值得|给我|的|买入|卖出|走势|情况|并|，|,|。|$)/,
    /看看\s*([^\s]{2,20}?)(?:现在|是否|适不适合|值不值得|给我|的|买入|卖出|走势|情况|并|，|,|。|$)/,
    /([^\s]{2,20}?)(?:现在|是否|适不适合|值不值得|给我|的|买入|卖出|走势|情况|并|，|,|。|$)/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate && !stockIntentKeywords.includes(candidate)) {
      return candidate;
    }
  }

  let cleaned = normalized;
  for (const noise of stockRequestNoise) {
    cleaned = cleaned.replaceAll(noise, " ");
  }

  cleaned = cleaned.replace(/\s+/g, " ").trim();
  const tokens = cleaned.split(" ").filter(Boolean);
  return tokens[0] ?? normalized;
}

function inferCurrency(code: string) {
  if (code.startsWith("hk")) return "HKD";
  if (code.startsWith("us")) return "USD";
  return "CNY";
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function logTask(
  taskId: string,
  step: number,
  logType: "log" | "step_start" | "step_done" | "result" | "error",
  message: string,
  payload?: unknown
) {
  debugTask(taskId, `${step}/${logType}`, message, payload);
  debugTask(taskId, `${step}/${logType}`, "before insert travel_task_logs", {
    step,
    logType,
    message,
  });
  await db.insert(travelTaskLogs).values({
    taskId,
    step,
    logType,
    message,
    payload: payload as Record<string, unknown> | undefined,
  });
  debugTask(taskId, `${step}/${logType}`, "after insert travel_task_logs");
}

async function setTaskStatus(
  taskId: string,
  status: "pending" | "running" | "completed" | "failed",
  destination?: string | null
) {
  await db
    .update(travelTasks)
    .set({
      status,
      ...(destination !== undefined ? { destination } : {}),
      updatedAt: new Date(),
    })
    .where(eq(travelTasks.id, taskId));
}

async function runWestockCommand(args: string[]) {
  const startedAt = Date.now();
  const command = ["npx", "-y", "westock-data-clawhub@1.0.4", ...args].join(" ");
  console.log("[westock] start", command);

  const { stdout, stderr } = await execFileAsync(
    "npx",
    ["-y", "westock-data-clawhub@1.0.4", ...args],
    {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 10,
    }
  );

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = parseMarkdownTable(stdout);
  }

  console.log("[westock] done", {
    command,
    durationMs: Date.now() - startedAt,
    stdoutPreview: stdout.slice(0, 240),
    stderrPreview: stderr?.slice(0, 240) ?? "",
    parsed: parsed !== null,
  });

  return { stdout, parsed } satisfies CliResult;
}

type FundCommands = {
  fund: string[];
  margin: string[] | null;
  lhb: string[] | null;
  blockTrade: string[] | null;
  market: FundAnalysisData["market"];
};

function buildFundCommands(code: string): FundCommands {
  if (code.startsWith("hk")) {
    return { fund: ["hkfund", code], margin: null, lhb: null, blockTrade: null, market: "hk" };
  }
  if (code.startsWith("us")) {
    return { fund: ["usfund", code], margin: null, lhb: null, blockTrade: null, market: "us" };
  }
  const canLhbBlock = code.startsWith("sh") || code.startsWith("sz");
  return {
    fund: ["asfund", code],
    margin: ["margintrade", code],
    lhb: canLhbBlock ? ["lhb", code] : null,
    blockTrade: canLhbBlock ? ["blocktrade", code] : null,
    market: "as",
  };
}

function maybeRun(args: string[] | null): Promise<CliResult | null> {
  if (!args) return Promise.resolve(null);
  return runWestockCommand(args).catch(() => null);
}

function toRows(result: CliResult | null): Record<string, unknown>[] | null {
  if (!result) return null;
  if (Array.isArray(result.parsed) && result.parsed.length > 0) {
    return result.parsed as Record<string, unknown>[];
  }
  return null;
}

function normalizeSearchResult(result: CliResult, fallbackQuery: string): SearchMatch | null {
  const parsed = result.parsed;
  if (Array.isArray(parsed) && parsed.length > 0) {
    const first = parsed[0] as Record<string, unknown>;
    const code = String(first.code ?? first.symbol ?? first.stockCode ?? "").trim().toLowerCase();
    const name = String(first.name ?? first.stock_name ?? first.stockName ?? fallbackQuery).trim();
    if (code) return { code, name, market: String(first.market ?? "") || undefined };
  }

  if (parsed && typeof parsed === "object") {
    const records = Object.values(parsed as Record<string, unknown>).find(Array.isArray);
    if (Array.isArray(records) && records.length > 0) {
      const first = records[0] as Record<string, unknown>;
      const code = String(first.code ?? first.symbol ?? "").trim().toLowerCase();
      const name = String(first.name ?? first.stock_name ?? fallbackQuery).trim();
      if (code) return { code, name, market: String(first.market ?? "") || undefined };
    }
  }

  const codeMatch = result.stdout.match(/\b(hk\d{5}|us[A-Z.\-]+|sh\d{6}|sz\d{6}|bj\d{6})\b/i);
  if (!codeMatch) return null;

  return {
    code: codeMatch[1]!.toLowerCase(),
    name: fallbackQuery,
  };
}

async function classifyIntent(userInput: string): Promise<IntentResult> {
  const normalized = userInput.trim();
  const extractedStockQuery = extractStockQuery(normalized);
  const localSupported = stockIntentKeywords.some((keyword) =>
    normalized.toLowerCase().includes(keyword.toLowerCase())
  );

  if (!env.OPENAI_API_KEY) {
    return localSupported
      ? {
          supported: true,
          reason: "命中本地股票分析关键词",
          stockQuery: extractedStockQuery,
        }
      : { supported: false, reason: "未识别到股票投资分析意图" };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content:
              "你是一个意图分类器。只判断用户是否在请求股票、ETF、指数相关的投资分析。输出 JSON：{supported:boolean,reason:string,stockQuery?:string}。",
          },
          {
            role: "user",
            content: normalized,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(`OpenAI error ${response.status}`);

    const data = (await response.json()) as {
      output_text?: string;
    };

    const parsed = JSON.parse(data.output_text ?? "{}") as IntentResult;
    if (typeof parsed.supported === "boolean") {
      return {
        ...parsed,
        stockQuery: parsed.stockQuery?.trim() || extractedStockQuery,
      };
    }
  } catch {
    return localSupported
      ? {
          supported: true,
          reason: "OpenAI 不可用，回退到本地关键词判断",
          stockQuery: extractedStockQuery,
        }
      : { supported: false, reason: "OpenAI 不可用且本地规则未识别为股票请求" };
  }

  return localSupported
    ? {
        supported: true,
        reason: "本地规则判断为股票请求",
        stockQuery: extractedStockQuery,
      }
    : { supported: false, reason: "不支持当前请求" };
}

function summarizeTechnical(
  technical: Record<string, unknown>,
  currentPrice: number | null,
  klineList: Record<string, unknown>[]
) {
  const ma = technical.ma as Record<string, unknown> | undefined;
  const macd = technical.macd as Record<string, unknown> | undefined;
  const kdj = technical.kdj as Record<string, unknown> | undefined;
  const rsi = technical.rsi as Record<string, unknown> | undefined;
  const dmi = technical.dmi as Record<string, unknown> | undefined;
  const boll = technical.boll as Record<string, unknown> | undefined;
  const other = technical.other as Record<string, unknown> | undefined;

  const ma5 = toNumber(ma?.MA5 ?? ma?.MA_5);
  const ma10 = toNumber(ma?.MA10 ?? ma?.MA_10);
  const ma20 = toNumber(ma?.MA20 ?? ma?.MA_20);
  const ma60 = toNumber(ma?.MA60 ?? ma?.MA_60);
  const dif = toNumber(macd?.DIF);
  const dea = toNumber(macd?.DEA);
  const k = toNumber(kdj?.K ?? kdj?.KDJ_K);
  const d = toNumber(kdj?.D ?? kdj?.KDJ_D);
  const j = toNumber(kdj?.J ?? kdj?.KDJ_J);
  const rsi12 = toNumber(rsi?.RSI12 ?? rsi?.RSI_12);
  const bollUpper = toNumber(boll?.BOLL_UPPER);
  const pdi = toNumber(dmi?.PDI);
  const mdi = toNumber(dmi?.MDI);
  const adx = toNumber(dmi?.ADX);
  const obv = toNumber(other?.OBV ?? other?.["other.OBV"]);

  const volumes = klineList
    .map((item) => toNumber(item.volume ?? item.vol))
    .filter((value): value is number => value !== null);
  const closes = klineList
    .map((item) => toNumber(item.close ?? item.closePrice ?? item.last ?? item.price))
    .filter((value): value is number => value !== null);

  const currentVolume = volumes.at(-1) ?? null;
  const avgVolume5 =
    volumes.length >= 5 ? average(volumes.slice(-5)) : average(volumes);
  const recentRise5 =
    closes.length >= 6
      ? (((closes.at(-1) ?? 0) - (closes.at(-6) ?? 0)) / (closes.at(-6) ?? 1)) * 100
      : null;
  const deviationMa20 =
    currentPrice !== null && ma20 !== null && ma20 !== 0
      ? ((currentPrice - ma20) / ma20) * 100
      : null;
  const obvPrev = klineList.length >= 2 ? toNumber((klineList.at(-2) as Record<string, unknown> | undefined)?.OBV) : null;
  const pricePrev =
    closes.length >= 2 ? closes.at(-2) ?? null : null;

  const buyConditions = [
    {
      name: "均线多头排列",
      passed: ma5 !== null && ma10 !== null && ma20 !== null && ma60 !== null && ma5 > ma10 && ma10 > ma20 && ma20 > ma60,
      reason:
        ma5 !== null && ma10 !== null && ma20 !== null && ma60 !== null
          ? `MA5=${ma5.toFixed(2)}，MA10=${ma10.toFixed(2)}，MA20=${ma20.toFixed(2)}，MA60=${ma60.toFixed(2)}`
          : "均线数据不足",
    },
    {
      name: "MACD金叉",
      passed: dif !== null && dea !== null && dif > dea && dif > 0 && dea > 0,
      reason:
        dif !== null && dea !== null
          ? `DIF=${dif.toFixed(2)}，DEA=${dea.toFixed(2)}`
          : "MACD 数据不足",
    },
    {
      name: "KDJ金叉",
      passed: k !== null && d !== null && k > d && k >= 20 && k <= 80,
      reason:
        k !== null && d !== null && j !== null
          ? `K=${k.toFixed(2)}，D=${d.toFixed(2)}，J=${j.toFixed(2)}`
          : "KDJ 数据不足",
    },
    {
      name: "RSI适中",
      passed: rsi12 !== null && rsi12 >= 50 && rsi12 <= 70,
      reason: rsi12 !== null ? `RSI12=${rsi12.toFixed(2)}` : "RSI 数据不足",
    },
    {
      name: "价格站上MA20",
      passed: currentPrice !== null && ma20 !== null && currentPrice > ma20,
      reason:
        currentPrice !== null && ma20 !== null
          ? `收盘价=${currentPrice.toFixed(2)}，MA20=${ma20.toFixed(2)}`
          : "价格或 MA20 数据不足",
    },
    {
      name: "成交量放大",
      passed: currentVolume !== null && avgVolume5 !== null && currentVolume > avgVolume5 * 1.3,
      reason:
        currentVolume !== null && avgVolume5 !== null
          ? `当前量=${currentVolume.toFixed(2)}，5日均量=${avgVolume5.toFixed(2)}`
          : "成交量数据不足",
    },
    {
      name: "DMI多头",
      passed: pdi !== null && mdi !== null && adx !== null && pdi > mdi && adx > 20,
      reason:
        pdi !== null && mdi !== null && adx !== null
          ? `PDI=${pdi.toFixed(2)}，MDI=${mdi.toFixed(2)}，ADX=${adx.toFixed(2)}`
          : "DMI 数据不足",
    },
  ];

  const warnings = [
    {
      name: "KDJ超买",
      triggered: k !== null && k > 70,
      reason: k !== null ? `K=${k.toFixed(2)}` : "KDJ 数据不足",
    },
    {
      name: "RSI超买",
      triggered: rsi12 !== null && rsi12 > 65,
      reason: rsi12 !== null ? `RSI12=${rsi12.toFixed(2)}` : "RSI 数据不足",
    },
    {
      name: "偏离MA20",
      triggered: deviationMa20 !== null && deviationMa20 > 15,
      reason:
        deviationMa20 !== null ? `偏离度=${deviationMa20.toFixed(2)}%` : "MA20 偏离度不足",
    },
    {
      name: "突破布林带上轨",
      triggered: currentPrice !== null && bollUpper !== null && currentPrice > bollUpper,
      reason:
        currentPrice !== null && bollUpper !== null
          ? `收盘价=${currentPrice.toFixed(2)}，上轨=${bollUpper.toFixed(2)}`
          : "布林带数据不足",
    },
    {
      name: "近期涨幅过大",
      triggered: recentRise5 !== null && recentRise5 > 25,
      reason: recentRise5 !== null ? `近5日涨幅=${recentRise5.toFixed(2)}%` : "历史价格数据不足",
    },
    {
      name: "OBV背离",
      triggered:
        obv !== null &&
        obvPrev !== null &&
        currentPrice !== null &&
        pricePrev !== null &&
        currentPrice > pricePrev &&
        obv < obvPrev,
      reason:
        obv !== null && obvPrev !== null
          ? `当前OBV=${obv.toFixed(2)}，前值OBV=${obvPrev.toFixed(2)}`
          : "OBV 数据不足",
    },
  ];

  const bullishSignals = buyConditions.filter((item) => item.passed).length;
  const warningCount = warnings.filter((item) => item.triggered).length;
  const score = Math.max(0, Math.min(100, bullishSignals * 10 - warningCount * 5 + 50));
  const rating =
    score >= 85
      ? "强烈推荐买入"
      : score >= 70
        ? "推荐买入"
        : score >= 60
          ? "谨慎买入"
          : score >= 50
            ? "观望"
            : "不建议买入";
  const signal =
    score >= 70 ? "偏强" : score >= 50 ? "中性" : "谨慎";

  return {
    signal,
    summary: `技术评分 ${score} 分，评级为${rating}；7 个买入条件满足 ${bullishSignals} 个，6 个高位预警触发 ${warningCount} 个。`,
    score,
    rating,
    buySatisfied: bullishSignals,
    warningCount,
    buyConditions,
    warnings,
  };
}

function summarizeMacro(profile: Record<string, unknown> | null) {
  const industry =
    String(profile?.industry ?? profile?.industryName ?? profile?.sector ?? "未披露").trim();
  const governance =
    String(profile?.chairman ?? profile?.legalRepresentative ?? profile?.ceo ?? "公开信息有限").trim();

  return {
    industryCycle: industry === "未披露" ? "行业信息不足，按中性处理" : `${industry}，需结合景气度跟踪`,
    governance:
      governance === "公开信息有限"
        ? "治理披露有限，建议补充公告与财报核查"
        : `核心管理层信息已披露，重点关注 ${governance}`,
    macroEconomy: "宏观环境未接入实时新闻流，当前按中性偏谨慎假设处理。",
    summary: "宏观模块采用静态信息与保守假设，适合作为初筛，不应替代实时研究。",
  };
}

function summarizeBacktest(klineList: Record<string, unknown>[]) {
  const closes = klineList
    .map((item) => toNumber(item.close ?? item.last ?? item.price))
    .filter((value): value is number => value !== null);

  const first = closes[0] ?? null;
  const last = closes.at(-1) ?? null;
  const returnPct = first !== null && last !== null ? ((last - first) / first) * 100 : null;

  let trend = "震荡";
  if (returnPct !== null && returnPct > 8) trend = "上行";
  if (returnPct !== null && returnPct < -8) trend = "下行";

  return {
    window: `${closes.length} 个交易日`,
    trend,
    maxClose: closes.length ? Math.max(...closes) : null,
    minClose: closes.length ? Math.min(...closes) : null,
    returnPct,
    summary:
      returnPct === null
        ? "历史回测数据不足。"
        : `过去 ${closes.length} 个交易日区间收益 ${returnPct.toFixed(2)}%，走势判定为${trend}。`,
  };
}

function buildRecommendation(
  currentPrice: number | null,
  technicalSignal: string,
  backtestReturnPct: number | null
): AnalysisPayload["recommendation"] {
  const confidenceBase =
    technicalSignal === "偏强" ? 78 : technicalSignal === "中性偏强" ? 62 : 42;
  const adjustedConfidence =
    backtestReturnPct === null
      ? confidenceBase
      : Math.max(20, Math.min(90, confidenceBase + Math.round(backtestReturnPct / 4)));

  const action: AnalysisPayload["recommendation"]["action"] =
    adjustedConfidence >= 72 ? "buy" : adjustedConfidence >= 55 ? "watch" : "avoid";
  const takeProfit = currentPrice !== null ? Number((currentPrice * 1.12).toFixed(2)) : null;
  const stopLoss = currentPrice !== null ? Number((currentPrice * 0.94).toFixed(2)) : null;

  return {
    action,
    confidence: adjustedConfidence,
    rationale: [
      `技术信号：${technicalSignal}`,
      backtestReturnPct === null
        ? "历史走势：数据不足"
        : `历史走势：近阶段收益 ${backtestReturnPct.toFixed(2)}%`,
      "风控参数基于固定比例生成，实盘前仍需结合仓位与波动率调整。",
    ] as string[],
    takeProfit,
    stopLoss,
  };
}

async function getLatestTaskResult(taskId: string) {
  const resultLogs = await db
    .select()
    .from(travelTaskLogs)
    .where(and(eq(travelTaskLogs.taskId, taskId), eq(travelTaskLogs.logType, "result")))
    .orderBy(asc(travelTaskLogs.id));

  return resultLogs.at(-1)?.payload ?? null;
}

export async function createAnalysisTask(userInput: string) {
  console.log("[createAnalysisTask] before insert travel_tasks", { userInput });
  const [task] = await db
    .insert(travelTasks)
    .values({
      userInput,
      status: "pending",
    })
    .returning();
  console.log("[createAnalysisTask] after insert travel_tasks", {
    taskId: task?.id ?? null,
    status: task?.status ?? null,
  });

  if (!task) throw new Error("创建任务失败");

  debugTask(task.id, "create", "task created", { userInput });
  await logTask(task.id, 0, "step_start", getStepLabel(0));
  await logTask(task.id, 0, "step_done", "任务已创建，等待执行");

  setTimeout(() => {
    debugTask(task.id, "schedule", "background processing dispatched");
    void processTask(task.id).catch((error) => {
      debugTask(task.id, "background-error", "unhandled processTask error", {
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }, 0);

  return task;
}

export async function processTask(taskId: string) {
  debugTask(taskId, "process", "task processing started");
  const [task] = await db.select().from(travelTasks).where(eq(travelTasks.id, taskId)).limit(1);
  if (!task) return;

  try {
    await setTaskStatus(taskId, "running");

    await logTask(taskId, 1, "step_start", getStepLabel(1));
    const intent = await classifyIntent(task.userInput);
    await logTask(taskId, 1, "log", intent.reason, intent);

    if (!intent.supported) {
      await logTask(taskId, 1, "error", "不支持当前请求，仅支持股票投资分析");
      await setTaskStatus(taskId, "failed");
      return;
    }
    await logTask(taskId, 1, "step_done", "意图识别完成");

    await logTask(taskId, 2, "step_start", getStepLabel(2));
    const resolvedSearchQuery = intent.stockQuery?.trim() || task.userInput;
    await logTask(taskId, 2, "log", `准备搜索标的：${resolvedSearchQuery}`, {
      originalInput: task.userInput,
      searchQuery: resolvedSearchQuery,
    });
    const searchResult = await runWestockCommand(["search", resolvedSearchQuery]);
    const stock = normalizeSearchResult(searchResult, resolvedSearchQuery);
    if (!stock) {
      await logTask(taskId, 2, "error", "未能识别股票代码", {
        raw: searchResult.stdout.slice(0, 2000),
      });
      await setTaskStatus(taskId, "failed");
      return;
    }
    await setTaskStatus(taskId, "running", stock.name);
    await logTask(taskId, 2, "log", `识别标的 ${stock.name} (${stock.code})`, stock);
    await logTask(taskId, 2, "step_done", "股票识别完成");

    await logTask(taskId, 3, "step_start", getStepLabel(3));
    const fundCmds = buildFundCommands(stock.code);
    const [
      klineResult, technicalResult, profileResult, financeResult,
      fundResult, marginResult, lhbResult, blockTradeResult,
    ] = await Promise.all([
      runWestockCommand(["kline", stock.code, "--period", "day", "--limit", "180"]),
      runWestockCommand(["technical", stock.code, "--group", "all"]),
      runWestockCommand(["profile", stock.code]),
      runWestockCommand(["finance", stock.code, "--num", "1"]),
      maybeRun(fundCmds.fund),
      maybeRun(fundCmds.margin),
      maybeRun(fundCmds.lhb),
      maybeRun(fundCmds.blockTrade),
    ]);

    const klineList =
      (Array.isArray(klineResult.parsed) ? klineResult.parsed : null) ??
      (((klineResult.parsed as Record<string, unknown> | null)?.data as Record<
        string,
        unknown
      > | null)?.items as Record<string, unknown>[] | undefined) ??
      (((klineResult.parsed as Record<string, unknown> | null)?.data as Record<
        string,
        unknown
      > | null)?.nodes as Record<string, unknown>[] | undefined) ??
      [];

    const technicalRaw =
      (Array.isArray(technicalResult.parsed) ? technicalResult.parsed.at(-1) : null) ??
      (((technicalResult.parsed as Record<string, unknown> | null)?.data as Record<
        string,
        unknown
      > | null)?.items as Record<string, unknown>[] | undefined)?.at(-1) ??
      (technicalResult.parsed as Record<string, unknown> | null) ??
      {};

    const profileRaw =
      (Array.isArray(profileResult.parsed) ? profileResult.parsed[0] : null) ??
      (((profileResult.parsed as Record<string, unknown> | null)?.data as Record<
        string,
        unknown
      > | null)?.items as Record<string, unknown>[] | undefined)?.[0] ??
      (profileResult.parsed as Record<string, unknown> | null);

    const financeRaw =
      (financeResult.parsed as Record<string, unknown> | null) ??
      ({ raw: financeResult.stdout.slice(0, 2000) } as Record<string, unknown>);

    const latestBar = klineList.at(-1) ?? null;
    const currentPrice = latestBar
      ? toNumber(
          latestBar.close ?? latestBar.closePrice ?? latestBar.last ?? latestBar.price
        )
      : null;
    const technicalSummary = summarizeTechnical(
      (technicalRaw ?? {}) as Record<string, unknown>,
      currentPrice,
      klineList
    );

    const fundAnalysis: FundAnalysisData = {
      market: fundCmds.market,
      flow: toRows(fundResult),
      margin: toRows(marginResult),
      lhb: toRows(lhbResult),
      blockTrade: toRows(blockTradeResult),
    };

    await logTask(taskId, 3, "log", "已完成行情、技术指标、公司资料与财报采集", {
      klineCount: klineList.length,
      hasTechnical: Boolean(technicalRaw),
      hasProfile: Boolean(profileRaw),
      hasFinance: Boolean(financeRaw),
      fundFlowRows: fundAnalysis.flow?.length ?? 0,
      marginRows: fundAnalysis.margin?.length ?? 0,
      lhbRows: fundAnalysis.lhb?.length ?? 0,
      blockTradeRows: fundAnalysis.blockTrade?.length ?? 0,
    });
    await logTask(taskId, 3, "step_done", "数据采集完成");

    await logTask(taskId, 4, "step_start", getStepLabel(4));
    const macro = summarizeMacro(profileRaw as Record<string, unknown> | null);
    const backtest = summarizeBacktest(klineList);
    await logTask(taskId, 4, "log", "宏观和回测模块已生成摘要", {
      macro,
      backtest,
    });
    await logTask(taskId, 4, "step_done", "宏观与回测生成完成");

    await logTask(taskId, 5, "step_start", getStepLabel(5));
    const recommendation = buildRecommendation(
      currentPrice,
      technicalSummary.signal,
      backtest.returnPct
    );
    await logTask(taskId, 5, "log", "已生成交易建议", recommendation);
    await logTask(taskId, 5, "step_done", "建议生成完成");

    await logTask(taskId, 6, "step_start", getStepLabel(6));
    const result: AnalysisPayload = {
      taskId,
      stock,
      company: {
        name: String(profileRaw?.name ?? stock.name ?? "").trim(),
        listedDate: String(profileRaw?.listedDate ?? "").trim() || null,
        website: String(profileRaw?.website ?? "").trim() || null,
        chairman: String(profileRaw?.chairman ?? "").trim() || null,
        industry: String(profileRaw?.industry ?? "").trim() || null,
        regAddress: String(profileRaw?.regAddress ?? "").trim() || null,
        tel: String(profileRaw?.tel ?? "").trim() || null,
        email: String(profileRaw?.email ?? "").trim() || null,
        introduction: String(profileRaw?.introduction ?? "").trim() || null,
        business: String(profileRaw?.business ?? "").trim() || null,
      },
      overview: {
        query: task.userInput,
        status: task.status,
        generatedAt: new Date().toISOString(),
      },
      technical: {
        price: currentPrice,
        currency: inferCurrency(stock.code),
        indicators: {
          technical: technicalRaw,
          latestBar,
          klineSeries: klineList,
          finance: financeRaw,
          averageClose20: average(
            klineList
              .slice(-20)
              .map((item) =>
                toNumber(item.close ?? item.closePrice ?? item.last ?? item.price)
              )
              .filter((value): value is number => value !== null)
          ),
        },
        signal: technicalSummary.signal,
        summary: technicalSummary.summary,
        score: technicalSummary.score,
        rating: technicalSummary.rating,
        buySatisfied: technicalSummary.buySatisfied,
        warningCount: technicalSummary.warningCount,
        buyConditions: technicalSummary.buyConditions,
        warnings: technicalSummary.warnings,
      },
      macro,
      backtest,
      recommendation,
      fundAnalysis,
    };

    await logTask(taskId, 6, "result", "分析完成", result);
    await logTask(taskId, 6, "step_done", "最终结果已写入");
    await setTaskStatus(taskId, "completed", stock.name);
    debugTask(taskId, "process", "task completed", {
      stock: stock.code,
      action: recommendation.action,
      confidence: recommendation.confidence,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    await logTask(taskId, 6, "error", message);
    await setTaskStatus(taskId, "failed");
    debugTask(taskId, "process", "task failed", { message });
  }
}

export async function getTaskSnapshot(taskId: string, afterLogId?: number) {
  const [task] = await db.select().from(travelTasks).where(eq(travelTasks.id, taskId)).limit(1);
  if (!task) return null;

  const conditions = [eq(travelTaskLogs.taskId, taskId)];
  if (afterLogId) conditions.push(gt(travelTaskLogs.id, afterLogId));

  const logs = await db
    .select()
    .from(travelTaskLogs)
    .where(and(...conditions))
    .orderBy(asc(travelTaskLogs.id));

  const result = task.status === "completed" ? await getLatestTaskResult(taskId) : null;

  return { task, logs, result };
}
