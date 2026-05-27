import type { AnalysisResult } from "~/types";
import { formatValue } from "./formatters";

interface RecommendationCardProps {
  result: AnalysisResult;
  actionText: string;
}

export function RecommendationCard({ result, actionText }: RecommendationCardProps) {
  return (
    <>
      <section className="panel rounded-[28px] border border-white/10 p-5">
        <h3 className="text-base font-semibold text-white">历史回测</h3>
        <p className="mt-3 text-sm leading-7 text-slate-300">{result.backtest.summary}</p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="panel rounded-[28px] border border-white/10 p-5">
          <h3 className="text-base font-semibold text-white">买卖建议</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {actionText}，置信度 {result.recommendation.confidence}%。
          </p>
        </article>
        <article className="panel rounded-[28px] border border-white/10 p-5">
          <h3 className="text-base font-semibold text-white">风控价位</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <p>止盈价：{formatValue(result.recommendation.takeProfit)}</p>
            <p>止损价：{formatValue(result.recommendation.stopLoss)}</p>
          </div>
        </article>
      </section>

      <section className="panel rounded-[28px] border border-white/10 p-5">
        <h3 className="text-base font-semibold text-white">建议依据</h3>
        <div className="mt-4 space-y-2 text-sm text-slate-300">
          {result.recommendation.rationale.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </section>
    </>
  );
}
