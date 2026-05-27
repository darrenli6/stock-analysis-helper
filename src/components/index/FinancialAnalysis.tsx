import type { FinancialAnalysisData, FinancialReport } from "~/types";

// ── 格式化辅助 ────────────────────────────────────────────────────────────────

function fmtMoney(v: number, currency: string): string {
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}万`;
  return v.toFixed(2);
}

function fmtPct(v: number | null): string {
  if (v === null) return "–";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtNum(v: number | null, digits = 2): string {
  if (v === null) return "–";
  return v.toFixed(digits);
}

// Shorten period label: "2025-03-31" → "25Q1"
function periodLabel(period: string): string {
  const m = /^(\d{2,4})-(\d{2})-\d{2}$/.exec(period);
  if (!m) return period.slice(0, 7);
  const year = m[1]!.slice(-2);
  const month = parseInt(m[2]!, 10);
  const q = month <= 3 ? "Q1" : month <= 6 ? "Q2" : month <= 9 ? "Q3" : "Q4";
  return `${year}${q}`;
}

// ── SVG 双柱图（营收 + 净利润 趋势）────────────────────────────────────────────

const W = 1420;
const H = 280;
const PAD_L = 80;
const PAD_R = 20;
const PAD_TOP = 28;
const PAD_BOT = 46;
const CW = W - PAD_L - PAD_R;
const CH = H - PAD_TOP - PAD_BOT;

function RevenueProfitChart({
  periods,
  currency,
}: {
  periods: FinancialReport[];
  currency: string;
}) {
  const revenues = periods.map((p) => p.revenue ?? 0);
  const profits = periods.map((p) => p.netProfit ?? 0);
  const allVals = [...revenues, ...profits].map(Math.abs);
  const maxVal = Math.max(...allVals, 1);

  const slotW = CW / periods.length;
  const barW = Math.min(100, slotW * 0.32);
  const gap = barW * 0.3;
  const yFn = (v: number) => PAD_TOP + (1 - Math.max(0, v) / maxVal) * CH;
  const xCx = (i: number) => PAD_L + i * slotW + slotW / 2;

  const tickVals = [maxVal * 0.5, maxVal].map((t) => Math.round(t));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-xl"
      style={{ background: "linear-gradient(175deg,#0e1117,#080b10)" }}
    >
      {/* grid lines */}
      {tickVals.map((t) => (
        <g key={t}>
          <line
            x1={PAD_L}
            y1={yFn(t).toFixed(1)}
            x2={W - PAD_R}
            y2={yFn(t).toFixed(1)}
            stroke="rgba(148,163,184,0.07)"
            strokeWidth="1"
          />
          <text
            x={PAD_L - 6}
            y={(yFn(t) + 4).toFixed(1)}
            fill="rgba(148,163,184,0.5)"
            fontSize="11"
            textAnchor="end"
          >
            {fmtMoney(t, currency)}
          </text>
        </g>
      ))}

      {periods.map((p, i) => {
        const cx = xCx(i);
        const rv = p.revenue ?? 0;
        const np = p.netProfit ?? 0;

        const rvH = Math.max(2, (Math.max(0, rv) / maxVal) * CH);
        const npH = Math.max(2, (Math.max(0, np) / maxVal) * CH);
        const rvY = yFn(rv);
        const npY = yFn(np);
        const rvX = cx - barW - gap / 2;
        const npX = cx + gap / 2;

        return (
          <g key={p.period}>
            {/* Revenue bar */}
            <rect
              x={rvX.toFixed(1)}
              y={rvY.toFixed(1)}
              width={barW.toFixed(1)}
              height={rvH.toFixed(1)}
              fill="#38bdf8"
              rx="4"
              opacity="0.75"
            />
            {/* Net profit bar */}
            <rect
              x={npX.toFixed(1)}
              y={npY.toFixed(1)}
              width={barW.toFixed(1)}
              height={npH.toFixed(1)}
              fill={np >= 0 ? "#26a69a" : "#ef5350"}
              rx="4"
              opacity="0.85"
            />
            {/* X-axis label */}
            <text
              x={cx.toFixed(1)}
              y={(H - 10).toFixed(1)}
              fill="rgba(226,232,240,0.7)"
              fontSize="13"
              textAnchor="middle"
            >
              {periodLabel(p.period)}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <rect x={PAD_L} y="6" width="10" height="10" fill="#38bdf8" rx="2" opacity="0.75" />
      <text x={PAD_L + 14} y="16" fill="rgba(148,163,184,0.8)" fontSize="11">营业收入</text>
      <rect x={PAD_L + 70} y="6" width="10" height="10" fill="#26a69a" rx="2" opacity="0.85" />
      <text x={PAD_L + 84} y="16" fill="rgba(148,163,184,0.8)" fontSize="11">净利润</text>
    </svg>
  );
}

// ── 现金流横向条 ──────────────────────────────────────────────────────────────

function CashFlowBars({ report, currency }: { report: FinancialReport; currency: string }) {
  const rows: Array<{ label: string; value: number | null; color: string }> = [
    { label: "经营现金流", value: report.operatingCF, color: "#26a69a" },
    { label: "投资现金流", value: report.investingCF, color: "#60a5fa" },
    { label: "融资现金流", value: report.financingCF, color: "#f59e0b" },
    { label: "自由现金流", value: report.fcff, color: "#a78bfa" },
  ].filter((r) => r.value !== null);

  if (rows.length === 0) return <p className="text-sm text-slate-400">暂无现金流数据</p>;

  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.value ?? 0)), 1);

  return (
    <div className="space-y-3">
      {rows.map(({ label, value, color }) => {
        const v = value ?? 0;
        const pct = (Math.abs(v) / maxAbs) * 100;
        const isPos = v >= 0;
        return (
          <div key={label} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-right text-xs text-slate-400">{label}</span>
            <div className="relative flex h-5 flex-1 items-center overflow-hidden rounded bg-white/5">
              <div
                className="h-full transition-all"
                style={{ width: `${pct.toFixed(1)}%`, backgroundColor: color, opacity: 0.7 }}
              />
            </div>
            <span
              className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums"
              style={{ color: isPos ? "#4dd0c4" : "#f87171" }}
            >
              {isPos ? "+" : ""}
              {fmtMoney(v, currency)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── 指标趋势迷你折线（sparkline）────────────────────────────────────────────────

function Sparkline({
  values,
  color = "#38bdf8",
}: {
  values: (number | null)[];
  color?: string;
}) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return null;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const W2 = 80;
  const H2 = 28;
  const pts = valid
    .map((v, i) => {
      const x = (i / (valid.length - 1)) * W2;
      const y = H2 - ((v - min) / range) * H2 * 0.8 - H2 * 0.1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W2} ${H2}`} className="h-7 w-20">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── 主组件 ─────────────────────────────────────────────────────────────────────

