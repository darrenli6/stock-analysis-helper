import type { DividendData } from "~/types";

function fmtDate(raw: string): string {
  // "20250930" → "2025-09-30", "20251219" → "2025-12-19"
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

function fmtMoney(v: number | null): string {
  if (v === null) return "–";
  return v.toFixed(3);
}

export function DividendAnalysis({ data }: { data: DividendData }) {
  const { rows, summary } = data;

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">暂无分红数据</p>;
  }

  const cashDivs = rows.filter((r) => r.cashDiviRMB !== null).map((r) => r.cashDiviRMB!);
  const totalYears = new Set(rows.map((r) => String(r.reportEndDate).slice(0, 4))).size;
  const maxDiv = cashDivs.length > 0 ? Math.max(...cashDivs) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span>历史记录：<span className="text-slate-200">{rows.length} 次</span></span>
        <span>覆盖年份：<span className="text-slate-200">{totalYears} 年</span></span>
      </div>

      {summary && (
        <div className="rounded-2xl border border-teal-400/20 bg-teal-400/8 px-5 py-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-teal-300/70">AI 分红分析</p>
          <p className="whitespace-pre-line text-sm leading-7 text-slate-200">{summary}</p>
        </div>
      )}

      {/* Bar chart of dividends */}
      {cashDivs.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">💵 每10股派息趋势</h4>
          <div className="space-y-2">
            {rows.slice(0, 8).map((row, i) => {
              const v = row.cashDiviRMB ?? 0;
              const pct = maxDiv > 0 ? (v / maxDiv) * 100 : 0;
              const year = String(row.reportEndDate).slice(0, 4);
              const isSpecial = row.dividendType?.includes("特殊");
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-right text-xs text-slate-400">{year}</span>
                  <div className="relative flex h-6 flex-1 items-center overflow-hidden rounded bg-white/5">
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: `${pct.toFixed(1)}%`,
                        backgroundColor: isSpecial ? "#f59e0b" : "#26a69a",
                        opacity: 0.75,
                      }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-teal-300">
                    {v > 0 ? `¥${fmtMoney(v)}` : "–"}
                  </span>
                  {isSpecial && (
                    <span className="text-[10px] text-amber-400">特殊</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-white">📋 分红明细</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-slate-400">
                <th className="pb-2 text-left">报告期</th>
                <th className="pb-2 text-left">类型</th>
                <th className="pb-2 text-right">每10股派息(元)</th>
                <th className="pb-2 text-left">分红方案</th>
                <th className="pb-2 text-right">除权除息日</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isSpecial = row.dividendType?.includes("特殊");
                return (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/2">
                    <td className="py-2 text-xs text-slate-300">{fmtDate(row.reportEndDate)}</td>
                    <td className="py-2 text-xs">
                      {isSpecial ? (
                        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-amber-300">特殊分红</span>
                      ) : (
                        <span className="text-slate-400">{row.dividendType || "常规"}</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold text-teal-300 text-xs">
                      {row.cashDiviRMB !== null ? `¥${fmtMoney(row.cashDiviRMB)}` : "–"}
                    </td>
                    <td className="py-2 text-xs text-slate-300 max-w-[200px] truncate" title={row.dividendPlan ?? ""}>
                      {row.dividendPlan || "–"}
                    </td>
                    <td className="py-2 text-right text-xs text-slate-400">
                      {row.exDiviDate ? fmtDate(row.exDiviDate) : "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">最新派息</p>
          <p className="mt-2 text-base font-semibold text-teal-300">
            {rows[0] !== undefined && rows[0].cashDiviRMB !== null ? `¥${fmtMoney(rows[0].cashDiviRMB)} / 10股` : "–"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">历史最高派息</p>
          <p className="mt-2 text-base font-semibold text-sky-300">
            {cashDivs.length > 0 ? `¥${Math.max(...cashDivs).toFixed(3)} / 10股` : "–"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">平均派息</p>
          <p className="mt-2 text-base font-semibold text-violet-300">
            {cashDivs.length > 0
              ? `¥${(cashDivs.reduce((a, b) => a + b, 0) / cashDivs.length).toFixed(3)} / 10股`
              : "–"}
          </p>
        </div>
      </div>
    </div>
  );
}
