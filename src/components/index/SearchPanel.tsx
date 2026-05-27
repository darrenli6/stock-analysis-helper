import { useState } from "react";

const EXAMPLE_PROMPTS = [
  "分析贵州茅台现在是否适合买入，给我技术指标、宏观环境、历史回测和止盈止损建议",
  "分析腾讯控股目前的技术面和资金面，给出买卖建议",
  "分析比亚迪现在值不值得买，给出止盈止损价位",
];

interface SearchPanelProps {
  status: "idle" | "pending" | "running" | "completed" | "failed";
  onSubmit: (input: string) => void;
  error: string | null;
}

export function SearchPanel({ status, onSubmit, error }: SearchPanelProps) {
  const [userInput, setUserInput] = useState("");
  const isLoading = status === "pending" || status === "running";

  return (
    <section className="hero-panel overflow-hidden rounded-[36px] border border-white/10 px-6 py-8 shadow-2xl shadow-cyan-950/30 lg:px-8 2xl:px-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[1280px] flex-1">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">
            Stock Analysis Helper
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-4xl lg:text-5xl xl:text-5xl">
            股票分析助手，输入自然语言，生成一份可执行的股票分析结果
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300 md:text-base">
            支持股票搜索、技术指标判断、宏观环境摘要、历史回测与止盈止损建议。
            非投资类请求会被直接拒绝。
          </p>
        </div>
        <div className="status-chip self-start lg:self-auto">
          当前状态：{status === "idle" ? "待提交" : status}
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto]">
        <textarea
          className="min-h-36 rounded-[28px] border border-white/10 bg-slate-950/70 px-5 py-4 text-base text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="例如：分析贵州茅台现在是否适合买入，给出技术面、行业环境、历史回测和止盈止损"
        />
        <button
          className="rounded-[28px] bg-cyan-300 px-8 py-4 text-base font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
          onClick={() => onSubmit(userInput)}
          disabled={isLoading || !userInput.trim()}
        >
          发起分析
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="self-center text-[11px] uppercase tracking-[0.18em] text-slate-500">
          示例
        </span>
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setUserInput(prompt)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 transition hover:border-cyan-400/40 hover:bg-cyan-400/8 hover:text-cyan-200"
          >
            {prompt.length > 22 ? `${prompt.slice(0, 22)}…` : prompt}
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
