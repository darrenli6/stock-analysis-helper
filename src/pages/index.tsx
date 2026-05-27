import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { Footer } from "~/components/index/Footer";
import { ChipAnalysis } from "~/components/index/ChipAnalysis";
import { DebugJson } from "~/components/index/DebugJson";
import { DividendAnalysis } from "~/components/index/DividendAnalysis";
import { FinancialAnalysis } from "~/components/index/FinancialAnalysis";
import { FundAnalysis } from "~/components/index/FundAnalysis";
import { KlineChart } from "~/components/index/KlineChart";
import { MacroAnalysis } from "~/components/index/MacroAnalysis";
import { MarketBackdrop } from "~/components/index/MarketBackdrop";
import { MarketPulse } from "~/components/index/MarketPulse";
import { ShareholderAnalysis } from "~/components/index/ShareholderAnalysis";
import type { AnalysisResult, KlineRow, TaskLog, TaskSnapshot } from "~/types";

const EXAMPLE_PROMPTS = [
  "分析贵州茅台现在是否适合买入，给我技术指标、宏观环境、历史回测和止盈止损建议",
  "分析腾讯控股目前的技术面和资金面，给出买卖建议",
  "分析英伟达 NVDA 当前买入时机，结合宏观环境和技术指标",
  "分析比亚迪现在值不值得买，给出止盈止损价位",
  "分析恒生科技指数 ETF 的行情走势和操作建议",
];

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return Number.isInteger(value) ? value : value.toFixed(2);
  return String(value);
}

function formatLargeNumber(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("zh-CN", { hour12: false });
}

function summarizePayload(payload: unknown) {
  if (!payload) return "";
  try {
    const text = JSON.stringify(payload);
    return text.length > 180 ? `${text.slice(0, 180)}...` : text;
  } catch {
    return String(payload);
  }
}

function getNestedValue(source: Record<string, unknown> | undefined, path: string) {
  if (!source) return undefined;
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

function toNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeKlineRows(source: unknown): KlineRow[] {
  if (!Array.isArray(source)) return [];
  return source
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        date: String(row.date ?? ""),
        open: toNumeric(row.open),
        last: toNumeric(row.last ?? row.close ?? row.closePrice ?? row.price),
        high: toNumeric(row.high),
        low: toNumeric(row.low),
        volume: toNumeric(row.volume),
        amount: toNumeric(row.amount),
        exchange: toNumeric(row.exchange),
      };
    })
    .filter((row) => row.date);
}

