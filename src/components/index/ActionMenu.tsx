import { useState } from "react";
import type { AnalysisResult } from "~/types";

interface Props {
  result: AnalysisResult;
}

export function ActionMenu({ result }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<"idle" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState("");

  function handleExportPDF() {
    window.print();
  }

  async function handleSend() {
    if (!email.trim()) return;
    setSending(true);
    setSent("idle");
    setErrMsg("");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: email.trim(), result }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok) {
        setSent("ok");
      } else {
        setSent("err");
        setErrMsg(data.error ?? "发送失败");
      }
    } catch {
      setSent("err");
      setErrMsg("网络错误，请稍后重试");
    } finally {
      setSending(false);
    }
  }

  function closeModal() {
    setShowModal(false);
    setSent("idle");
    setErrMsg("");
  }

  const actionColor =
    result.recommendation.action === "buy"
      ? "text-emerald-400"
      : result.recommendation.action === "watch"
      ? "text-amber-400"
      : "text-red-400";
  const actionText =
    result.recommendation.action === "buy"
      ? "可考虑买入"
      : result.recommendation.action === "watch"
      ? "建议观察"
      : "建议回避";

  return (
    <>
      {/* ── 固定顶栏 ── */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 border-b border-white/10 bg-[#05080d]/90 px-5 py-2.5 backdrop-blur-md">
        {/* 左侧：股票信息 */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm font-semibold text-white">
            {result.stock.name}
          </span>
          <span className="hidden shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-xs text-slate-400 sm:inline">
            {result.stock.code.toUpperCase()}
          </span>
          {result.technical.price !== null && (
            <span className="hidden shrink-0 text-sm font-medium text-slate-300 sm:inline">
              {result.technical.price.toFixed(2)}{" "}
              <span className="text-xs text-slate-500">{result.technical.currency}</span>
            </span>
          )}
          <span className={`hidden shrink-0 text-xs font-semibold sm:inline ${actionColor}`}>
            {actionText}
          </span>
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10 active:scale-95"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0-3-3m3 3 3-3M3 17l.867 2.6A2 2 0 0 0 5.765 21h12.47a2 2 0 0 0 1.898-1.4L21 17M3 17V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10M3 17h18" />
            </svg>
            导出 PDF
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-xs text-teal-300 transition hover:bg-teal-500/20 active:scale-95"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
            发送邮件
          </button>
        </div>
      </div>

      {/* ── 邮件 Modal ── */}
      {showModal && (
        <div
          className="print:hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d1b2a] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">发送分析报告</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mb-4 text-xs leading-relaxed text-slate-400">
              输入你的邮箱，系统将把{" "}
              <span className="font-semibold text-teal-400">{result.stock.name}</span>{" "}
              的完整分析报告发送到你的邮箱。
            </p>

            {sent !== "ok" ? (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSend(); }}
                  placeholder="your@email.com"
                  className="mb-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/30"
                  autoFocus
                />
                {sent === "err" && (
                  <p className="mb-3 text-xs text-red-400">❌ {errMsg || "发送失败，请稍后重试"}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleSend()}
                    disabled={sending || !email.trim()}
                    className="flex-1 rounded-xl bg-teal-500 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? "发送中…" : "发送"}
                  </button>
                  <button
                    onClick={closeModal}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/10"
                  >
                    取消
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="mb-1 text-2xl">✅</p>
                <p className="text-sm font-semibold text-teal-400">报告已发送</p>
                <p className="mt-1 text-xs text-slate-400">请查收 {email} 的收件箱（可能在垃圾邮件中）</p>
                <button
                  onClick={closeModal}
                  className="mt-4 rounded-xl border border-white/10 bg-white/5 px-6 py-2 text-sm text-slate-300 transition hover:bg-white/10"
                >
                  关闭
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
