import { and, asc, eq, gt } from "drizzle-orm";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "~/server/db";
import { travelTaskLogs, travelTasks } from "~/server/db/schema";
import { env } from "~/env";
import type { ChipData, DividendData, DividendRow, FinancialAnalysisData, FinancialReport, FundAnalysisData, MacroAnalysisData, MacroSignal, ShareholderCountRow, ShareholderData, ShareholderRow } from "~/types";

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
  macroAnalysis: MacroAnalysisData | null;
  financialAnalysis: FinancialAnalysisData | null;
  chipData: ChipData | null;
  shareholderData: ShareholderData | null;
  dividendData: DividendData | null;
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

  const { stdout, stderr } = await execFileAsync("npx", ["-y", "westock-data-clawhub@1.0.4", ...args], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 10,
  });

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

// ── 财务报表多段落解析 ────────────────────────────────────────────────────────

const SECTION_KEY_MAP: Record<string, string> = {
  "十大股东": "top10",
  "十大流通股东": "top10liquid",
  "股东户数统计": "holdercount",
  "分红历史": "dividend",
};

function normalizeSectionKey(raw: string): string {
  return SECTION_KEY_MAP[raw] ?? raw.toLowerCase();
}

function parseMultiSectionMarkdown(stdout: string): Record<string, Record<string, unknown>[]> {
  const result: Record<string, Record<string, unknown>[]> = {};
  const lines = stdout.split("\n");
  let currentSection = "";
  let sectionLines: string[] = [];

  const flush = () => {
    if (currentSection && sectionLines.length > 0) {
      const records = parseMarkdownTable(sectionLines.join("\n"));
      if (records) result[currentSection] = records;
    }
    sectionLines = [];
  };

  for (const line of lines) {
    const sectionMatch = /^\*\*([^*]+)\*\*$/.exec(line.trim());
    if (sectionMatch) {
      flush();
      currentSection = normalizeSectionKey(sectionMatch[1]!.trim());
    } else {
      sectionLines.push(line);
    }
  }
  flush();

  return result;
}

function normalizeFinanceReports(
  lrbRows: Record<string, unknown>[] | null,
  zcfzRows: Record<string, unknown>[] | null,
  xjllRows: Record<string, unknown>[] | null,
  market: "as" | "hk" | "us"
): FinancialReport[] {
  const incomeRows = lrbRows ?? [];
  if (incomeRows.length === 0) return [];

  return incomeRows.map((lrb) => {
    const period = String(lrb.EndDate ?? lrb._date ?? "");

    // Match balance-sheet / cash-flow rows by period
    const zcfz = zcfzRows?.find((r) => String(r.EndDate ?? r._date) === period) ?? null;
    const xjll = xjllRows?.find((r) => String(r.EndDate ?? r._date) === period) ?? null;

    let revenue: number | null = null;
    let netProfit: number | null = null;
    let operatingProfit: number | null = null;
    let eps: number | null = null;
    let grossMargin: number | null = null;
    let netMargin: number | null = null;

    if (market === "us") {
      revenue = toNumber(lrb.Sales_Q);
      netProfit = toNumber(lrb.NetIncome_Q);
      operatingProfit = toNumber(lrb.EBIT_Q);
      eps = toNumber(lrb.BasicEPS_Q);
      const gm = toNumber(lrb.GrossMargin_Q);
      grossMargin = gm !== null ? gm / 100 : null;
      const nm = toNumber(lrb.NetMargin_Q);
      netMargin = nm !== null ? nm / 100 : null;
    } else {
      // A-share lrb / HK zhsy
      revenue = toNumber(lrb.OperatingRevenue ?? lrb.OperatingIncome);
      netProfit = toNumber(lrb.NPParentCompanyOwners ?? lrb.ProfitToShareholders ?? lrb.EarningAfterTax);
      operatingProfit = toNumber(lrb.OperatingProfit);
      eps = toNumber(lrb.BasicEPS);
      if (revenue !== null && revenue !== 0) {
        if (netProfit !== null) netMargin = netProfit / revenue;
        if (operatingProfit !== null) grossMargin = operatingProfit / revenue;
      }
      // HK zhsy may carry ratio directly
      const hkGm = toNumber((lrb as Record<string, unknown>).GrossIncomeRatio);
      if (hkGm !== null) grossMargin = hkGm / 100;
    }

    // Balance sheet
    let totalAssets: number | null = null;
    let totalLiabilities: number | null = null;
    let equity: number | null = null;
    let cash: number | null = null;
    let debtRatio: number | null = null;

    if (zcfz) {
      totalAssets = toNumber(zcfz.TotalAssets);
      totalLiabilities = toNumber(zcfz.TotalLiability ?? zcfz.TotalLiabilities);
      equity = toNumber(zcfz.TotalShareholderEquity ?? zcfz.SEWithoutMI);
      cash = toNumber(zcfz.CashEquivalents);
      if (totalAssets !== null && totalAssets !== 0 && totalLiabilities !== null) {
        debtRatio = totalLiabilities / totalAssets;
      }
      // HK zhsy may carry ratio in income row
      const hkDr = toNumber((lrb as Record<string, unknown>).DebtAssetsRatio);
      if (hkDr !== null) debtRatio = hkDr / 100;
    }

    // Cash flow
    let operatingCF: number | null = null;
    let investingCF: number | null = null;
    let financingCF: number | null = null;
    let fcff: number | null = null;

    if (xjll) {
      operatingCF = toNumber(xjll.NetOperateCashFlow ?? xjll.OperatingCashFlow);
      investingCF = toNumber(xjll.NetInvestCashFlow ?? xjll.InvestingCashFlow);
      financingCF = toNumber(xjll.NetFinanceCashFlow ?? xjll.FinancingCashFlow);
      fcff = toNumber(xjll.FCFF);
    }

    return {
      period,
      revenue,
      netProfit,
      operatingProfit,
      eps,
      grossMargin,
      netMargin,
      totalAssets,
      totalLiabilities,
      equity,
      cash,
      debtRatio,
      operatingCF,
      investingCF,
      financingCF,
      fcff,
    };
  });
}

function fmtCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}万`;
  return v.toFixed(2);
}

async function generateFinancialSummary(
  company: string,
  code: string,
  reports: FinancialReport[]
): Promise<string | null> {
  if (!env.OPENAI_API_KEY || reports.length === 0) return null;

  const lines = reports
    .map((r) => {
      const parts: string[] = [`[${r.period}]`];
      if (r.revenue !== null) parts.push(`营收${fmtCompact(r.revenue)}`);
      if (r.netProfit !== null) parts.push(`净利${fmtCompact(r.netProfit)}`);
      if (r.eps !== null) parts.push(`EPS${r.eps.toFixed(2)}`);
      if (r.grossMargin !== null) parts.push(`毛利率${(r.grossMargin * 100).toFixed(1)}%`);
      if (r.netMargin !== null) parts.push(`净利率${(r.netMargin * 100).toFixed(1)}%`);
      if (r.debtRatio !== null) parts.push(`负债率${(r.debtRatio * 100).toFixed(1)}%`);
      if (r.operatingCF !== null) parts.push(`经营现金流${fmtCompact(r.operatingCF)}`);
      return parts.join(" ");
    })
    .join("\n");

  const prompt = `你是专业股票投资分析师。请基于以下${reports.length}期财务数据对${company}(${code})进行简洁的财务分析：

${lines}

要求（不超过220字）：
1. 盈利趋势与质量（营收+净利润变化、净利率水平）
2. 财务健康（资产负债率、现金流）
3. 综合财务评分 0-10 分（格式："综合评分：X/10"）
4. 一句话投资价值判断

