import { useEffect, useRef, useState } from "react";
import type { HotBoardRow, HotEtfRow, HotStockRow, IpoRow, MarketPulseData, SuspensionRow } from "~/types";

type Tab = "stock" | "board" | "etf" | "ipo" | "suspension";

// ── keyframes (injected once) ─────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes mp-spin {
  to { transform: rotate(360deg); }
}
@keyframes mp-ping {
  0%   { transform: scale(1);   opacity: 0.55; }
  100% { transform: scale(2.6); opacity: 0; }
}
@keyframes mp-glow {
  0%,100% { box-shadow: 0 0 10px 2px rgba(34,211,238,0.25), 0 0 30px 4px rgba(34,211,238,0.08); }
  50%      { box-shadow: 0 0 22px 6px rgba(34,211,238,0.55), 0 0 48px 12px rgba(129,140,248,0.18); }
}
@keyframes mp-panel {
  from { opacity: 0; transform: translateY(22px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
@keyframes mp-row {
  from { opacity: 0; transform: translateX(10px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes mp-tab {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes mp-badge {
  0%,100% { opacity: 1; }
  50%      { opacity: 0.4; }
}
@keyframes mp-ticker {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
`;

// ── helpers ───────────────────────────────────────────────────────────────────

function ZdfBadge({ v }: { v: number | null }) {
  if (v === null) return <span className="text-slate-600 text-xs">–</span>;
  const pos = v > 0;
  return (
    <span
      className={`tabular-nums text-[11px] font-bold tracking-tight px-1.5 py-0.5 rounded-md ${
        pos
          ? "bg-rose-400/12 text-rose-400"
          : "bg-teal-400/12 text-teal-400"
      }`}
    >
      {pos ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}

function RankDelta({ v }: { v: number | null }) {
  if (v === null || v === 0) return <span className="text-slate-700 text-[10px] w-5 text-center">—</span>;
  return (
    <span className={`text-[10px] w-5 text-center font-semibold ${v > 0 ? "text-rose-400" : "text-teal-400"}`}>
      {v > 0 ? `↑${v}` : `↓${Math.abs(v)}`}
    </span>
  );
}

function TopBadge({ rank }: { rank: number }) {
  const colors = ["bg-amber-400 text-black", "bg-slate-300 text-black", "bg-amber-700/80 text-amber-100"];
  const c = colors[rank - 1] ?? "bg-white/10 text-slate-400";
  return (
    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${c}`}>
      {rank}
    </span>
  );
}

// ── animated list row ─────────────────────────────────────────────────────────

function AnimRow({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-2 py-[7px] hover:bg-white/5 transition-colors duration-150"
      style={{ animation: `mp-row 0.32s ease-out ${index * 0.038}s both` }}
    >
      {children}
    </div>
  );
}

// ── tab panels ────────────────────────────────────────────────────────────────

function HotStockPanel({ rows }: { rows: HotStockRow[] }) {
  return (
    <div key="stock" style={{ animation: "mp-tab 0.22s ease-out both" }}>
      {rows.map((r, i) => (
        <AnimRow key={r.code} index={i}>
          {i < 3 ? <TopBadge rank={i + 1} /> : <span className="w-4 shrink-0 text-right text-[10px] text-slate-600">{i + 1}</span>}
          <span className="flex-1 truncate text-xs text-slate-200">{r.name}</span>
          <span className="shrink-0 text-[10px] text-slate-500 tabular-nums w-14 text-right">
            {r.zxj !== null ? r.zxj.toFixed(r.zxj >= 100 ? 2 : 3) : "–"}
          </span>
          <ZdfBadge v={r.zdf} />
        </AnimRow>
      ))}
    </div>
  );
}

function HotBoardPanel({ rows }: { rows: HotBoardRow[] }) {
  return (
    <div key="board" style={{ animation: "mp-tab 0.22s ease-out both" }}>
      {rows.map((r, i) => (
        <AnimRow key={i} index={i}>
          {i < 3 ? <TopBadge rank={i + 1} /> : <span className="w-4 shrink-0 text-right text-[10px] text-slate-600">{r.rank ?? i + 1}</span>}
          <span className="flex-1 truncate text-xs text-slate-200">{r.name}</span>
          <RankDelta v={r.rankdelta} />
          <ZdfBadge v={r.zdf} />
        </AnimRow>
      ))}
    </div>
  );
}

function HotEtfPanel({ rows }: { rows: HotEtfRow[] }) {
  return (
    <div key="etf" style={{ animation: "mp-tab 0.22s ease-out both" }}>
      {rows.map((r, i) => (
        <AnimRow key={r.code} index={i}>
          {i < 3 ? <TopBadge rank={i + 1} /> : <span className="w-4 shrink-0 text-right text-[10px] text-slate-600">{r.rank ?? i + 1}</span>}
          <span className="flex-1 truncate text-xs text-slate-200">{r.name}</span>
          {r.tag && (
            <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/8 px-1.5 py-0.5 text-[9px] text-cyan-300">
              {r.tag}
            </span>
          )}
          <ZdfBadge v={r.zdf} />
        </AnimRow>
      ))}
    </div>
  );
}

function IpoPanel({ rows }: { rows: IpoRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center" style={{ animation: "mp-tab 0.22s ease-out both" }}>
        <p className="text-xs text-slate-600">暂无近期新股</p>
      </div>
    );
  }
  return (
    <div className="space-y-2 py-1" style={{ animation: "mp-tab 0.22s ease-out both" }}>
      {rows.map((r, i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3"
          style={{ animation: `mp-row 0.3s ease-out ${i * 0.06}s both` }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">{r.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              r.stage.includes("上市") ? "bg-teal-400/15 text-teal-300"
              : r.stage.includes("申购") ? "bg-amber-400/15 text-amber-300"
              : "bg-sky-400/15 text-sky-300"
            }`}>
              {r.stage}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span>{r.code}</span>
            {r.price !== null && r.price > 0 && <span>发行价 ¥{r.price.toFixed(2)}</span>}
            {r.sgrq && <span>申购 {r.sgrq}</span>}
            {r.ssrq && r.ssrq !== "--" && <span>上市 {r.ssrq}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function SuspensionPanel({ rows }: { rows: SuspensionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center" style={{ animation: "mp-tab 0.22s ease-out both" }}>
        <p className="text-xs text-slate-600">暂无停复牌信息</p>
      </div>
    );
  }
  return (
    <div className="space-y-2 py-1" style={{ animation: "mp-tab 0.22s ease-out both" }}>
      {rows.map((r, i) => (
        <div
          key={i}
          className="rounded-2xl border border-rose-400/10 bg-rose-400/4 px-3 py-3"
          style={{ animation: `mp-row 0.3s ease-out ${i * 0.06}s both` }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">{r.name}</span>
            <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
              {r.statusDesc ?? "停牌"}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span>{r.code}</span>
            {r.suspendDate && <span>停牌 {r.suspendDate}</span>}
            {r.reason && <span>· {r.reason}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── scrolling ticker (top bar) ────────────────────────────────────────────────

function Ticker({ stocks }: { stocks: HotStockRow[] }) {
  if (stocks.length === 0) return null;
  const items = [...stocks, ...stocks]; // duplicate for seamless loop
  return (
    <div className="overflow-hidden border-b border-white/6 bg-black/20 px-0 py-1.5">
      <div
        className="flex gap-6 whitespace-nowrap text-[10px]"
        style={{ animation: `mp-ticker ${stocks.length * 2.2}s linear infinite` }}
      >
        {items.map((r, i) => (
          <span key={i} className="flex shrink-0 items-center gap-1.5 text-slate-400">
            <span className="text-slate-300">{r.name}</span>
            <span className={`font-bold ${(r.zdf ?? 0) > 0 ? "text-rose-400" : (r.zdf ?? 0) < 0 ? "text-teal-400" : "text-slate-500"}`}>
              {(r.zdf ?? 0) > 0 ? "+" : ""}{r.zdf?.toFixed(2) ?? "–"}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── main widget ───────────────────────────────────────────────────────────────

const TAB_CONFIG: { key: Tab; short: string; emoji: string }[] = [
  { key: "stock", short: "热股", emoji: "🔥" },
  { key: "board", short: "板块", emoji: "📊" },
  { key: "etf", short: "ETF",  emoji: "💎" },
  { key: "ipo",  short: "新股", emoji: "🚀" },
  { key: "suspension", short: "停牌", emoji: "⏸" },
];

export function MarketPulse() {
  const [open, setOpen]       = useState(false);
  const [tab, setTab]         = useState<Tab>("stock");
  const [data, setData]       = useState<MarketPulseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  // load once on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    fetch("/api/market")
      .then((r) => r.json() as Promise<MarketPulseData>)
      .then((d) => {
        setData(d);
        setFetchedAt(new Date(d.fetchedAt).toLocaleTimeString("zh-CN", { hour12: false }));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const hasData    = Boolean(data);
  const showPulse  = hasData && !open && !loading;

  const tabContent = data ? {
    stock:      <HotStockPanel   rows={data.hotStocks} />,
    board:      <HotBoardPanel   rows={data.hotBoards} />,
    etf:        <HotEtfPanel     rows={data.hotEtf} />,
    ipo:        <IpoPanel        rows={data.ipo} />,
    suspension: <SuspensionPanel rows={data.suspension} />,
  } : null;

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div ref={panelRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">

        {/* ── panel ──────────────────────────────────────────────────────── */}
        {open && (
          <div
            className="flex w-[348px] flex-col overflow-hidden rounded-[26px] border border-white/10 shadow-2xl"
            style={{
              height: 528,
              animation: "mp-panel 0.28s cubic-bezier(0.34,1.56,0.64,1) both",
              background: "linear-gradient(155deg,#0c1928 0%,#060e18 100%)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* header */}
            <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full bg-teal-400"
                  style={{ animation: "mp-badge 2s ease-in-out infinite" }}
                />
                <span className="text-sm font-bold tracking-wide text-white">市场热点</span>
              </div>
              <div className="flex items-center gap-2">
                {fetchedAt && <span className="text-[10px] text-slate-600">更新 {fetchedAt}</span>}
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-white/8 text-slate-400 hover:bg-white/15 hover:text-white transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* scrolling ticker */}
            {data && <Ticker stocks={data.hotStocks.slice(0, 10)} />}

            {/* tabs */}
            <div className="flex shrink-0 gap-1 px-3 pt-2 pb-1">
              {TAB_CONFIG.map(({ key, short, emoji }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`relative flex-1 rounded-xl py-1.5 text-[11px] font-semibold transition-all duration-200 ${
                    tab === key
                      ? "bg-gradient-to-b from-cyan-400/20 to-cyan-400/8 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.2)]"
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span className="mr-0.5">{emoji}</span>{short}
                  {tab === key && (
                    <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-cyan-400" />
                  )}
                </button>
              ))}
            </div>

            {/* content */}
            <div className="flex-1 overflow-y-auto px-2 py-1" style={{ scrollbarWidth: "none" }}>
              {loading ? (
                <div className="flex h-full flex-col items-center justify-center gap-4">
                  {/* multi-ring loader */}
                  <div className="relative h-12 w-12">
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400"
                         style={{ animation: "mp-spin 0.9s linear infinite" }} />
                    <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-violet-400"
                         style={{ animation: "mp-spin 1.4s linear infinite reverse" }} />
                  </div>
                  <span className="text-xs text-slate-600">正在拉取实时行情…</span>
                </div>
              ) : !tabContent ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-slate-600">数据加载失败，请稍后重试</p>
                </div>
              ) : (
                // use key to re-trigger animation on tab change
                <div key={tab}>{tabContent[tab]}</div>
              )}
            </div>

            {/* footer */}
            <div className="shrink-0 border-t border-white/6 px-4 py-2 text-center text-[9px] tracking-widest text-slate-700 uppercase">
              westock-data-clawhub · 仅供参考
            </div>
          </div>
        )}

        {/* ── trigger button ──────────────────────────────────────────────── */}
        <div className="relative flex items-center justify-center">

          {/* pulse rings (idle state) */}
          {showPulse && (
            <>
              <div
                className="absolute h-14 w-14 rounded-full bg-cyan-400/20"
                style={{ animation: "mp-ping 2.2s ease-out infinite" }}
              />
              <div
                className="absolute h-14 w-14 rounded-full bg-cyan-400/12"
                style={{ animation: "mp-ping 2.2s ease-out 1.1s infinite" }}
              />
            </>
          )}

          {/* rotating gradient border wrapper */}
          <div
            className="relative h-14 w-14 overflow-hidden rounded-full"
            style={{ padding: "1.5px" }}
          >
            {/* spinning conic gradient */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: open
                  ? "conic-gradient(#22d3ee, #818cf8, #f472b6, #22d3ee)"
                  : hasData
                    ? "conic-gradient(rgba(34,211,238,0.8), rgba(129,140,248,0.5), rgba(244,114,182,0.4), rgba(34,211,238,0.8))"
                    : "conic-gradient(rgba(100,116,139,0.3), rgba(51,65,85,0.3), rgba(100,116,139,0.3))",
                animation: "mp-spin 3s linear infinite",
              }}
            />

            {/* button face */}
            <button
              onClick={() => setOpen((v) => !v)}
              title="市场热点"
              className="absolute flex items-center justify-center rounded-full transition-all duration-200 active:scale-95"
              style={{
                inset: "1.5px",
                background: open
                  ? "linear-gradient(135deg,#0f2540,#0a1628)"
                  : "linear-gradient(135deg,#0c1e35,#070f1c)",
                animation: showPulse ? "mp-glow 2.5s ease-in-out infinite" : undefined,
              }}
            >
              {loading ? (
                /* spinner inside button */
                <div
                  className="h-5 w-5 rounded-full border-[1.5px] border-transparent border-t-cyan-400"
                  style={{ animation: "mp-spin 0.8s linear infinite" }}
                />
              ) : open ? (
                /* close X */
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                /* candlestick / pulse icon */
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polyline
                    points="22 12 18 12 15 21 9 3 6 12 2 12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    stroke={hasData ? "#22d3ee" : "#64748b"}
                  />
                </svg>
              )}

              {/* live dot */}
              {hasData && !open && (
                <span
                  className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-[#070f1c] bg-teal-400"
                  style={{ animation: "mp-badge 2s ease-in-out infinite" }}
                />
              )}
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
