import type { ShareholderData } from "~/types";

function fmtShares(v: number | null): string {
  if (v === null) return "–";
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}万`;
  return v.toFixed(0);
}

function HolderChangeTag({ change }: { change: number | null }) {
  if (change === null || change === 0) return <span className="text-slate-500">–</span>;
  const isPos = change > 0;
  return (
    <span className={`text-xs ${isPos ? "text-teal-300" : "text-rose-300"}`}>
      {isPos ? "+" : ""}
      {fmtShares(change)}
    </span>
  );
}

export function ShareholderAnalysis({ data }: { data: ShareholderData }) {
  const { reportDate, top10, holderCount, summary } = data;

  const latestCount = holderCount[0];
  const prevCount = holderCount[1];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        {reportDate && <span>报告期：<span className="text-slate-200">{reportDate}</span></span>}
        {latestCount !== undefined && latestCount.totalSHNum !== null && (
          <span>
            最新股东户数：
            <span className="text-slate-200">
              {latestCount.totalSHNum.toLocaleString("zh-CN")}
            </span>
            {prevCount !== undefined && prevCount.totalSHNum !== null && (
              <span className={`ml-1 ${latestCount.totalSHNum > prevCount.totalSHNum ? "text-rose-300" : "text-teal-300"}`}>
                ({latestCount.totalSHNum > prevCount.totalSHNum ? "↑增加" : "↓减少"})
              </span>
            )}
          </span>
        )}
      </div>

      {summary && (
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/8 px-5 py-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-cyan-300/70">AI 股东分析</p>
          <p className="whitespace-pre-line text-sm leading-7 text-slate-200">{summary}</p>
        </div>
      )}

      {/* Top 10 Shareholders */}
      {top10.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">🏛 十大股东</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-slate-400">
                  <th className="pb-2 text-left w-6">#</th>
                  <th className="pb-2 text-left">股东名称</th>
                  <th className="pb-2 text-right">持股数</th>
                  <th className="pb-2 text-right">持股比例</th>
                  <th className="pb-2 text-right">变动</th>
                </tr>
              </thead>
              <tbody>
                {top10.map((row, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/2">
                    <td className="py-2 text-xs text-slate-500">{row.no ?? i + 1}</td>
                    <td className="py-2 text-xs text-slate-200 max-w-[280px] truncate" title={row.name}>
                      {row.name}
                    </td>
                    <td className="py-2 text-right tabular-nums text-sky-300 text-xs">
                      {fmtShares(row.holdShares)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-200 text-xs">
                      {row.holdPct !== null ? `${row.holdPct.toFixed(2)}%` : "–"}
                    </td>
                    <td className="py-2 text-right">
                      <HolderChangeTag change={row.holdChange} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Concentration bar — top 5 */}
      {top10.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">📊 持股集中度（前5）</h4>
          <div className="space-y-2">
            {top10.slice(0, 5).map((row, i) => {
              const pct = row.holdPct ?? 0;
              const colors = ["#38bdf8", "#60a5fa", "#818cf8", "#a78bfa", "#c084fc"];
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-right text-xs text-slate-500">{row.no ?? i + 1}</span>
                  <div className="relative flex h-5 flex-1 items-center overflow-hidden rounded bg-white/5">
                    <div
                      className="h-full"
                      style={{ width: `${Math.min(100, pct * 1.5).toFixed(1)}%`, backgroundColor: colors[i], opacity: 0.7 }}
                    />
                  </div>
                  <span
                    className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums"
                    style={{ color: colors[i] }}
                  >
                    {pct.toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Holder count trend */}
      {holderCount.length > 1 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">👥 股东户数趋势</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-slate-400">
                  <th className="pb-2 text-left">报告期</th>
                  <th className="pb-2 text-right">股东户数</th>
                  <th className="pb-2 text-right">人均持股</th>
                  <th className="pb-2 text-right">环比</th>
                </tr>
              </thead>
              <tbody>
                {holderCount.map((row, i) => {
                  const prev = holderCount[i + 1];
                  const delta =
                    row.totalSHNum !== null && prev !== undefined && prev.totalSHNum !== null
                      ? row.totalSHNum - prev.totalSHNum
                      : null;
                  const isDecrease = delta !== null && delta < 0;
                  return (
                    <tr key={row.date} className="border-b border-white/5">
                      <td className="py-2 text-xs text-slate-300">{row.date}</td>
                      <td className="py-2 text-right tabular-nums text-slate-200 text-xs">
                        {row.totalSHNum?.toLocaleString("zh-CN") ?? "–"}
                      </td>
                      <td className="py-2 text-right tabular-nums text-slate-300 text-xs">
                        {row.avgHoldShares !== null ? row.avgHoldShares.toFixed(0) : "–"}
                      </td>
                      <td className="py-2 text-right text-xs">
                        {delta !== null ? (
                          <span className={isDecrease ? "text-teal-300" : "text-rose-300"}>
                            {isDecrease ? "↓" : "↑"}{Math.abs(delta).toLocaleString("zh-CN")}
                          </span>
                        ) : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            提示：股东户数减少通常意味着筹码集中，往往被视为偏多信号。
          </p>
        </div>
      )}
    </div>
  );
}