用中文输出，语言简洁专业。`;

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { output_text?: string };
    return data.output_text?.trim() ?? null;
  } catch {
    return null;
  }
}

// ── 筹码成本 ─────────────────────────────────────────────────────────────────

function normalizeChipData(rows: Record<string, unknown>[] | null): ChipData | null {
  const row = rows?.[0];
  if (!row) return null;
  return {
    date: String(row.date ?? ""),
    closePrice: toNumber(row.closePrice),
    chipProfitRate: toNumber(row.chipProfitRate),
    chipAvgCost: toNumber(row.chipAvgCost),
    chipConcentration90: toNumber(row.chipConcentration90),
    chipConcentration70: toNumber(row.chipConcentration70),
    summary: null,
  };
}

async function generateChipSummary(company: string, code: string, chip: ChipData): Promise<string | null> {
  if (!env.OPENAI_API_KEY) return null;

  const lines: string[] = [];
  if (chip.closePrice !== null) lines.push(`当前价${chip.closePrice}`);
  if (chip.chipAvgCost !== null) lines.push(`筹码均价${chip.chipAvgCost}`);
  if (chip.chipProfitRate !== null) lines.push(`获利盘${chip.chipProfitRate}%`);
  if (chip.chipConcentration70 !== null) lines.push(`70%筹码集中度${chip.chipConcentration70}%`);
  if (chip.chipConcentration90 !== null) lines.push(`90%筹码集中度${chip.chipConcentration90}%`);

  const prompt = `你是专业股票分析师。基于${company}(${code})最新筹码数据分析：
${lines.join("，")}

要求（不超过150字）：
1. 当前价格与筹码均价关系（套牢盘还是获利盘为主）
2. 筹码集中度分析（是否密集，是否有较强支撑/压力）
3. 一句话操作建议

用中文输出，简洁专业。`;

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", input: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { output_text?: string };
    return data.output_text?.trim() ?? null;
  } catch {
    return null;
  }
}

// ── 股东结构 ─────────────────────────────────────────────────────────────────

function normalizeShareholderData(
  top10Rows: Record<string, unknown>[] | null,
  top10LiquidRows: Record<string, unknown>[] | null,
  holderCountRows: Record<string, unknown>[] | null,
  reportDate: string | null
): ShareholderData {
  const mapRow = (r: Record<string, unknown>): ShareholderRow => ({
    no: toNumber(r.no),
    name: String(r.name ?? ""),
    holdShares: toNumber(r.holdShares),
    holdPct: toNumber(r.holdPct),
    holdChange: toNumber(r.holdChange),
  });

  const holderCount: ShareholderCountRow[] = (holderCountRows ?? []).map((r) => ({
    date: String(r.date ?? ""),
    totalSHNum: toNumber(r.totalSHNum),
    avgHoldShares: toNumber(r.avgHoldShares),
  }));

  return {
    reportDate,
    top10: (top10Rows ?? []).map(mapRow),
    top10Liquid: (top10LiquidRows ?? []).map(mapRow),
    holderCount,
    summary: null,
  };
}

async function generateShareholderSummary(
  company: string,
  code: string,
  data: ShareholderData
): Promise<string | null> {
  if (!env.OPENAI_API_KEY) return null;

  const top3 = data.top10.slice(0, 3).map((r) => `${r.name}持股${r.holdPct ?? "–"}%`).join("；");
  const latest = data.holderCount[0];
  const prev = data.holderCount[1];
  const holderTrend = latest && prev && latest.totalSHNum !== null && prev.totalSHNum !== null
    ? `股东户数从${prev.totalSHNum}变为${latest.totalSHNum}（${latest.totalSHNum > prev.totalSHNum ? "增加" : "减少"}）`
    : latest ? `最新股东户数${latest.totalSHNum}` : "";

  const prompt = `你是专业股票分析师。分析${company}(${code})股东结构：
前三大股东：${top3}
${holderTrend}

要求（不超过150字）：
1. 股权集中度评估（是否高度集中，对散户有何影响）
2. 股东户数变化趋势（筹码是否在集中/分散）
3. 一句话操作参考

用中文输出，简洁专业。`;

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", input: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data2 = (await res.json()) as { output_text?: string };
    return data2.output_text?.trim() ?? null;
  } catch {
    return null;
  }
}

// ── 分红数据 ─────────────────────────────────────────────────────────────────

function normalizeDividendData(rows: Record<string, unknown>[] | null): DividendData {
  if (!rows || rows.length === 0) return { rows: [], summary: null };
  const mapped: DividendRow[] = rows.map((r) => ({
    reportEndDate: String(r.reportEndDate ?? ""),
    dividendType: String(r.dividendType ?? "") || null,
    cashDiviRMB: toNumber(r.cashDiviRMB),
    dividendPlan: String(r.dividendPlan ?? "") || null,
    exDiviDate: String(r.exDiviDate ?? "") || null,
  }));
  return { rows: mapped, summary: null };
}

async function generateDividendSummary(
  company: string,
  code: string,
  data: DividendData,
  currentPrice: number | null
): Promise<string | null> {
  if (!env.OPENAI_API_KEY || data.rows.length === 0) return null;

  const lines = data.rows.slice(0, 5).map((r) => {
    const yr = String(r.reportEndDate).slice(0, 4);
    const div = r.cashDiviRMB !== null ? `派息${r.cashDiviRMB}元/10股` : "无派息";
    return `${yr} ${div}`;
  }).join("；");

  const yieldInfo = currentPrice && data.rows[0]?.cashDiviRMB
    ? `，当前股息率约${((data.rows[0].cashDiviRMB / 10 / currentPrice) * 100).toFixed(2)}%`
    : "";

  const prompt = `你是专业股票分析师。分析${company}(${code})分红历史：
