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

export type FundAnalysisData = {
  market: "as" | "hk" | "us";
  flow: Record<string, unknown>[] | null;       // asfund / hkfund / usfund
  margin: Record<string, unknown>[] | null;     // margintrade (A 股)
  lhb: Record<string, unknown>[] | null;        // 龙虎榜 (sh/sz)
  blockTrade: Record<string, unknown>[] | null; // 大宗交易 (sh/sz)
};
