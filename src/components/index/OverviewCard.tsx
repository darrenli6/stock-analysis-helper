import type { AnalysisResult } from "~/types";
import { formatValue } from "./formatters";

interface OverviewCardProps {
  result: AnalysisResult;
  actionText: string;
}

export function OverviewCard({ result, actionText }: OverviewCardProps) {
  return (
    <section className="panel rounded-[28px] border border-white/10 p-6 2xl:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-white">结论总览</h2>
        <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-cyan-200">
          {result.company.name || result.stock.name} · {result.stock.code}
        </span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <p className="metric-label">当前价格</p>
          <p className="metric-value">
            {formatValue(result.technical.price)} {result.technical.currency}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-label">技术信号</p>
          <p className="metric-value">{result.technical.signal}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">技术评分</p>
          <p className="metric-value">{result.technical.score}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">建议动作</p>
          <p className="metric-value">{actionText}</p>
        </div>
      </div>
    </section>
  );
}