export default function Home() {
  const [userInput, setUserInput] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "running" | "completed" | "failed">(
    "idle"
  );
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollInfo, setPollInfo] = useState<string>("未开始轮询");
  const terminalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    terminalRef.current?.scrollTo({
      top: terminalRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [logs]);

  useEffect(() => {
    if (!taskId || (status !== "pending" && status !== "running")) return;

    const lastLogId = [...logs].reverse().find((log) => log.id > 0)?.id ?? 0;
    const controller = new AbortController();

    const poll = async () => {
      setPollInfo(`轮询中，afterLogId=${lastLogId}`);
      const response = await fetch(`/api/tasks/${taskId}?afterLogId=${lastLogId}`, {
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("任务轮询失败");

      const snapshot = (await response.json()) as TaskSnapshot;
      setPollInfo(
        `最近轮询 ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}，新增 ${snapshot.logs.length} 条，状态 ${snapshot.task.status}`
      );
      setStatus(snapshot.task.status);
      setLogs((current) => [...current, ...snapshot.logs]);
      if (snapshot.result) setResult(snapshot.result);
      if (snapshot.task.status === "failed" && snapshot.logs.length > 0) {
        const latestError = [...snapshot.logs].reverse().find((log) => log.logType === "error");
        setError(latestError?.message ?? "分析失败");
      }
    };

    const timer = window.setTimeout(() => {
      void poll().catch((pollError: unknown) => {
        if ((pollError as Error).name !== "AbortError") {
          setStatus("failed");
          setError((pollError as Error).message);
          setPollInfo(`轮询失败：${(pollError as Error).message}`);
        }
      });
    }, 1200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [taskId, status, logs]);

  async function handleSubmit() {
    setError(null);
    setResult(null);
    setLogs([]);
    setTaskId(null);
    setStatus("pending");
    setPollInfo("请求发出中");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput }),
      });

      const payload = (await response.json()) as { taskId?: string; error?: string };
      if (!response.ok || !payload.taskId) {
        throw new Error(payload.error ?? "提交失败");
      }

      setTaskId(payload.taskId);
      setLogs([
        {
          id: 0,
          step: 0,
          logType: "log",
          message: "请求已提交，开始进入股票分析工作流",
          createdAt: new Date().toISOString(),
        },
      ]);
      setPollInfo("等待后端产生日志");
      setStatus("running");
    } catch (submitError) {
      setStatus("failed");
      setError(submitError instanceof Error ? submitError.message : "提交失败");
      setPollInfo("请求失败");
    }
  }

  const actionText =
    result?.recommendation.action === "buy"
      ? "可考虑买入"
      : result?.recommendation.action === "watch"
        ? "建议观察"
        : "建议回避";

  const technicalData = result?.technical.indicators.technical as Record<string, unknown> | undefined;
  const latestBar = result?.technical.indicators.latestBar as Record<string, unknown> | undefined;
  const klineRows = normalizeKlineRows(result?.technical.indicators.klineSeries);
  const latestKlineMetrics = {
    volume: toNumeric(latestBar?.volume) ?? klineRows.at(0)?.volume ?? null,
    amount: toNumeric(latestBar?.amount) ?? klineRows.at(0)?.amount ?? null,
    exchange: toNumeric(latestBar?.exchange) ?? klineRows.at(0)?.exchange ?? null,
  };
  const indicatorItems = result
    ? [
        { label: "收盘价", value: latestBar?.closePrice ?? latestBar?.close ?? result.technical.price },
        { label: "MA5", value: getNestedValue(technicalData, "ma.MA_5") },
        { label: "MA10", value: getNestedValue(technicalData, "ma.MA_10") },
        { label: "MA20", value: getNestedValue(technicalData, "ma.MA_20") },
        { label: "MACD DIF", value: getNestedValue(technicalData, "macd.DIF") },
        { label: "MACD DEA", value: getNestedValue(technicalData, "macd.DEA") },
        { label: "MACD", value: getNestedValue(technicalData, "macd.MACD") },
        { label: "KDJ K", value: getNestedValue(technicalData, "kdj.KDJ_K") },
        { label: "KDJ D", value: getNestedValue(technicalData, "kdj.KDJ_D") },
        { label: "KDJ J", value: getNestedValue(technicalData, "kdj.KDJ_J") },
        { label: "RSI6", value: getNestedValue(technicalData, "rsi.RSI_6") },
        { label: "RSI12", value: getNestedValue(technicalData, "rsi.RSI_12") },
        { label: "RSI24", value: getNestedValue(technicalData, "rsi.RSI_24") },
        { label: "SAR", value: getNestedValue(technicalData, "dmi.SAR") },
        { label: "PDI", value: getNestedValue(technicalData, "dmi.PDI") },
        { label: "MDI", value: getNestedValue(technicalData, "dmi.MDI") },
        { label: "ADX", value: getNestedValue(technicalData, "dmi.ADX") },
      ]
    : [];

  return (
    <>
      <Head>
        <title>股票分析工作台</title>
        <meta
          name="description"
          content="输入股票分析需求，查看技术指标、宏观环境、历史回测与买卖建议。"
        />
      </Head>
      <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#15304c,_#08131f_45%,_#05080d)] px-4 py-8 text-slate-100 xl:px-6 2xl:px-8">
        <MarketBackdrop />
        <div className="relative z-10 mx-auto flex w-full max-w-[1720px] flex-col gap-6">
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
                onChange={(event) => setUserInput(event.target.value)}
                placeholder="例如：分析贵州茅台现在是否适合买入，给出技术面、行业环境、历史回测和止盈止损"
              />
              <button
                className="rounded-[28px] bg-cyan-300 px-8 py-4 text-base font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
                onClick={() => void handleSubmit()}
                disabled={status === "pending" || status === "running" || !userInput.trim()}
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

          <section className="flex flex-col gap-6">
            <section className="panel rounded-[28px] border border-white/10 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">执行终端</h2>
                <div className="flex flex-col items-end text-xs text-slate-400">
                  {taskId ? <span>Task: {taskId}</span> : null}
                  <span>{pollInfo}</span>
                </div>
              </div>
              <div
                ref={terminalRef}
                className="terminal mt-4 h-[460px] overflow-y-auto rounded-[22px] bg-[#02070d] p-4 font-mono text-sm leading-7 text-emerald-300"
              >
                {logs.length === 0 ? (
                  <p className="text-slate-500">$ 等待任务启动…</p>
                ) : (
                  logs.map((log) => (
                    <div key={`${log.id}-${log.createdAt}`} className="terminal-line">
                      <span className="text-slate-500">{formatTime(log.createdAt)}</span>{" "}
                      <span className="text-cyan-400">[{log.step}/{log.logType}]</span>{" "}
                      <span className={log.logType === "error" ? "text-rose-300" : "text-emerald-300"}>
                        {log.message}
                      </span>
                      {log.payload ? (
                        <div className="pl-20 text-xs leading-6 text-slate-400">
                          {summarizePayload(log.payload)}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>

            {result ? (
              <>
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

                <section className="panel rounded-[28px] border border-white/10 p-5">
                  <h3 className="text-base font-semibold text-white">公司简介</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 text-sm text-slate-300">
                      <p>公司名称：{result.company.name || "-"}</p>
                      <p>所属行业：{result.company.industry || "-"}</p>
                      <p>董事长：{result.company.chairman || "-"}</p>
                      <p>上市日期：{result.company.listedDate || "-"}</p>
                    </div>
                    <div className="space-y-2 text-sm text-slate-300">
                      <p>官网：{result.company.website || "-"}</p>
                      <p>注册地：{result.company.regAddress || "-"}</p>
                      <p>电话：{result.company.tel || "-"}</p>
                      <p>邮箱：{result.company.email || "-"}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">公司介绍</p>
                      <p className="mt-2 whitespace-pre-line">
                        {result.company.introduction || "暂无公司介绍。"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">主营业务</p>
                      <p className="mt-2 whitespace-pre-line">
                        {result.company.business || "暂无主营业务描述。"}
                      </p>
                    </div>
                  </div>
                </section>

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
                          <p className="mt-2 text-sm font-semibold text-white">
                            {formatValue(item.value)}
                          </p>
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

                {result.financialAnalysis && (
                  <section className="panel rounded-[28px] border border-white/10 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-white">财务报表分析</h3>
                      <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-300">
                        {result.financialAnalysis.market === "hk"
                          ? "港股财报"
                          : result.financialAnalysis.market === "us"
                            ? "美股财报"
                            : "A 股财报"}{" "}
                        · 近 {result.financialAnalysis.periods.length} 期
                      </span>
                    </div>
                    <div className="mt-4">
                      <FinancialAnalysis data={result.financialAnalysis} />
                    </div>
                  </section>
                )}

                {result.fundAnalysis && (
                  <section className="panel rounded-[28px] border border-white/10 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-white">资金与交易分析</h3>
                      <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-300">
                        {result.fundAnalysis.market === "hk" ? "港股资金" : result.fundAnalysis.market === "us" ? "美股卖空" : "A 股资金"}
                      </span>
                    </div>
                    <div className="mt-4">
                      <FundAnalysis data={result.fundAnalysis} />
                    </div>
                  </section>
                )}

                {result.macroAnalysis && (
                  <section className="panel rounded-[28px] border border-white/10 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-white">宏观环境分析</h3>
                      <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-300">
                        Bing 网络搜索 · 实时分析
                      </span>
                    </div>
                    <div className="mt-4">
                      <MacroAnalysis data={result.macroAnalysis} />
                    </div>
                  </section>
                )}

                {result.chipData && (
                  <section className="panel rounded-[28px] border border-white/10 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-white">筹码成本分析</h3>
                      <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-300">
                        仅沪深A股
                      </span>
                    </div>
                    <div className="mt-4">
                      <ChipAnalysis data={result.chipData} />
                    </div>
                  </section>
                )}

                {result.shareholderData && (
                  <section className="panel rounded-[28px] border border-white/10 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-white">股东结构分析</h3>
                      <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-300">
                        {result.fundAnalysis?.market === "hk" ? "港股股东" : "A股股东"}
                      </span>
                    </div>
                    <div className="mt-4">
                      <ShareholderAnalysis data={result.shareholderData} />
                    </div>
                  </section>
                )}

                {result.dividendData && (
                  <section className="panel rounded-[28px] border border-white/10 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-white">分红数据分析</h3>
                      <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-300">
                        近 5 年分红
                      </span>
                    </div>
                    <div className="mt-4">
                      <DividendAnalysis data={result.dividendData} />
                    </div>
                  </section>
                )}

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

                <DebugJson data={result} />
              </>
            ) : null}
          </section>
        </div>
        <Footer />
        <MarketPulse />
      </main>
    </>
  );
}