export function FinancialAnalysis({ data }: { data: FinancialAnalysisData }) {
  const { periods, currency, summary, market } = data;

  if (periods.length === 0) {
    return <p className="text-sm text-slate-400">暂无财务数据</p>;
  }

  const latest = periods[periods.length - 1]!;

  // Determine if data is meaningful
  const hasRevenue = periods.some((p) => p.revenue !== null);
  const hasCF = periods.some(
    (p) => p.operatingCF !== null || p.investingCF !== null || p.financingCF !== null
  );
  const hasBalance = periods.some((p) => p.totalAssets !== null);

  const netMarginTrend = periods.map((p) => p.netMargin);
  const revenueTrend = periods.map((p) => p.revenue);

  // Metric cards
  const keyMetrics: Array<{
    label: string;
    value: string;
    sub?: string;
    trend?: (number | null)[];
    color?: string;
  }> = [
    {
      label: "每股收益 EPS",
      value: latest.eps !== null ? `${latest.eps.toFixed(2)}` : "–",
      trend: periods.map((p) => p.eps),
      color: "#38bdf8",
    },
    {
      label: "净利率",
      value: fmtPct(latest.netMargin),
      trend: netMarginTrend,
      color: "#26a69a",
    },
    {
      label: "毛利率",
      value: fmtPct(latest.grossMargin),
      trend: periods.map((p) => p.grossMargin),
      color: "#a78bfa",
    },
    {
      label: "资产负债率",
      value: fmtPct(latest.debtRatio),
      sub: latest.debtRatio !== null ? (latest.debtRatio > 0.7 ? "偏高" : latest.debtRatio > 0.5 ? "适中" : "健康") : undefined,
      trend: periods.map((p) => p.debtRatio),
      color: "#f59e0b",
    },
    {
      label: "总资产",
      value: latest.totalAssets !== null ? fmtMoney(latest.totalAssets, currency) : "–",
      trend: periods.map((p) => p.totalAssets),
      color: "#60a5fa",
    },
    {
      label: "股东权益",
      value: latest.equity !== null ? fmtMoney(latest.equity, currency) : "–",
      trend: periods.map((p) => p.equity),
      color: "#34d399",
    },
    {
      label: "货币资金",
      value: latest.cash !== null ? fmtMoney(latest.cash, currency) : "–",
      trend: periods.map((p) => p.cash),
      color: "#38bdf8",
    },
    {
      label: "经营现金流",
      value: latest.operatingCF !== null ? fmtMoney(latest.operatingCF, currency) : "–",
      trend: periods.map((p) => p.operatingCF),
      color: latest.operatingCF !== null && latest.operatingCF >= 0 ? "#26a69a" : "#ef5350",
    },
  ];

  const mktLabel =
    market === "hk" ? "港股财报" : market === "us" ? "美股财报" : "A股财报";

  return (
    <div className="space-y-7">
      {/* 市场标签 + 期数 */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span>
          数据来源：<span className="text-slate-200">{mktLabel}</span>
        </span>
        <span>
          期数：<span className="text-slate-200">最近 {periods.length} 期</span>
        </span>
        <span>
          货币：<span className="text-slate-200">{currency}</span>
        </span>
        <span>
          最新期：<span className="text-slate-200">{latest.period}</span>
        </span>
      </div>

      {/* AI 财务分析摘要 */}
      {summary && (
        <div className="rounded-2xl border border-violet-400/20 bg-violet-400/8 px-5 py-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-violet-300/70">
            AI 财务分析
          </p>
          <p className="whitespace-pre-line text-sm leading-7 text-slate-200">{summary}</p>
        </div>
      )}

      {/* 营收 & 净利润趋势 */}
      {hasRevenue && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">📈 营收与净利润趋势</h4>
          <RevenueProfitChart periods={periods} currency={currency} />
          <div className="mt-2 flex items-center gap-6 text-xs text-slate-400">
            <span>
              最新营收：
              <span className="font-semibold text-sky-300">
                {latest.revenue !== null ? fmtMoney(latest.revenue, currency) : "–"}
              </span>
            </span>
            <span>
              最新净利：
              <span
                className={`font-semibold ${
                  (latest.netProfit ?? 0) >= 0 ? "text-teal-300" : "text-rose-300"
                }`}
              >
                {latest.netProfit !== null ? fmtMoney(latest.netProfit, currency) : "–"}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* 关键指标卡片 */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-white">🔑 关键财务指标</h4>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {keyMetrics.map(({ label, value, sub, trend, color }) => (
            <div
              key={label}
              className="flex flex-col justify-between rounded-2xl border border-white/8 bg-white/4 px-4 py-3"
            >
              <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">{label}</p>
              <p className="mt-2 text-base font-semibold text-white">{value}</p>
              {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
              {trend && <Sparkline values={trend} color={color} />}
            </div>
          ))}
        </div>
      </div>

      {/* 多期盈利数据表格 */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-white">📋 多期盈利概览</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-slate-400">
                <th className="pb-2 text-left">期间</th>
                <th className="pb-2 text-right">营收</th>
                <th className="pb-2 text-right">净利润</th>
                <th className="pb-2 text-right">EPS</th>
                <th className="pb-2 text-right">毛利率</th>
                <th className="pb-2 text-right">净利率</th>
                <th className="pb-2 text-right">负债率</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const isLatest = p === latest;
                return (
                  <tr
                    key={p.period}
                    className={`border-b border-white/5 ${isLatest ? "bg-white/3" : ""}`}
                  >
                    <td className="py-2 text-xs text-slate-300">{p.period}</td>
                    <td className="py-2 text-right tabular-nums text-sky-300">
                      {p.revenue !== null ? fmtMoney(p.revenue, currency) : "–"}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        p.netProfit === null
                          ? "text-slate-400"
                          : p.netProfit >= 0
                            ? "text-teal-300"
                            : "text-rose-300"
                      }`}
                    >
                      {p.netProfit !== null ? fmtMoney(p.netProfit, currency) : "–"}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-300">
                      {fmtNum(p.eps)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-violet-300">
                      {fmtPct(p.grossMargin)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-300">
                      {fmtPct(p.netMargin)}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        p.debtRatio === null
                          ? "text-slate-400"
                          : p.debtRatio > 0.7
                            ? "text-rose-300"
                            : p.debtRatio > 0.5
                              ? "text-amber-300"
                              : "text-teal-300"
                      }`}
                    >
                      {fmtPct(p.debtRatio)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 现金流分析（最新期）*/}
      {hasCF && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">
            💧 现金流分析（{latest.period}）
          </h4>
          <CashFlowBars report={latest} currency={currency} />
        </div>
      )}

      {/* 资产负债概览（最新期）*/}
      {hasBalance && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">
            🏛 资产负债概览（{latest.period}）
          </h4>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: "总资产", value: latest.totalAssets },
              { label: "总负债", value: latest.totalLiabilities },
              { label: "股东权益", value: latest.equity },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3"
              >
                <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">{label}</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {value !== null ? fmtMoney(value, currency) : "–"}
                </p>
              </div>
            ))}
          </div>
          {latest.debtRatio !== null && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>资产负债率</span>
                <span
                  className={
                    latest.debtRatio > 0.7
                      ? "text-rose-300"
                      : latest.debtRatio > 0.5
                        ? "text-amber-300"
                        : "text-teal-300"
                  }
                >
                  {fmtPct(latest.debtRatio)}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className={`h-full rounded-full transition-all ${
                    latest.debtRatio > 0.7
                      ? "bg-rose-400"
                      : latest.debtRatio > 0.5
                        ? "bg-amber-400"
                        : "bg-teal-400"
                  }`}
                  style={{ width: `${Math.min(100, latest.debtRatio * 100).toFixed(1)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
