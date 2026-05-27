import type { AnalysisResult } from "~/types";
import { formatValue } from "./formatters";

interface IndicatorItem {
  label: string;
  value: unknown;
}

interface TechnicalSectionProps {
  result: AnalysisResult;
  indicatorItems: IndicatorItem[];
}

export function TechnicalSection({ result, indicatorItems }: TechnicalSectionProps) {
  return (
    <>
      <section className="panel rounded-[28px] border border-white/10 p-5">
        <h3 className="text-base font-semibold text-white">技术面分析</h3>
        <p className="mt-3 text-sm leading-7 text-slate-300">{result.technical.summary}</p>
        <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/8 px-4 py-3 text-sm text-cyan-100">
          评级：{result.technical.rating}
        </div>
        {indicatorItems.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {indicatorItems.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{formatValue(item.value)}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="panel rounded-[28px] border border-white/10 p-5">
          <h3 className="text-base font-semibold text-white">
            买入条件 ({result.technical.buySatisfied}/7)
          </h3>
          <div className="mt-4 space-y-3">
            {result.technical.buyConditions.map((item) => (
              <div key={item.name} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                <p className={item.passed ? "text-emerald-300" : "text-amber-300"}>
                  {item.passed ? "✅" : "⏸️"} {item.name}
                </p>
                <p className="mt-1 text-sm text-slate-300">{item.reason}</p>
              </div>
            ))}
          </div>
        </article>
        <article className="panel rounded-[28px] border border-white/10 p-5">
          <h3 className="text-base font-semibold text-white">
            高位预警 ({result.technical.warningCount}/6)
          </h3>
          <div className="mt-4 space-y-3">
            {result.technical.warnings.map((item) => (
              <div key={item.name} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                <p className={item.triggered ? "text-rose-300" : "text-slate-300"}>
                  {item.triggered ? "⚠️" : "✓"} {item.name}
                </p>
                <p className="mt-1 text-sm text-slate-300">{item.reason}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
