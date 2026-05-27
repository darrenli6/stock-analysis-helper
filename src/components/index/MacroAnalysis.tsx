import type { MacroAnalysisData } from "~/types";

type Props = { data: MacroAnalysisData };

// ── helpers ──────────────────────────────────────────────────────────────────

type StatusMeta = { label: string; color: string; bg: string; border: string };

function industryMeta(status: string): StatusMeta {
  if (status === "up")
    return { label: "上行", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" };
  if (status === "down")
    return { label: "下行", color: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-400/30" };
  return { label: "平稳", color: "text-sky-400", bg: "bg-sky-400/10", border: "border-sky-400/30" };
}

function governanceMeta(status: string): StatusMeta {
  if (status === "severe")
    return { label: "严重风险", color: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-400/30" };
  if (status === "moderate")
    return { label: "中等风险", color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30" };
  if (status === "mild")
    return { label: "轻微风险", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/30" };
  return { label: "治理良好", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" };
}

function macroMeta(status: string): StatusMeta {
  if (status === "bull")
    return { label: "利好", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" };
  if (status === "bear")
    return { label: "利空", color: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-400/30" };
  return { label: "中性", color: "text-sky-400", bg: "bg-sky-400/10", border: "border-sky-400/30" };
}

function coefColor(v: number) {
  if (v >= 1.05) return "text-emerald-400";
  if (v <= 0.85) return "text-rose-400";
  return "text-sky-300";
}

function riskColor(v: number) {
  if (v >= 1.3) return "text-rose-400";
  if (v >= 1.1) return "text-amber-400";
  return "text-emerald-400";
}

// ── coefficient bar ───────────────────────────────────────────────────────────

function CoefBar({ value, max = 1.3 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color =
    value >= 1.05 ? "bg-emerald-400" : value <= 0.85 ? "bg-rose-400" : "bg-sky-400";
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/8">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      {/* midpoint marker at 1.0 / ~77% of 1.3 */}
      <div className="absolute top-0 h-full w-px bg-white/20" style={{ left: `${(1.0 / max) * 100}%` }} />
    </div>
  );
}

// ── signal count pills ────────────────────────────────────────────────────────

function SignalPills({ bull, bear, neutral }: { bull?: number; bear?: number; neutral?: number }) {
  if (bull === undefined && bear === undefined && neutral === undefined) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {bull !== undefined && (
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-400">
          多头 {bull}
        </span>
      )}
      {bear !== undefined && (
        <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] text-rose-400">
          空头 {bear}
        </span>
      )}
      {neutral !== undefined && (
        <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] text-sky-400">
          中性 {neutral}
        </span>
      )}
    </div>
  );
}

// ── signal card ───────────────────────────────────────────────────────────────

function SignalCard({
  title,
  icon,
  meta,
  signal,
}: {
  title: string;
  icon: string;
  meta: StatusMeta;
  signal: MacroAnalysisData["industry"];
}) {
  return (
    <div className={`rounded-2xl border ${meta.border} ${meta.bg} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {icon} {title}
        </span>
        <span className={`rounded-full border ${meta.border} px-2.5 py-0.5 text-xs font-semibold ${meta.color}`}>
          {meta.label}
        </span>
      </div>
      <p className="text-xs leading-5 text-slate-400">{signal.reason}</p>
      <SignalPills bull={signal.bullCount} bear={signal.bearCount} neutral={signal.neutralCount} />
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>调整系数</span>
          <span className={`font-mono font-semibold ${coefColor(signal.coefficient)}`}>
            {signal.coefficient.toFixed(2)}
          </span>
        </div>
        <CoefBar value={signal.coefficient} />
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>风险系数</span>
          <span className={`font-mono font-semibold ${riskColor(signal.riskCoefficient)}`}>
            {signal.riskCoefficient.toFixed(2)}
          </span>
        </div>
        <CoefBar value={signal.riskCoefficient} />
      </div>
    </div>
  );
}

// ── overall assessment ────────────────────────────────────────────────────────

function OverallBar({ label, value, colorFn }: { label: string; value: number; colorFn: (v: number) => string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className={`font-mono font-bold text-sm ${colorFn(value)}`}>{value.toFixed(3)}</span>
      </div>
      <CoefBar value={value} max={2.0} />
    </div>
  );
}

// ── governance alert ──────────────────────────────────────────────────────────

function GovernanceAlert({ status, reason }: { status: string; reason: string }) {
  if (status === "severe") {
    return (
      <div className="flex gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
        <span className="shrink-0 text-lg">🚨</span>
        <div>
          <p className="text-xs font-bold text-rose-400">严重治理风险警告</p>
          <p className="mt-0.5 text-xs text-rose-300/80">{reason}</p>
        </div>
      </div>
    );
  }
  if (status === "moderate") {
    return (
      <div className="flex gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
        <span className="shrink-0 text-lg">⚠️</span>
        <div>
          <p className="text-xs font-bold text-amber-400">中等治理风险警告</p>
          <p className="mt-0.5 text-xs text-amber-300/80">{reason}</p>
        </div>
      </div>
    );
  }
  return null;
}

// ── main component ────────────────────────────────────────────────────────────

export function MacroAnalysis({ data }: Props) {
  const indMeta = industryMeta(data.industry.status);
  const govMeta = governanceMeta(data.governance.status);
  const macMeta = macroMeta(data.macro.status);

  return (
    <div className="space-y-4">
      {/* governance alert if risky */}
      <GovernanceAlert status={data.governance.status} reason={data.governance.reason} />

      {/* three signal cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <SignalCard title="行业周期" icon="📈" meta={indMeta} signal={data.industry} />
        <SignalCard title="公司治理" icon="🏢" meta={govMeta} signal={data.governance} />
        <SignalCard title="宏观经济" icon="🌍" meta={macMeta} signal={data.macro} />
      </div>

      {/* overall coefficients */}
      <div className="rounded-2xl border border-white/8 bg-white/4 p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
          🎯 综合评估
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <OverallBar label="综合调整系数" value={data.totalCoefficient} colorFn={coefColor} />
          <OverallBar label="综合风险系数" value={data.totalRisk} colorFn={riskColor} />
        </div>
        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          调整系数 &gt; 1 表示宏观环境对估值有正向加持；风险系数 &gt; 1 表示整体风险偏高，需相应压缩仓位。
          以上结论由 Bing 网络搜索关键词统计生成，仅供参考。
        </p>
      </div>
    </div>
  );
}
