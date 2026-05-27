import { useEffect, useRef, useState } from "react";
import type { AnalysisResult } from "~/types";

interface DebateMessage {
  id: number;
  round: number;
  side: "bull" | "bear";
  provider: string;
  content: string;
  createdAt: string;
}

interface DebateRecord {
  id: string;
  status: "running" | "paused" | "completed" | "failed";
  stockName: string;
  stockCode: string;
  totalRounds: number;
}

interface Props {
  result: AnalysisResult;
  taskId: string;
  onClose: () => void;
}

const PROVIDER_LABEL: Record<string, string> = {
  deepseek: "DeepSeek",
  openai: "OpenAI",
};

function RoundDivider({ round }: { round: number }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-white/8" />
      <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-[11px] text-slate-400">
        第 {round} 轮
      </span>
      <div className="h-px flex-1 bg-white/8" />
    </div>
  );
}

function MessageBubble({ msg }: { msg: DebateMessage }) {
  const isBull = msg.side === "bull";
  return (
    <div className={`flex gap-3 ${isBull ? "flex-row" : "flex-row-reverse"}`}>
      {/* Avatar */}
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${
          isBull
            ? "bg-emerald-500/15 ring-1 ring-emerald-500/30"
            : "bg-red-500/15 ring-1 ring-red-500/30"
        }`}
      >
        {isBull ? "🐂" : "🐻"}
      </div>

      {/* Content */}
      <div className={`max-w-[75%] ${isBull ? "items-start" : "items-end"} flex flex-col gap-1`}>
        <div className={`flex items-center gap-1.5 text-[11px] ${isBull ? "" : "flex-row-reverse"}`}>
          <span className={`font-semibold ${isBull ? "text-emerald-400" : "text-red-400"}`}>
            {isBull ? "买方" : "卖方"}
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-500">{PROVIDER_LABEL[msg.provider] ?? msg.provider}</span>
        </div>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed text-slate-100 ${
            isBull
              ? "rounded-tl-sm bg-emerald-900/30 ring-1 ring-emerald-500/20"
              : "rounded-tr-sm bg-red-900/30 ring-1 ring-red-500/20"
          }`}
        >
          {msg.content}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator({ side }: { side: "bull" | "bear" }) {
  const isBull = side === "bull";
  return (
    <div className={`flex items-center gap-3 ${isBull ? "flex-row" : "flex-row-reverse"}`}>
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${
          isBull
            ? "bg-emerald-500/15 ring-1 ring-emerald-500/30"
            : "bg-red-500/15 ring-1 ring-red-500/30"
        }`}
      >
        {isBull ? "🐂" : "🐻"}
      </div>
      <div
        className={`flex items-center gap-1.5 rounded-2xl px-4 py-3 ${
          isBull
            ? "rounded-tl-sm bg-emerald-900/20 ring-1 ring-emerald-500/15"
            : "rounded-tr-sm bg-red-900/20 ring-1 ring-red-500/15"
        }`}
      >
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
        <span className={`ml-1 text-xs ${isBull ? "text-emerald-400/70" : "text-red-400/70"}`}>
          {isBull ? "买方" : "卖方"}思考中…
        </span>
      </div>
    </div>
  );
}

export function DebateDialog({ result, taskId, onClose }: Props) {
  const [debateId, setDebateId] = useState<string | null>(null);
  const [debate, setDebate] = useState<DebateRecord | null>(null);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [lastMessageId, setLastMessageId] = useState(0);
  const [starting, setStarting] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // pollTick 每轮结束后递增，保证无论有没有新消息都触发下一轮
  const [pollTick, setPollTick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  // 启动辩论（只调用一次）
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/debate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, result }),
        });
        const data = (await res.json()) as { debateId?: string; error?: string };
        if (!res.ok || !data.debateId) throw new Error(data.error ?? "启动失败");
        setDebateId(data.debateId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "启动辩论失败");
      } finally {
        setStarting(false);
      }
    })();
  }, [taskId, result]);

  // 轮询消息 —— 每轮必定触发下一轮（通过 pollTick）
  useEffect(() => {
    if (!debateId) return;
    // 终止状态：不再轮询
    if (
      debate?.status === "completed" ||
      debate?.status === "failed" ||
      debate?.status === "paused"
    ) return;

    let aborted = false;
    // 首次（pollTick=0）快速拉取，之后每 2 秒一次
    const delay = pollTick === 0 ? 300 : 2000;

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/debate/${debateId}?afterMessageId=${lastMessageId}`
        );
        if (aborted || !res.ok) return;

        const snap = (await res.json()) as {
          debate: DebateRecord;
          messages: DebateMessage[];
        };

        if (aborted) return;

        console.log("[debate poll]", snap.debate.status, "new msgs:", snap.messages.length, snap.messages);
        setDebate(snap.debate);

        if (snap.messages.length > 0) {
          setMessages((prev) => [...prev, ...snap.messages]);
          setLastMessageId(snap.messages.at(-1)?.id ?? lastMessageId);
        }
      } catch {
        // AbortError 或网络错误：忽略，下一轮继续
      } finally {
        // 无论成功/失败/abort 都推进下一轮，由 abort 标志防止重复 setState
        if (!aborted) setPollTick((t) => t + 1);
      }
    }, delay);

    return () => {
      aborted = true;
      window.clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debateId, debate?.status, lastMessageId, pollTick]);

  // 自动滚到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleToggle() {
    if (!debateId || toggling) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/debate/${debateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      const data = (await res.json()) as { status?: string };
      if (data.status) {
        setDebate((prev) => prev ? { ...prev, status: data.status as DebateRecord["status"] } : prev);
      }
    } finally {
      setToggling(false);
    }
  }

  // 判断下一条该谁发言（用于 typing indicator）
  const nextExpected = (() => {
    if (!debate || debate.status !== "running") return null;
    for (let r = 1; r <= (debate.totalRounds ?? 3); r++) {
      for (const side of ["bull", "bear"] as const) {
        const exists = messages.some((m) => m.round === r && m.side === side);
        if (!exists) return side;
      }
    }
    return null;
  })();

  // 按轮次分组消息
  const rounds = Array.from(new Set(messages.map((m) => m.round))).sort((a, b) => a - b);

  const statusText =
    debate?.status === "completed" ? "辩论结束"
    : debate?.status === "paused" ? "已暂停"
    : debate?.status === "failed" ? "发生错误"
    : starting ? "启动中…"
    : "辩论进行中";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-white/10 bg-[#07111c] shadow-2xl">

        {/* ── 顶栏 ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-white">买卖方辩论</span>
            <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs text-slate-400">
              {result.stock.name}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 transition hover:text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── 图例 ── */}
        <div className="flex shrink-0 items-center justify-center gap-6 border-b border-white/5 bg-white/2 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-400">
            🐂 <span className="font-semibold">买方</span>
            <span className="text-slate-500">· DeepSeek</span>
          </span>
          <span className="text-slate-600">VS</span>
          <span className="flex items-center gap-1.5 text-red-400">
            🐻 <span className="font-semibold">卖方</span>
            <span className="text-slate-500">· OpenAI</span>
          </span>
        </div>

        {/* ── 消息区 ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="text-center text-sm text-red-400">{error}</p>
          )}
          {starting && !error && (
            <p className="text-center text-sm text-slate-400">正在启动辩论…</p>
          )}
          {!starting && messages.length === 0 && !error && (
            <p className="text-center text-sm text-slate-500">等待买方开始发言…</p>
          )}

          <div className="flex flex-col gap-4">
            {rounds.map((round) => (
              <div key={round} className="flex flex-col gap-4">
                <RoundDivider round={round} />
                {messages
                  .filter((m) => m.round === round)
                  .map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} />
                  ))}
              </div>
            ))}

            {/* 等待下一条消息时显示打字动画 */}
            {nextExpected && <TypingIndicator side={nextExpected} />}
          </div>
        </div>

        {/* ── 底栏 ── */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/8 px-5 py-3">
          <div className="flex items-center gap-3">
            {debate && debate.status !== "completed" && debate.status !== "failed" && (
              <button
                onClick={() => void handleToggle()}
                disabled={toggling}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-50 ${
                  debate.status === "paused"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                }`}
              >
                {debate.status === "paused" ? (
                  <>
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    继续
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                    暂停
                  </>
                )}
              </button>
            )}
            <span className="text-xs text-slate-500">{statusText}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            {debate && (
              <span>
                {messages.filter((m) => m.side === "bull").length} / {debate.totalRounds} 轮已完成
              </span>
            )}
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300 transition hover:bg-white/10"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
