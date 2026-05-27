import { type NextApiRequest, type NextApiResponse } from "next";
import { createDebate } from "~/server/stock/debate";
import type { AnalysisResult } from "~/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { taskId, result } = req.body as { taskId?: string; result?: AnalysisResult };

  if (!taskId || typeof taskId !== "string") {
    return res.status(400).json({ error: "缺少 taskId" });
  }
  if (!result?.stock?.name) {
    return res.status(400).json({ error: "缺少分析结果数据" });
  }

  try {
    const debate = await createDebate(taskId, result);
    return res.status(200).json({ debateId: debate.id, status: debate.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建辩论失败";
    console.error("[api/debate] create error", message);
    return res.status(500).json({ error: message });
  }
}
