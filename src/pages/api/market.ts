import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type NextApiRequest, type NextApiResponse } from "next";
import type { HotBoardRow, HotEtfRow, HotStockRow, IpoRow, MarketPulseData, SuspensionRow } from "~/types";

const execFileAsync = promisify(execFile);

function coerce(value: string): string | number | null {
  const t = value.trim();
  if (t === "" || t === "-" || t === "--") return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : t;
}

function parseMdTable(stdout: string): Record<string, unknown>[] {
  const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  const hi = lines.findIndex((l, i) => l.startsWith("|") && lines[i + 1]?.match(/^\|\s*-+/));
  if (hi === -1) return [];
  const headers = lines[hi]!.split("|").map((c) => c.trim()).filter(Boolean);
  const rows: Record<string, unknown>[] = [];
  for (const line of lines.slice(hi + 2)) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1);
    if (cells.length < headers.length) continue;
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => { row[h] = coerce(cells[i] ?? ""); });
    rows.push(row);
  }
  return rows;
}

async function westock(...args: string[]): Promise<Record<string, unknown>[]> {
  try {
    const { stdout } = await execFileAsync("npx", ["-y", "westock-data-clawhub@1.0.4", ...args], {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 5,
    });
    try {
      const parsed = JSON.parse(stdout) as unknown;
      if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    } catch { /* not json */ }
    return parseMdTable(stdout);
  } catch {
    return [];
  }
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return null;
}
function toStr(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s === "" || s === "null" || s === "-" ? null : s;
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse<MarketPulseData>) {
  const [stockRows, boardRows, etfRows, ipoRows, suspRows] = await Promise.all([
    westock("hot", "stock"),
    westock("hot", "board", "--limit", "10"),
    westock("hot", "etf"),
    westock("ipo", "hs"),
    westock("suspension", "hs"),
  ]);

  const hotStocks: HotStockRow[] = stockRows.slice(0, 20).map((r) => ({
    code: toStr(r.code) ?? "",
    name: toStr(r.name) ?? "",
    zdf: toNum(r.zdf),
    zxj: toNum(r.zxj),
    status: toStr(r.status),
    stock_type: toStr(r.stock_type),
  }));

  const hotBoards: HotBoardRow[] = boardRows.map((r) => ({
    rank: toNum(r.rank),
    rankdelta: toNum(r.rankdelta),
    name: toStr(r.name) ?? "",
    zdf: toNum(r.zdf),
    zxj: toNum(r.zxj),
    stock_type: toStr(r.stock_type),
  }));

  const hotEtf: HotEtfRow[] = etfRows.slice(0, 15).map((r) => ({
    rank: toNum(r.rank),
    code: toStr(r.code) ?? "",
    name: toStr(r.name) ?? "",
    zdf: toNum(r.zdf),
    zxj: toNum(r.zxj),
    tag: toStr(r.tag),
    title: toStr(r.title),
  }));

  const ipo: IpoRow[] = ipoRows.map((r) => ({
    stage: toStr(r.stage) ?? "",
    code: toStr(r.code) ?? "",
    name: toStr(r.name) ?? "",
    price: toNum(r.price),
    sgrq: toStr(r.sgrq),
    ssrq: toStr(r.ssrq),
  }));

  const suspension: SuspensionRow[] = suspRows.map((r) => ({
    code: toStr(r.code) ?? "",
    name: toStr(r.name) ?? "",
    statusDesc: toStr(r.statusDesc),
    suspendDate: toStr(r.suspendDate),
    resumeDate: toStr(r.resumeDate),
    reason: toStr(r.reason),
  }));

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  return res.status(200).json({
    hotStocks,
    hotBoards,
    hotEtf,
    ipo,
    suspension,
    fetchedAt: new Date().toISOString(),
  });
}
