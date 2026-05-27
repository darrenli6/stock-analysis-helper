import type { KlineRow } from "~/types";

// ─── Layout constants ──────────────────────────────────────────────────────────
const W = 1420;
const H = 480;
const PAD_L = 68;      // left margin for y-axis labels
const PAD_R = 16;
const PRICE_TOP = 38;  // below legend
const PRICE_BOT = 352; // PRICE_TOP + 314
const VOL_TOP = 366;   // PRICE_BOT + 14 gap
const VOL_BOT = 452;   // VOL_TOP + 86
const CHART_W = W - PAD_L - PAD_R;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcMA(values: (number | null)[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const slice = values.slice(i - period + 1, i + 1);
    if (slice.some((v) => v === null)) return null;
    return (slice as number[]).reduce((a, b) => a + b, 0) / period;
  });
}

function buildPath(
  values: (number | null)[],
  xFn: (i: number) => number,
  yFn: (v: number) => number,
): string {
  let d = "";
  let penDown = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) {
      penDown = false;
      continue;
    }
    const x = xFn(i).toFixed(1);
    const y = yFn(v as number).toFixed(1);
    d += penDown ? ` L${x},${y}` : `M${x},${y}`;
    penDown = true;
  }
  return d;
}

function niceAxisTicks(lo: number, hi: number, count = 5): number[] {
  if (hi <= lo) return [lo, hi];
  const raw = (hi - lo) / (count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = ([1, 2, 2.5, 5, 10].find((f) => f * mag >= raw) ?? 10) * mag;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (
    let v = start;
    ticks.length <= count + 1 && v <= hi + step * 0.01;
    v = +(v + step).toFixed(10)
  ) {
    if (v >= lo - step * 0.01) ticks.push(v);
  }
  return ticks;
}

function fmtDate(date: string): string {
  if (date.length >= 10 && date[4] === "-") return date.slice(5, 10); // MM-DD
  if (date.length === 8) return `${date.slice(4, 6)}-${date.slice(6, 8)}`;
  return date.slice(-5);
}

function fmtVolLabel(v: number): string {
  const wan = Math.round(v / 1e4);
  if (wan >= 100000) return `${(wan / 10000).toFixed(1)}亿`;
  return `${wan.toLocaleString("zh-CN")}万`;
}

// ─── Legend config ────────────────────────────────────────────────────────────
const LEGEND_ITEMS = [
  { label: "K线", color: "#ef5350", type: "rect" as const },
  { label: "MA5", color: "#60a5fa", type: "line" as const },
  { label: "MA20", color: "#4ade80", type: "line" as const },
  { label: "MA60", color: "#fb923c", type: "line" as const },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function KlineChart({ rows }: { rows: KlineRow[] }) {
  const data = [...rows].reverse().slice(-180);

  const validData = data.filter(
    (r) => r.open !== null && r.last !== null && r.high !== null && r.low !== null,
  );
  if (validData.length === 0) {
    return <p className="text-sm text-slate-400">暂无 K 线数据。</p>;
  }

  // Price range with small padding
  const allHighs = validData.map((r) => r.high as number);
  const allLows = validData.map((r) => r.low as number);
  const rawMax = Math.max(...allHighs);
  const rawMin = Math.min(...allLows);
  const rangePad = (rawMax - rawMin) * 0.03;
  const pMax = rawMax + rangePad;
  const pMin = rawMin - rangePad;
  const pRange = Math.max(pMax - pMin, 0.001);

  // Moving averages
  const closes = data.map((r) => r.last);
  const ma5 = calcMA(closes, 5);
  const ma20 = calcMA(closes, 20);
  const ma60 = calcMA(closes, 60);

  // Volume
  const allVols = data.map((r) => r.volume).filter((v): v is number => v !== null);
  const maxVol = Math.max(...allVols, 1);

  // Coordinate helpers
  const slot = CHART_W / data.length;
  const cw = Math.max(2, slot * 0.65);
  const xFn = (i: number) => PAD_L + i * slot + slot / 2;
  const yPriceFn = (v: number) => PRICE_TOP + ((pMax - v) / pRange) * (PRICE_BOT - PRICE_TOP);
  const yVolFn = (v: number) => VOL_BOT - (v / maxVol) * (VOL_BOT - VOL_TOP);

  // Axis ticks
  const priceTicks = niceAxisTicks(pMin, pMax, 5).filter((t) => t >= pMin && t <= pMax);
  const volTicks = niceAxisTicks(0, maxVol, 4).filter((t) => t > 0 && t <= maxVol);

  // X-axis labels (~16 evenly spaced)
  const labelStep = Math.ceil(data.length / Math.min(data.length, 16));
  const xLabels = data
    .map((r, i) => ({ i, date: r.date }))
    .filter(({ i }) => i % labelStep === 0);

  // MA path strings
  const ma5d = buildPath(ma5, xFn, yPriceFn);
  const ma20d = buildPath(ma20, xFn, yPriceFn);
  const ma60d = buildPath(ma60, xFn, yPriceFn);

  // Legend positioning (centered)
  const LEG_Y = 20;
  const LEG_CX = W / 2;
  const LEG_OFFSETS = [-170, -96, -22, 60];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-2xl"
      style={{ background: "linear-gradient(175deg,#0e1117 0%,#080b10 100%)" }}
    >
      {/* ── Price horizontal grid lines ───────────────────────────────── */}
      {priceTicks.map((t) => {
        const y = yPriceFn(t).toFixed(1);
        return (
          <line
            key={`pg-${t}`}
            x1={PAD_L}
            y1={y}
            x2={W - PAD_R}
            y2={y}
            stroke="rgba(148,163,184,0.07)"
            strokeWidth="1"
          />
        );
      })}

      {/* ── Price Y-axis labels ───────────────────────────────────────── */}
      {priceTicks.map((t) => (
        <text
          key={`pt-${t}`}
          x={PAD_L - 8}
          y={(yPriceFn(t) + 4).toFixed(1)}
          fill="rgba(148,163,184,0.72)"
          fontSize="11"
          textAnchor="end"
        >
          {t >= 100 ? t.toFixed(1) : t.toFixed(2)}
        </text>
      ))}

      {/* ── Candlesticks ─────────────────────────────────────────────── */}
      {data.map((row, i) => {
        if (row.open == null || row.last == null || row.high == null || row.low == null)
          return null;
        const cx = xFn(i);
        const isUp = row.last >= row.open;
        const color = isUp ? "#26a69a" : "#ef5350";
        const bt = yPriceFn(Math.max(row.open, row.last));
        const bb = yPriceFn(Math.min(row.open, row.last));
        const bh = Math.max(1, bb - bt);
        return (
          <g key={`c-${i}`}>
            <line
              x1={cx.toFixed(1)}
              y1={yPriceFn(row.high).toFixed(1)}
              x2={cx.toFixed(1)}
              y2={yPriceFn(row.low).toFixed(1)}
              stroke={color}
              strokeWidth="1"
            />
            <rect
              x={(cx - cw / 2).toFixed(1)}
              y={bt.toFixed(1)}
              width={cw.toFixed(1)}
              height={bh.toFixed(1)}
              fill={color}
            />
          </g>
        );
      })}

      {/* ── MA lines ─────────────────────────────────────────────────── */}
      {ma5d && <path d={ma5d} fill="none" stroke="#60a5fa" strokeWidth="1.4" />}
      {ma20d && <path d={ma20d} fill="none" stroke="#4ade80" strokeWidth="1.4" />}
      {ma60d && <path d={ma60d} fill="none" stroke="#fb923c" strokeWidth="1.4" />}

      {/* ── Volume section divider ────────────────────────────────────── */}
      <line
        x1={PAD_L}
        y1={VOL_TOP - 1}
        x2={W - PAD_R}
        y2={VOL_TOP - 1}
        stroke="rgba(148,163,184,0.1)"
        strokeWidth="1"
      />

      {/* ── Volume bars ───────────────────────────────────────────────── */}
      {data.map((row, i) => {
        if (row.volume == null) return null;
        const cx = xFn(i);
        const isUp = (row.last ?? 0) >= (row.open ?? 0);
        const color = isUp ? "#26a69a" : "#ef5350";
        const vy = yVolFn(row.volume);
        return (
          <rect
            key={`v-${i}`}
            x={(cx - cw / 2).toFixed(1)}
            y={vy.toFixed(1)}
            width={cw.toFixed(1)}
            height={(VOL_BOT - vy).toFixed(1)}
            fill={color}
            opacity="0.65"
          />
        );
      })}

      {/* ── Volume Y-axis labels ──────────────────────────────────────── */}
      {volTicks.map((t) => (
        <text
          key={`vt-${t}`}
          x={PAD_L - 8}
          y={(yVolFn(t) + 4).toFixed(1)}
          fill="rgba(148,163,184,0.58)"
          fontSize="10"
          textAnchor="end"
        >
          {fmtVolLabel(t)}
        </text>
      ))}

      {/* ── X-axis date labels ────────────────────────────────────────── */}
      {xLabels.map(({ i, date }) => (
        <text
          key={`xl-${i}`}
          x={xFn(i).toFixed(1)}
          y={VOL_BOT + 16}
          fill="rgba(148,163,184,0.65)"
          fontSize="10"
          textAnchor="middle"
        >
          {fmtDate(date)}
        </text>
      ))}

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <g>
        {LEGEND_ITEMS.map(({ label, color, type }, idx) => {
          const lx = LEG_CX + (LEG_OFFSETS[idx] ?? 0);
          return (
            <g key={label}>
              {type === "rect" ? (
                <rect x={lx} y={LEG_Y - 9} width={14} height={11} fill={color} rx="2" />
              ) : (
                <g>
                  <line
                    x1={lx}
                    y1={LEG_Y - 3}
                    x2={lx + 14}
                    y2={LEG_Y - 3}
                    stroke={color}
                    strokeWidth="2"
                  />
                  <circle cx={lx + 7} cy={LEG_Y - 3} r="2.5" fill={color} />
                </g>
              )}
              <text
                x={lx + 18}
                y={LEG_Y + 2}
                fill="rgba(226,232,240,0.82)"
                fontSize="12"
              >
                {label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
