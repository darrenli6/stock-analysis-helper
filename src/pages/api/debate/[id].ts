import { type NextApiRequest, type NextApiResponse } from "next";
import { getDebateSnapshot, toggleDebate } from "~/server/stock/debate";
import type { AnalysisResult } from "~/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const debateId = typeof req.query.id === "string" ? req.query.id : "";
  if (!debateId) return res.status(400).json({ error: "缺少 debateId" });

  // GET：轮询快照
  if (req.method === "GET") {
    const afterRaw = typeof req.query.afterMessageId === "string" ? req.query.afterMessageId : "";
    const afterMessageId = afterRaw ? Number(afterRaw) : undefined;

    const snapshot = await getDebateSnapshot(
      debateId,
      Number.isFinite(afterMessageId) ? afterMessageId : undefined,
    );
    if (!snapshot) return res.status(404).json({ error: "辩论不存在" });
    return res.status(200).json(snapshot);
  }

  // POST：暂停/继续
  if (req.method === "POST") {
    const { result } = req.body as { result?: AnalysisResult };
    if (!result?.stock?.name) return res.status(400).json({ error: "缺少分析结果数据" });
    const newStatus = await toggleDebate(debateId, result);
    if (!newStatus) return res.status(404).json({ error: "辩论不存在" });
    return res.status(200).json({ status: newStatus });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