${lines}${yieldInfo}

要求（不超过150字）：
1. 分红稳定性与成长性评估
2. 当前股息率是否具有吸引力
3. 一句话价值投资参考

用中文输出，简洁专业。`;

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", input: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data2 = (await res.json()) as { output_text?: string };
    return data2.output_text?.trim() ?? null;
  } catch {
    return null;
  }
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

async function searchBing(query: string): Promise<string | null> {
  const encoded = encodeURIComponent(query);
  const url = `https://www.bing.com/search?q=${encoded}&count=8`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractBingSummaries(html: string): string[] {
  const results: string[] = [];
  const liPattern = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
  let m: RegExpExecArray | null;
  while ((m = liPattern.exec(html)) !== null) {
    const block = m[1]!;
    const pMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    if (pMatch) results.push(pMatch[1]!.replace(/<[^>]+>/g, " ").trim());
    const hMatch = /<h2[^>]*><a[^>]*>([\s\S]*?)<\/a><\/h2>/i.exec(block);
    if (hMatch) results.push(hMatch[1]!.replace(/<[^>]+>/g, " ").trim());
  }
  if (results.length === 0) {
    const pAll = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pm: RegExpExecArray | null;
    let count = 0;
    while ((pm = pAll.exec(html)) !== null && count < 10) {
      results.push(pm[1]!.replace(/<[^>]+>/g, " ").trim());
      count++;
    }
  }
  return results;
}

async function analyzeMacroIndustry(industry: string, isAshare: boolean): Promise<MacroSignal> {
  const year = new Date().getFullYear();
  const queries = isAshare
    ? [
        `${industry}行业 ${year} 景气度 趋势`,
        `${industry}行业 ${year} 市场表现 展望`,
        `${industry}板块 ${year} 业绩预期`,
        `${industry}行业周期 ${year} 分析`,
      ]
    : [
        `${industry} industry ${year} trend outlook cycle`,
        `${industry} sector performance ${year}`,
        `${industry} market forecast ${year}`,
        `${industry} growth cycle analysis ${year}`,
      ];

  const allSummaries: string[] = [];
  for (const q of queries) {
    const html = await searchBing(q);
    if (html) allSummaries.push(...extractBingSummaries(html));
  }

  if (allSummaries.length === 0) {
    return { status: "stable", coefficient: 0.9, riskCoefficient: 1.0, reason: "搜索失败，采用保守估计" };
  }

  const text = allSummaries.join(" ").toLowerCase();
  const bullKw = isAshare
    ? ["上行", "景气", "复苏", "增长", "利好", "涨价", "需求旺", "好转", "扩张", "牛市"]
    : ["bullish", "upward", "growth", "expanding", "boom", "rally", "strong", "positive", "outperformance", "recover"];
  const bearKw = isAshare
    ? ["下行", "萎缩", "利空", "下滑", "衰退", "降价", "需求弱", "悲观", "收缩", "熊市"]
    : ["bearish", "downward", "declining", "recession", "slowdown", "weak", "negative", "underperformance", "contraction"];

  const bull = bullKw.reduce((n, k) => n + (text.split(k).length - 1), 0);
  const bear = bearKw.reduce((n, k) => n + (text.split(k).length - 1), 0);
  const neutral = ["stable", "steady", "neutral", "moderate", "cautious", "稳健", "平稳", "中性"].reduce(
    (n, k) => n + (text.split(k).length - 1), 0
  );

  if (bull > bear + 2) {
    return { status: "up", coefficient: 1.1, riskCoefficient: 0.9, bullCount: bull, bearCount: bear, neutralCount: neutral,
      reason: `行业处于上行期，市场预期积极，找到 ${bull} 个多头信号` };
  } else if (bear > bull + 2) {
    return { status: "down", coefficient: 0.8, riskCoefficient: 1.2, bullCount: bull, bearCount: bear, neutralCount: neutral,
      reason: `行业处于下行期，市场预期悲观，找到 ${bear} 个空头信号` };
  } else {
    return { status: "stable", coefficient: 0.9, riskCoefficient: 1.0, bullCount: bull, bearCount: bear, neutralCount: neutral,
      reason: `行业处于平稳期，市场预期中性，找到 ${neutral} 个中性信号` };
  }
}

