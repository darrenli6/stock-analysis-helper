import { useEffect, useRef } from "react";
import type { TaskLog } from "~/types";
import { formatTime, summarizePayload } from "./formatters";

interface ExecutionTerminalProps {
  logs: TaskLog[];
  taskId: string | null;
  pollInfo: string;
}

export function ExecutionTerminal({ logs, taskId, pollInfo }: ExecutionTerminalProps) {
  const terminalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    terminalRef.current?.scrollTo({
      top: terminalRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [logs]);

  return (
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
  );
}
