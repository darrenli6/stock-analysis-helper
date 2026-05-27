import type { KlineRow } from "~/types";

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

export function formatLargeNumber(value: number | null): string {
  if (value === null) return "-";
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("zh-CN", { hour12: false });
}

export function summarizePayload(payload: unknown): string {
  if (!payload) return "";
  try {
    const text = JSON.stringify(payload);
    return text.length > 180 ? `${text.slice(0, 180)}...` : text;
  } catch {
    return String(payload);
  }
}

export function getNestedValue(
  source: Record<string, unknown> | undefined,
  path: string
): unknown {
  if (!source) return undefined;
  return path.split(".").reduce<unknown>((cur, key) => {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    return (cur as Record<string, unknown>)[key];
  }, source);
}

export function toNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeKlineRows(source: unknown): KlineRow[] {
  if (!Array.isArray(source)) return [];
  return (source as Record<string, unknown>[])
    .map((row) => ({
      date: String(row.date ?? ""),
      open: toNumeric(row.open),
      last: toNumeric(row.last ?? row.close ?? row.closePrice ?? row.price),
      high: toNumeric(row.high),
      low: toNumeric(row.low),
      volume: toNumeric(row.volume),
      amount: toNumeric(row.amount),
      exchange: toNumeric(row.exchange),
    }))
    .filter((row) => row.date);
}