async function analyzeMacroGovernance(company: string, code: string, isAshare: boolean): Promise<MacroSignal> {
  const queries = isAshare
    ? [
        `${company} 欺诈 造假 立案调查`,
        `${company} 违规 罚款 监管处罚`,
        `${company} 高管 变动 辞职 内控`,
        `${company} ${code} 风险 公告`,
      ]
    : [
        `${company} ${code} fraud investigation SEC FBI`,
        `${company} ${code} management arrest criminal`,
        `${company} ${code} accounting scandal lawsuit`,
        `${company} ${code} CEO CFO arrest indictment`,
      ];

  const allSummaries: string[] = [];
  for (const q of queries) {
    const html = await searchBing(q);
    if (html) allSummaries.push(...extractBingSummaries(html));
  }

  if (allSummaries.length === 0) {
    return { status: "none", coefficient: 1.0, riskCoefficient: 1.0, reason: "搜索失败，无法判断治理风险" };
  }

  const text = allSummaries.join(" ").toLowerCase();
  const severeKw = isAshare
    ? ["欺诈", "造假", "刑事", "逮捕", "强制退市", "财务造假", "重大违规", "立案"]
    : ["fraud", "arrest", "criminal", "indictment", "fbi", "delisting", "accounting scandal", "major violation"];
  const moderateKw = isAshare
    ? ["监管处罚", "诉讼", "调查", "警告", "违规", "集体诉讼", "处罚"]
    : ["sec investigation", "lawsuit", "regulatory", "warning", "investigation", "class action", "violation"];
  const mildKw = isAshare
    ? ["高管变动", "辞职", "争议", "纠纷", "内控缺陷"]
    : ["ceo change", "management change", "director", "resignation", "controversy", "dispute"];

  const severe = severeKw.reduce((n, k) => n + (text.split(k).length - 1), 0);
  const moderate = moderateKw.reduce((n, k) => n + (text.split(k).length - 1), 0);
  const mild = mildKw.reduce((n, k) => n + (text.split(k).length - 1), 0);

  if (severe >= 5) {
    return { status: "severe", coefficient: 0.5, riskCoefficient: 2.0, bullCount: 0, bearCount: severe,
      reason: `公司存在严重治理风险（欺诈/刑事调查等），找到 ${severe} 个严重风险信号，强烈不建议买入` };
  } else if (moderate >= 5) {
    return { status: "moderate", coefficient: 0.7, riskCoefficient: 1.3, bullCount: 0, bearCount: moderate,
      reason: `公司存在中等治理风险（监管处罚/诉讼等），找到 ${moderate} 个中等风险信号，不建议买入` };
  } else if (mild >= 5) {
    return { status: "mild", coefficient: 0.9, riskCoefficient: 1.1, bullCount: 0, bearCount: mild,
      reason: `公司存在轻微治理风险（高管变动等），找到 ${mild} 个轻微风险信号，建议谨慎` };
  } else {
    return { status: "none", coefficient: 1.0, riskCoefficient: 1.0, bullCount: 0, bearCount: 0,
      reason: "公司治理良好，无明显问题" };
  }
}

