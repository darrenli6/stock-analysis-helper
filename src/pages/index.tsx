import Head from "next/head";
import { useEffect, useState } from "react";
import { ActionMenu } from "~/components/index/ActionMenu";
import { DebateDialog } from "~/components/index/DebateDialog";
import { ChipAnalysis } from "~/components/index/ChipAnalysis";
import { CompanyProfile } from "~/components/index/CompanyProfile";
import { DebugJson } from "~/components/index/DebugJson";
import { DividendAnalysis } from "~/components/index/DividendAnalysis";
import { ExecutionTerminal } from "~/components/index/ExecutionTerminal";
import { FinancialAnalysis } from "~/components/index/FinancialAnalysis";
import { FundAnalysis } from "~/components/index/FundAnalysis";
import { KlineSection } from "~/components/index/KlineSection";
import { MacroAnalysis } from "~/components/index/MacroAnalysis";
import { MarketBackdrop } from "~/components/index/MarketBackdrop";
import { MarketPulse } from "~/components/index/MarketPulse";
import { OverviewCard } from "~/components/index/OverviewCard";
import { NewsIntel } from "~/components/index/NewsIntel";
import { RecommendationCard } from "~/components/index/RecommendationCard";
import { SearchPanel } from "~/components/index/SearchPanel";
import { ShareholderAnalysis } from "~/components/index/ShareholderAnalysis";
import { TechnicalSection } from "~/components/index/TechnicalSection";
import { Footer } from "~/components/index/Footer";
import { getNestedValue, normalizeKlineRows, toNumeric } from "~/components/index/formatters";
import type { AnalysisResult, TaskLog, TaskSnapshot } from "~/types";

export default function Home() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "running" | "completed" | "failed">(
    "idle"
  );
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollInfo, setPollInfo] = useState<string>("未开始轮询");
  const [showDebate, setShowDebate] = useState(false);

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

  async function handleSubmit(userInput: string) {
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
        <title>达轮-股票分析助手</title>
        <meta
          name="description"
          content="输入股票分析需求，查看技术指标、宏观环境、历史回测与买卖建议。"
        />
      </Head>
      <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#15304c,_#08131f_45%,_#05080d)] px-4 py-8 text-slate-100 xl:px-6 2xl:px-8">
        {result && <ActionMenu result={result} />}
        <MarketBackdrop />
        <div className={`relative z-10 mx-auto flex w-full max-w-[1720px] flex-col gap-6 ${result ? "pt-10" : ""}`}>
          <SearchPanel status={status} onSubmit={(input) => void handleSubmit(input)} error={error} />

          <section className="flex flex-col gap-6">
            <ExecutionTerminal logs={logs} taskId={taskId} pollInfo={pollInfo} />

            {result ? (
              <>
                <OverviewCard result={result} actionText={actionText} />
                <CompanyProfile result={result} />
                <TechnicalSection result={result} indicatorItems={indicatorItems} />
                <KlineSection klineRows={klineRows} latestKlineMetrics={latestKlineMetrics} />

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
                        {result.fundAnalysis.market === "hk"
                          ? "港股资金"
                          : result.fundAnalysis.market === "us"
                            ? "美股卖空"
                            : "A 股资金"}
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

                {result.newsData && (
                  <section className="panel rounded-[28px] border border-white/10 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-white">资讯情报</h3>
                      <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-300">
                        Tavily · 公司动态 · 行业 · 竞品 · 业绩
                      </span>
                    </div>
                    <div className="mt-4">
                      <NewsIntel data={result.newsData} />
                    </div>
                  </section>
                )}

                <RecommendationCard result={result} actionText={actionText} />

                {/* 买卖方辩论入口 */}
                <div className="flex justify-center pb-2">
                  <button
                    onClick={() => setShowDebate(true)}
                    className="flex items-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-900/30 to-red-900/30 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-emerald-900/50 hover:to-red-900/50 hover:shadow-emerald-900/20 active:scale-95"
                  >
                    <span>🐂</span>
                    <span>开启买卖方辩论</span>
                    <span>🐻</span>
                  </button>
                </div>

                <DebugJson data={result} />
              </>
            ) : null}
          </section>
        </div>
        {showDebate && result && taskId && (
          <DebateDialog
            result={result}
            taskId={taskId}
            onClose={() => setShowDebate(false)}
          />
        )}
        <Footer />
        <MarketPulse />
      </main>
    </>
  );
}
