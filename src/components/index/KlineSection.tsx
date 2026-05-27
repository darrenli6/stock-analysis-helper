import type { KlineRow } from "~/types";
import { KlineChart } from "./KlineChart";
import { formatLargeNumber, formatValue } from "./formatters";

interface KlineSectionProps {
  klineRows: KlineRow[];
  latestKlineMetrics: {
    volume: number | null;
    amount: number | null;
    exchange: number | null;
  };
}

export function KlineSection({ klineRows, latestKlineMetrics }: KlineSectionProps) {
  return (
    <section className="panel rounded-[28px] border border-white/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">K 线图</h3>
        <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-300">
          日线 · 180 天
        </span>
      </div>
      <div className="mt-4">
        <KlineChart rows={klineRows} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Volume</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {formatLargeNumber(latestKlineMetrics.volume)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Amount</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {formatLargeNumber(latestKlineMetrics.amount)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Exchange</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {formatValue(latestKlineMetrics.exchange)}
          </p>
        </div>
      </div>
    </section>
  );
}