async function analyzeMacroEconomy(isAshare: boolean): Promise<MacroSignal> {
  const year = new Date().getFullYear();
  const queries = isAshare
    ? [
        `${year} 中国经济 A股 走势展望`,
        `${year} 央行货币政策 降息 流动性`,
        `${year} 中国GDP增长 经济预期`,
        `${year} A股市场 行情分析`,
      ]
    : [
        `${year} US economy outlook stock market`,
        `${year} Federal Reserve interest rate inflation`,
        `${year} US economic growth GDP forecast`,
        `${year} US stock market trend analysis`,
      ];

  const allSummaries: string[] = [];
  for (const q of queries) {
    const html = await searchBing(q);
    if (html) allSummaries.push(...extractBingSummaries(html));
  }

  if (allSummaries.length === 0) {
    return { status: "neutral", coefficient: 1.0, riskCoefficient: 1.0, reason: "搜索失败，采用保守估计" };
  }

  const text = allSummaries.join(" ").toLowerCase();
  const bullKw = isAshare
    ? ["降息", "宽松", "刺激", "流动性", "牛市", "复苏", "增长", "扩张"]
    : ["rate cut", "stimulus", "liquidity", "bull market", "recovery", "growth", "expansion", "positive"];
  const bearKw = isAshare
    ? ["加息", "紧缩", "通胀", "熊市", "衰退", "收缩", "利空"]
    : ["rate hike", "tightening", "inflation", "bear market", "recession", "contraction", "negative"];

  const bull = bullKw.reduce((n, k) => n + (text.split(k).length - 1), 0);
  const bear = bearKw.reduce((n, k) => n + (text.split(k).length - 1), 0);
  const neutral = ["stable", "neutral", "steady", "moderate", "cautious", "稳健", "中性", "平稳"].reduce(
    (n, k) => n + (text.split(k).length - 1), 0
  );

  if (bull > bear + 2) {
    return { status: "bull", coefficient: 1.1, riskCoefficient: 0.9, bullCount: bull, bearCount: bear, neutralCount: neutral,
      reason: `宏观经济利好环境（${isAshare ? "降息/宽松" : "rate cut/stimulus"}），找到 ${bull} 个利好信号` };
  } else if (bear > bull + 2) {
    return { status: "bear", coefficient: 0.8, riskCoefficient: 1.2, bullCount: bull, bearCount: bear, neutralCount: neutral,
      reason: `宏观经济利空环境（${isAshare ? "加息/紧缩" : "rate hike/tightening"}），找到 ${bear} 个利空信号` };
  } else {
    return { status: "neutral", coefficient: 1.0, riskCoefficient: 1.0, bullCount: bull, bearCount: bear, neutralCount: neutral,
      reason: `宏观经济环境中性，政策稳健，找到 ${neutral} 个中性信号` };
  }
}

