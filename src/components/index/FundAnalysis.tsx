import type { FundAnalysisData } from "~/types";

// ─── Low-level helpers ────────────────────────────────────────────────────────
function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseEmbedded<T>(row: Record<string, unknown>, key: string): T | null {
  const raw = row[key];
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str || str === "null" || str === "{}" || str === "[]" || str === '""') return null;
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

function fmtMoney(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}万`;
  return v.toFixed(0);
}

function fmtSignedMoney(v: number | null): string {
  if (v === null) return "–";
  return (v > 0 ? "+" : "") + fmtMoney(v);
}

// ─── Parse a single asfund / hkfund / usfund row ─────────────────────────────
// Actual field names from westock-data-clawhub asfund output:
//   MainNetFlow, MainNetFlow5D, MainNetFlow10D, MainNetFlow20D
//   JumboNetFlow (超大单), BlockNetFlow (大单), MidNetFlow, SmallNetFlow
//   MainInFlow, MainOutFlow, RetailInFlow, RetailOutFlow
//   MainInflowRank, MainInflowCircRate
//   EndDate, ClosePrice
//   MarginTradeInfos  → embedded JSON string
//   LhbTradingDetails → embedded JSON string (may be empty)
//   BlockTradingInfos → embedded JSON string (may be empty)

type MarginInfo = {
  FinanceValue?: string;
  FinanceBuyValue?: string;
  FinanceRefundValue?: string;
  SecurityValue?: string;
  TradingValue?: string;
  FinanceValueDOD?: string;
  SecurityValueDOD?: string;
};

type BlockTrade = Record<string, unknown>;
type LhbEntry = Record<string, unknown>;

type ParsedRow = {
  date: string;
  closePrice: number | null;
  multiPeriod: Array<{ label: string; value: number | null }>;
  categories: Array<{ label: string; value: number | null }>;
  mainIn: number | null;
  mainOut: number | null;
  retailIn: number | null;
  retailOut: number | null;
  rank: number | null;
  circRate: number | null;
  margin: MarginInfo | null;
  lhb: LhbEntry[] | null;
  blockTrades: BlockTrade[] | null;
};

function parseFundRow(row: Record<string, unknown>): ParsedRow {
  const margin = parseEmbedded<MarginInfo>(row, "MarginTradeInfos");
  const lhbRaw = parseEmbedded<unknown>(row, "LhbTradingDetails");
  const blockRaw = parseEmbedded<unknown>(row, "BlockTradingInfos");

  return {
    date: String(row.EndDate ?? row.end_date ?? row.date ?? ""),
    closePrice: toNum(row.ClosePrice ?? row.close_price),
    multiPeriod: [
      { label: "今日", value: toNum(row.MainNetFlow) },
      { label: "5日", value: toNum(row.MainNetFlow5D) },
      { label: "10日", value: toNum(row.MainNetFlow10D) },
      { label: "20日", value: toNum(row.MainNetFlow20D) },
    ],
    categories: [
      { label: "超大单", value: toNum(row.JumboNetFlow) },
      { label: "大单", value: toNum(row.BlockNetFlow) },
      { label: "中单", value: toNum(row.MidNetFlow) },
      { label: "小单", value: toNum(row.SmallNetFlow) },
      { label: "主力净", value: toNum(row.MainNetFlow) },
    ],
    mainIn: toNum(row.MainInFlow),
    mainOut: toNum(row.MainOutFlow),
    retailIn: toNum(row.RetailInFlow),
    retailOut: toNum(row.RetailOutFlow),
    rank: toNum(row.MainInflowRank),
    circRate: toNum(row.MainInflowCircRate),
    margin,
    lhb: Array.isArray(lhbRaw) ? (lhbRaw as LhbEntry[]) : null,
    blockTrades: Array.isArray(blockRaw) ? (blockRaw as BlockTrade[]) : null,
  };
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const W = 1420;

// ─── 📅 多周期主力净流入 — vertical bars ─────────────────────────────────────
function MultiPeriodBars({ periods }: { periods: Array<{ label: string; value: number | null }> }) {
  const H = 240;
  const PAD_L = 72, PAD_R = 16, PAD_TOP = 20, PAD_BOT = 38;
  const CW = W - PAD_L - PAD_R;
  const CH = H - PAD_TOP - PAD_BOT;

  const values = periods.map((p) => p.value ?? 0);
  const absMax = Math.max(...values.map(Math.abs), 1);
  const yMax = absMax * 1.18;
  const yMin = -absMax * 1.18;
  const yRange = yMax - yMin;
  const yFn = (v: number) => PAD_TOP + ((yMax - v) / yRange) * CH;
  const yZero = yFn(0);

  const slot = CW / periods.length;
  const bw = Math.min(180, slot * 0.45);
  const xFn = (i: number) => PAD_L + i * slot + slot / 2;

  // y-axis ticks
  const tickVals = [absMax * 0.5, absMax].map((t) => Math.round(t));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-xl"
      style={{ background: "linear-gradient(175deg,#0e1117,#080b10)" }}
    >
      {/* Grid & y-ticks */}
      {tickVals.map((t) => (
        <g key={`t-${t}`}>
          <line x1={PAD_L} y1={yFn(t).toFixed(1)} x2={W - PAD_R} y2={yFn(t).toFixed(1)} stroke="rgba(148,163,184,0.06)" strokeWidth="1" />
          <line x1={PAD_L} y1={yFn(-t).toFixed(1)} x2={W - PAD_R} y2={yFn(-t).toFixed(1)} stroke="rgba(148,163,184,0.06)" strokeWidth="1" />
          <text x={PAD_L - 6} y={(yFn(t) + 4).toFixed(1)} fill="rgba(148,163,184,0.55)" fontSize="10" textAnchor="end">{fmtMoney(t)}</text>
          <text x={PAD_L - 6} y={(yFn(-t) + 4).toFixed(1)} fill="rgba(148,163,184,0.55)" fontSize="10" textAnchor="end">{fmtMoney(-t)}</text>
        </g>
      ))}

      {/* Zero line */}
      <line x1={PAD_L} y1={yZero.toFixed(1)} x2={W - PAD_R} y2={yZero.toFixed(1)} stroke="rgba(148,163,184,0.2)" strokeWidth="1" strokeDasharray="5 3" />

      {periods.map((p, i) => {
        const v = p.value ?? 0;
        const isPos = v >= 0;
        const color = isPos ? "#26a69a" : "#ef5350";
        const cx = xFn(i);
        const yTop = isPos ? yFn(v) : yZero;
        const bh = Math.max(2, Math.abs(yFn(v) - yZero));
        const labelY = isPos ? yTop - 10 : yTop + bh + 18;

        return (
          <g key={p.label}>
            <rect
              x={(cx - bw / 2).toFixed(1)}
              y={yTop.toFixed(1)}
              width={bw.toFixed(1)}
              height={bh.toFixed(1)}
              fill={color}
              rx="4"
              opacity="0.85"
            />
            <text x={cx.toFixed(1)} y={labelY.toFixed(1)} fill={color} fontSize="14" fontWeight="600" textAnchor="middle">
              {p.value !== null ? fmtSignedMoney(v) : "–"}
            </text>
            <text x={cx.toFixed(1)} y={(H - 10).toFixed(1)} fill="rgba(226,232,240,0.78)" fontSize="14" textAnchor="middle">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── 💰 资金分类横向条形 ───────────────────────────────────────────────────────
function CategoryBars({ categories }: { categories: Array<{ label: string; value: number | null }> }) {
  const absMax = Math.max(...categories.map((c) => Math.abs(c.value ?? 0)), 1);

  return (
    <div className="space-y-2.5">
      {categories.map(({ label, value }) => {
        const v = value ?? 0;
        const pct = Math.abs(v) / absMax;
        const isPos = v >= 0;
        return (
          <div key={label} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-right text-xs text-slate-400">{label}</span>
            <div className="relative flex h-5 flex-1 items-center overflow-hidden rounded bg-white/5">
              <div
                className={`h-full transition-all ${isPos ? "bg-[#26a69a]" : "bg-[#ef5350]"} opacity-70`}
                style={{ width: `${(pct * 100).toFixed(1)}%` }}
              />
            </div>
            <span className={`w-24 shrink-0 text-right text-xs font-semibold tabular-nums ${isPos ? "text-[#4dd0c4]" : "text-[#f87171]"}`}>
              {value !== null ? fmtSignedMoney(v) : "–"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── 主力 vs 散户 流入流出对比 ────────────────────────────────────────────────
function FlowInOutBar({
  mainIn, mainOut, retailIn, retailOut,
}: {
  mainIn: number | null;
  mainOut: number | null;
  retailIn: number | null;
  retailOut: number | null;
}) {
  const all = [mainIn, mainOut, retailIn, retailOut].filter((v): v is number => v !== null);
  if (all.length === 0) return null;
  const maxVal = Math.max(...all, 1);

  const rows = [
    { label: "主力流入", value: mainIn, color: "bg-[#26a69a]" },
    { label: "主力流出", value: mainOut, color: "bg-[#ef5350]" },
    { label: "散户流入", value: retailIn, color: "bg-[#60a5fa]" },
    { label: "散户流出", value: retailOut, color: "bg-[#f59e0b]" },
  ];

  return (
    <div className="space-y-2.5">
      {rows.map(({ label, value, color }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-right text-xs text-slate-400">{label}</span>
          <div className="flex h-5 flex-1 items-center overflow-hidden rounded bg-white/5">
            <div
              className={`h-full opacity-65 ${color}`}
              style={{ width: value !== null ? `${(value / maxVal * 100).toFixed(1)}%` : "0%" }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-300">
            {value !== null ? fmtMoney(value) : "–"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── 📈 融资融券 指标卡 ───────────────────────────────────────────────────────
function MarginCards({ margin }: { margin: MarginInfo }) {
  const financeVal = toNum(margin.FinanceValue);
  const securityVal = toNum(margin.SecurityValue);
  const tradingVal = toNum(margin.TradingValue);
  const financeBuy = toNum(margin.FinanceBuyValue);
  const financeRefund = toNum(margin.FinanceRefundValue);
  const financeDOD = toNum(margin.FinanceValueDOD);
  const securityDOD = toNum(margin.SecurityValueDOD);

  const cards = [
    { label: "融资余额", value: financeVal, dod: financeDOD },
    { label: "融券余额", value: securityVal, dod: securityDOD },
    { label: "融资买入额", value: financeBuy, dod: null },
    { label: "融资偿还额", value: financeRefund, dod: null },
    { label: "融资融券余额", value: tradingVal, dod: null },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      {cards.map(({ label, value, dod }) => (
        <div key={label} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">{label}</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {value !== null ? fmtMoney(value) : "–"}
          </p>
          {dod !== null && (
            <p className={`mt-1 text-xs ${dod >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              日变动 {dod >= 0 ? "+" : ""}{dod.toFixed(2)}%
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── 大宗交易表格 ─────────────────────────────────────────────────────────────
function BlockTradeTable({ trades }: { trades: BlockTrade[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-slate-400">
            <th className="pb-2 text-left">类型</th>
            <th className="pb-2 text-left">买方</th>
            <th className="pb-2 text-left">卖方</th>
            <th className="pb-2 text-right">成交价</th>
            <th className="pb-2 text-right">成交额</th>
            <th className="pb-2 text-right">折溢价率</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const discount = toNum(t.CloseDiscountRate);
            return (
              <tr key={i} className="border-b border-white/5 text-slate-300">
                <td className="py-2 text-xs text-slate-400">{String(t.TradingType ?? "–")}</td>
                <td className="py-2 max-w-[180px] truncate text-xs">{String(t.BuySalesDepartment ?? "–")}</td>
                <td className="py-2 max-w-[180px] truncate text-xs">{String(t.SellSalesDepartment ?? "–")}</td>
                <td className="py-2 text-right">{toNum(t.TurnoverPrice)?.toFixed(2) ?? "–"}</td>
                <td className="py-2 text-right">{toNum(t.TurnoverValue) !== null ? fmtMoney(toNum(t.TurnoverValue)!) : "–"}</td>
                <td className={`py-2 text-right ${discount !== null ? (discount >= 0 ? "text-emerald-300" : "text-rose-300") : "text-slate-400"}`}>
                  {discount !== null ? `${discount >= 0 ? "+" : ""}${discount.toFixed(2)}%` : "–"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── 龙虎榜表格 ──────────────────────────────────────────────────────────────
function LhbTable({ entries }: { entries: LhbEntry[] }) {
  const BUY_KEYS  = ["买入额", "BuyAmount", "buy_amount", "净买入额"];
  const SELL_KEYS = ["卖出额", "SellAmount", "sell_amount"];
  const NAME_KEYS = ["营业部名称", "BrokerName", "broker", "name", "机构名称"];
  const DATE_KEYS = ["日期", "date", "Date", "TradingDate"];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-slate-400">
            <th className="pb-2 text-left">日期</th>
            <th className="pb-2 text-left">营业部 / 机构</th>
            <th className="pb-2 text-right">买入额</th>
            <th className="pb-2 text-right">卖出额</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const name = NAME_KEYS.map((k) => e[k]).find((v) => v) ?? "–";
            const date = DATE_KEYS.map((k) => e[k]).find((v) => v) ?? "";
            const buy = BUY_KEYS.map((k) => toNum(e[k])).find((v) => v !== null) ?? null;
            const sell = SELL_KEYS.map((k) => toNum(e[k])).find((v) => v !== null) ?? null;
            return (
              <tr key={i} className="border-b border-white/5 text-slate-300">
                <td className="py-2 text-xs text-slate-400">{String(date)}</td>
                <td className="py-2 text-xs">{String(name)}</td>
                <td className="py-2 text-right text-emerald-300">{buy !== null ? fmtMoney(buy) : "–"}</td>
                <td className="py-2 text-right text-rose-300">{sell !== null ? fmtMoney(sell) : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function FundAnalysis({ data }: { data: FundAnalysisData }) {
  // asfund returns a single row; take the first entry
  const rawRow = data.flow?.[0] ?? null;

  if (!rawRow) {
    return <p className="text-sm text-slate-400">暂无资金流向数据。</p>;
  }

  const row = parseFundRow(rawRow);

  // Determine if all multi-period values are null (e.g. unsupported market)
  const hasPeriodData = row.multiPeriod.some((p) => p.value !== null);
  const hasCategoryData = row.categories.some((c) => c.value !== null);
  const hasFlowInOut = row.mainIn !== null || row.mainOut !== null;
  const hasMargin = row.margin !== null;
  // Prefer embedded data; fall back to separate command data
  const blockTrades =
    row.blockTrades ??
    (data.blockTrade && data.blockTrade.length > 0 ? data.blockTrade : null);
  const lhbEntries =
    row.lhb ??
    (data.lhb && data.lhb.length > 0 ? data.lhb : null);

  if (!hasPeriodData && !hasCategoryData && !hasMargin) {
    return <p className="text-sm text-slate-400">资金流向数据暂时无法解析。</p>;
  }

  return (
    <div className="space-y-7">
      {/* Header info row */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        {row.date && <span>数据日期：<span className="text-slate-200">{row.date}</span></span>}
        {row.closePrice !== null && <span>收盘价：<span className="text-slate-200">{row.closePrice.toFixed(2)}</span></span>}
        {row.rank !== null && <span>全市场排名：<span className="text-slate-200">#{Math.round(row.rank)}</span></span>}
        {row.circRate !== null && <span>主力净占比：<span className={row.circRate >= 0 ? "text-emerald-400" : "text-rose-400"}>{(row.circRate * 100).toFixed(2)}%</span></span>}
      </div>

      {/* ── 📅 多周期主力净流入 ─────────────────────────────────────── */}
      {hasPeriodData && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">📅 多周期主力净流入</h4>
          <MultiPeriodBars periods={row.multiPeriod} />
        </div>
      )}

      {/* ── 💰 资金分类 & 主力买卖对比 ─────────────────────────────── */}
      {(hasCategoryData || hasFlowInOut) && (
        <div className="grid gap-6 md:grid-cols-2">
          {hasCategoryData && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-white">💰 资金分类净流入</h4>
              <CategoryBars categories={row.categories} />
            </div>
          )}
          {hasFlowInOut && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-white">主力 vs 散户 买卖对比</h4>
              <FlowInOutBar
                mainIn={row.mainIn}
                mainOut={row.mainOut}
                retailIn={row.retailIn}
                retailOut={row.retailOut}
              />
            </div>
          )}
        </div>
      )}

      {/* ── 📈 融资融券 ─────────────────────────────────────────────── */}
      {hasMargin && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">📈 融资融券</h4>
          <MarginCards margin={row.margin!} />
        </div>
      )}

      {/* ── 大宗交易 ────────────────────────────────────────────────── */}
      {blockTrades && blockTrades.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">📦 大宗交易</h4>
          <BlockTradeTable trades={blockTrades} />
        </div>
      )}

      {/* ── 龙虎榜 ──────────────────────────────────────────────────── */}
      {lhbEntries && lhbEntries.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">🏆 龙虎榜</h4>
          <LhbTable entries={lhbEntries} />
        </div>
      )}
    </div>
  );
}
