import type { ChipData } from "~/types";

function fmtNum(v: number | null, digits = 2): string {
  if (v === null) return "–";
  return v.toFixed(digits);
}

export function ChipAnalysis({ data }: { data: ChipData }) {
  const { closePrice, chipAvgCost, chipProfitRate, chipConcentration70, chipConcentration90, summary, date } = data;

  const isPriceAboveCost = closePrice !== null && chipAvgCost !== null && closePrice > chipAvgCost;
  const costDiff =
    closePrice !== null && chipAvgCost !== null
      ? (((closePrice - chipAvgCost) / chipAvgCost) * 100).toFixed(2)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span>数据日期：<span className="text-slate-200">{date || "–"}</span></span>
      </div>

      {summary && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/8 px-5 py-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-amber-300/70">AI 筹码分析</p>
          <p className="whitespace-pre-line text-sm leading-7 text-slate-200">{summary}</p>
        </div>
      )}

      {/* Price vs Cost */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-white">💰 价格 vs 筹码成本</h4>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">当前价格</p>
            <p className="mt-2 text-xl font-semibold text-white">{fmtNum(closePrice)}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">筹码均价</p>
            <p className="mt-2 text-xl font-semibold text-white">{fmtNum(chipAvgCost)}</p>
            {costDiff !== null && (
              <p className={`mt-1 text-xs ${isPriceAboveCost ? "text-teal-300" : "text-rose-300"}`}>
                {isPriceAboveCost ? "高于均价" : "低于均价"} {Math.abs(Number(costDiff))}%
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">获利盘比例</p>
            <p className={`mt-2 text-xl font-semibold ${(chipProfitRate ?? 0) > 50 ? "text-teal-300" : "text-rose-300"}`}>
              {fmtNum(chipProfitRate, 1)}%
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {(chipProfitRate ?? 0) > 60 ? "获利盘为主" : (chipProfitRate ?? 0) > 40 ? "多空均衡" : "套牢盘为主"}
            </p>
          </div>
        </div>
      </div>

      {/* Concentration */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-white">📊 筹码集中度</h4>
        <div className="space-y-4 rounded-2xl border border-white/8 bg-white/4 px-5 py-4">
          {[
            { label: "70% 筹码集中度", value: chipConcentration70, color: "#60a5fa", desc: "70% 持仓集中在此价格区间内（越小越集中）" },
            { label: "90% 筹码集中度", value: chipConcentration90, color: "#a78bfa", desc: "90% 持仓集中在此价格区间内" },
          ].map(({ label, value, color, desc }) => (
            <div key={label}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">{label}</span>
                <span className="font-semibold tabular-nums" style={{ color }}>
                  {fmtNum(value, 2)}%
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, value ?? 0)}%`, backgroundColor: color, opacity: 0.7 }}
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{desc}</p>
            </div>
          ))}
          <p className="pt-1 text-xs text-slate-400">
            {(chipConcentration70 ?? 100) < 5
              ? "筹码高度集中，短期支撑/压力明显"
              : (chipConcentration70 ?? 100) < 15
                ? "筹码较为集中，走势相对稳定"
                : "筹码较分散，价格区间较宽"}
          </p>
        </div>
      </div>

      {/* Price vs Avg Cost bar */}
      {closePrice !== null && chipAvgCost !== null && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">📍 价格位置示意</h4>
          <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-4">
            <div className="relative h-8 overflow-hidden rounded-full bg-white/8">
              {/* avg cost marker */}
              <div
                className="absolute top-0 h-full w-0.5 bg-amber-400/80"
                style={{ left: "50%" }}
              />
              {/* current price marker */}
              {(() => {
                const ratio = chipAvgCost !== 0 ? closePrice / chipAvgCost : 1;
                const pct = Math.min(95, Math.max(5, ratio * 50));
                return (
                  <div
                    className="absolute top-1 h-6 w-3 rounded-full bg-teal-400/90"
                    style={{ left: `${pct.toFixed(1)}%`, transform: "translateX(-50%)" }}
                  />
                );
              })()}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-slate-500">
              <span>低于均价区</span>
              <span className="text-amber-400/80">筹码均价 {fmtNum(chipAvgCost)}</span>
              <span>高于均价区</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