async function analyzeMacroWeb(
  company: string,
  code: string,
  industry: string | null
): Promise<MacroAnalysisData> {
  const isAshare = /^(sh|sz|bj)\d/i.test(code);
  const ind = industry ?? (isAshare ? "综合" : "General");

  const [industrySignal, governanceSignal, macroSignal] = await Promise.all([
    analyzeMacroIndustry(ind, isAshare),
    analyzeMacroGovernance(company, code, isAshare),
    analyzeMacroEconomy(isAshare),
  ]);

  return {
    industry: industrySignal,
    governance: governanceSignal,
    macro: macroSignal,
    totalCoefficient: industrySignal.coefficient * governanceSignal.coefficient * macroSignal.coefficient,
    totalRisk: industrySignal.riskCoefficient * governanceSignal.riskCoefficient * macroSignal.riskCoefficient,
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
    const isAshare = /^(sh|sz|bj)\d/i.test(stock.code);
    const isHkOrAs = !stock.code.startsWith("us");
    const [
      klineResult, technicalResult, profileResult, financeResult,
      fundResult, marginResult, lhbResult, blockTradeResult,
      chipResult, shareholderResult, dividendResult,
    ] = await Promise.all([
      runWestockCommand(["kline", stock.code, "--period", "day", "--limit", "180"]),
      runWestockCommand(["technical", stock.code, "--group", "all"]),
      runWestockCommand(["profile", stock.code]),
      runWestockCommand(["finance", stock.code, "--num", "4"]),
      maybeRun(fundCmds.fund),
      maybeRun(fundCmds.margin),
      maybeRun(fundCmds.lhb),
      maybeRun(fundCmds.blockTrade),
      isAshare ? maybeRun(["chip", stock.code]) : Promise.resolve(null),
      isHkOrAs ? maybeRun(["shareholder", stock.code]) : Promise.resolve(null),
      maybeRun(["dividend", stock.code, "--years", "5"]),
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

    // Parse multi-section finance output (lrb / zcfz / xjll for A/HK; income/balance/cashflow for US)
    const financeSections = parseMultiSectionMarkdown(financeResult.stdout);
    const lrbKey = financeSections["lrb"] ? "lrb" : financeSections["zhsy"] ? "zhsy" : "income";
    const lrbRows = financeSections[lrbKey] ?? null;
    const zcfzRows = financeSections["zcfz"] ?? null;
    const xjllRows = financeSections["xjll"] ?? financeSections["cashflow"] ?? null;
    const normalizedReports = normalizeFinanceReports(lrbRows, zcfzRows, xjllRows, fundCmds.market);

    // Chip
    const chipRaw = normalizeChipData(toRows(chipResult));

    // Shareholder
    const shareholderSections = shareholderResult ? parseMultiSectionMarkdown(shareholderResult.stdout) : {};
    const shareholderDateMatch = shareholderResult ? /\((\d{4}-\d{2}-\d{2})\)/.exec(shareholderResult.stdout) : null;
    const shareholderReportDate = shareholderDateMatch?.[1] ?? null;
    const shareholderRaw = normalizeShareholderData(
      shareholderSections["top10"] ?? null,
      shareholderSections["top10liquid"] ?? null,
      shareholderSections["holdercount"] ?? null,
      shareholderReportDate
    );

    // Dividend
    const dividendSections = dividendResult ? parseMultiSectionMarkdown(dividendResult.stdout) : {};
    const dividendRaw = normalizeDividendData(dividendSections["dividend"] ?? null);

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
      hasChip: Boolean(chipRaw),
      shareholderTop10: shareholderRaw.top10.length,
      dividendRows: dividendRaw.rows.length,
    });
    await logTask(taskId, 3, "step_done", "数据采集完成");

    await logTask(taskId, 4, "step_start", getStepLabel(4));
    const profileForMacro = profileRaw as Record<string, unknown> | null;
    const industry = String(profileForMacro?.industry ?? profileForMacro?.industryName ?? profileForMacro?.sector ?? "").trim() || null;
    const [macroAnalysis, backtest, financialSummary, chipSummary, shareholderSummary, dividendSummary] = await Promise.all([
      analyzeMacroWeb(stock.name, stock.code, industry),
      Promise.resolve(summarizeBacktest(klineList)),
      generateFinancialSummary(stock.name, stock.code, normalizedReports),
      chipRaw ? generateChipSummary(stock.name, stock.code, chipRaw) : Promise.resolve(null),
      shareholderRaw.top10.length > 0 ? generateShareholderSummary(stock.name, stock.code, shareholderRaw) : Promise.resolve(null),
      dividendRaw.rows.length > 0 ? generateDividendSummary(stock.name, stock.code, dividendRaw, currentPrice) : Promise.resolve(null),
    ]);

    const financialAnalysis: FinancialAnalysisData | null =
      normalizedReports.length > 0
        ? {
            market: fundCmds.market,
            currency: inferCurrency(stock.code),
            periods: normalizedReports,
            summary: financialSummary,
          }
        : null;

    const chipData: ChipData | null = chipRaw ? { ...chipRaw, summary: chipSummary } : null;
    const shareholderData: ShareholderData | null =
      shareholderRaw.top10.length > 0 ? { ...shareholderRaw, summary: shareholderSummary } : null;
    const dividendData: DividendData | null =
      dividendRaw.rows.length > 0 ? { ...dividendRaw, summary: dividendSummary } : null;

    const macro = {
      industryCycle: macroAnalysis.industry.reason,
      governance: macroAnalysis.governance.reason,
      macroEconomy: macroAnalysis.macro.reason,
      summary: `综合调整系数 ${macroAnalysis.totalCoefficient.toFixed(3)}，综合风险系数 ${macroAnalysis.totalRisk.toFixed(3)}`,
    };
    await logTask(taskId, 4, "log", "宏观和回测模块已生成摘要", {
      macro,
      macroAnalysis,
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
      macroAnalysis,
      financialAnalysis,
      chipData,
      shareholderData,
      dividendData,
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
