// ── 市场热点（悬浮面板）─────────────────────────────────────────────────────────

export type HotStockRow = {
  code: string;
  name: string;
  zdf: number | null;   // 涨跌幅 %
  zxj: number | null;   // 最新价
  status: string | null;
  stock_type: string | null;
};

export type HotBoardRow = {
  rank: number | null;
  rankdelta: number | null;
  name: string;
  zdf: number | null;
  zxj: number | null;
  stock_type: string | null;
};

export type HotEtfRow = {
  rank: number | null;
  code: string;
  name: string;
  zdf: number | null;
  zxj: number | null;
  tag: string | null;
  title: string | null;
};

export type IpoRow = {
  stage: string;
  code: string;
  name: string;
  price: number | null;
  sgrq: string | null;
  ssrq: string | null;
};

export type SuspensionRow = {
  code: string;
  name: string;
  statusDesc: string | null;
  suspendDate: string | null;
  resumeDate: string | null;
  reason: string | null;
};

export type MarketPulseData = {
  hotStocks: HotStockRow[];
  hotBoards: HotBoardRow[];
  hotEtf: HotEtfRow[];
  ipo: IpoRow[];
  suspension: SuspensionRow[];
  fetchedAt: string;
};

export type TaskLog = {
  id: number;
  step: number;
  logType: "log" | "step_start" | "step_done" | "result" | "error";
  message: string | null;
  payload?: unknown;
  createdAt: string;
};

export type TaskSnapshot = {
  task: {
    id: string;
    status: "pending" | "running" | "completed" | "failed";
    destination: string | null;
  };
  logs: TaskLog[];
  result: AnalysisResult | null;
};

export type AnalysisResult = {
  taskId: string;
  stock: { code: string; name: string; market?: string };
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
  overview: { query: string; status: string; generatedAt: string };
  technical: {
    price: number | null;
    currency: string;
    signal: string;
    summary: string;
    score: number;
    rating: string;
    buySatisfied: number;
    warningCount: number;
    buyConditions: Array<{ name: string; passed: boolean; reason: string }>;
    warnings: Array<{ name: string; triggered: boolean; reason: string }>;
    indicators: Record<string, unknown>;
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

export type KlineRow = {
  date: string;
  open: number | null;
  last: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  amount: number | null;
  exchange: number | null;
};

export type MacroSignal = {
  status: string;        // 'up'|'down'|'stable' / 'none'|'mild'|'moderate'|'severe' / 'bull'|'bear'|'neutral'
  coefficient: number;
  riskCoefficient: number;
  reason: string;
  bullCount?: number;
  bearCount?: number;
  neutralCount?: number;
};

export type MacroAnalysisData = {
  industry: MacroSignal;
  governance: MacroSignal;
  macro: MacroSignal;
  totalCoefficient: number;
  totalRisk: number;
};

export type FundAnalysisData = {
  market: "as" | "hk" | "us";
  flow: Record<string, unknown>[] | null;       // asfund / hkfund / usfund
  margin: Record<string, unknown>[] | null;     // margintrade (A 股)
  lhb: Record<string, unknown>[] | null;        // 龙虎榜 (sh/sz)
  blockTrade: Record<string, unknown>[] | null; // 大宗交易 (sh/sz)
};

// ── 财务分析 ───────────────────────────────────────────────────────────────────

export type FinancialReport = {
  period: string;
  // 利润表
  revenue: number | null;
  netProfit: number | null;
  operatingProfit: number | null;
  eps: number | null;
  grossMargin: number | null;   // 0-1 小数
  netMargin: number | null;     // 0-1 小数
  // 资产负债表
  totalAssets: number | null;
  totalLiabilities: number | null;
  equity: number | null;
  cash: number | null;
  debtRatio: number | null;     // 0-1 小数
  // 现金流量表
  operatingCF: number | null;
  investingCF: number | null;
  financingCF: number | null;
  fcff: number | null;
};

export type FinancialAnalysisData = {
  market: "as" | "hk" | "us";
  currency: string;
  periods: FinancialReport[];
  summary: string | null;  // AI 生成的财务分析摘要
};

// ── 筹码成本 ───────────────────────────────────────────────────────────────────

export type ChipData = {
  date: string;
  closePrice: number | null;
  chipProfitRate: number | null;    // 获利盘比例 %
  chipAvgCost: number | null;       // 全部筹码平均成本
  chipConcentration90: number | null; // 90% 筹码集中度（价格区间宽度 %）
  chipConcentration70: number | null; // 70% 筹码集中度
  summary: string | null;
};

// ── 股东结构 ───────────────────────────────────────────────────────────────────

export type ShareholderRow = {
  no: number | null;
  name: string;
  holdShares: number | null;
  holdPct: number | null;
  holdChange: number | null;
};

export type ShareholderCountRow = {
  date: string;
  totalSHNum: number | null;
  avgHoldShares: number | null;
};

export type ShareholderData = {
  reportDate: string | null;
  top10: ShareholderRow[];
  top10Liquid: ShareholderRow[];
  holderCount: ShareholderCountRow[];
  summary: string | null;
};

// ── 分红数据 ───────────────────────────────────────────────────────────────────

export type DividendRow = {
  reportEndDate: string;
  dividendType: string | null;
  cashDiviRMB: number | null;
  dividendPlan: string | null;
  exDiviDate: string | null;
};

export type DividendData = {
  rows: DividendRow[];
  summary: string | null;
};
