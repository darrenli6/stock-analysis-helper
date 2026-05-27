import { type NextApiRequest, type NextApiResponse } from "next";
import { getTaskSnapshot } from "~/server/stock/workflow";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const taskId = typeof req.query.id === "string" ? req.query.id : "";
  const afterLogIdRaw = typeof req.query.afterLogId === "string" ? req.query.afterLogId : "";
  const afterLogId = afterLogIdRaw ? Number(afterLogIdRaw) : undefined;

  if (!taskId) {
    return res.status(400).json({ error: "缺少任务 ID" });
  }

  try {
    const snapshot = await getTaskSnapshot(
      taskId,
      Number.isFinite(afterLogId) ? afterLogId : undefined
    );

    if (!snapshot) {
      console.warn("[api/tasks] task not found", { taskId });
      return res.status(404).json({ error: "任务不存在" });
    }

    console.log("[api/tasks] snapshot", {
      taskId,
      afterLogId: afterLogId ?? null,
      status: snapshot.task.status,
      logCount: snapshot.logs.length,
      hasResult: Boolean(snapshot.result),
    });

    return res.status(200).json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询任务失败";
    console.error("[api/tasks] error", { taskId, message });
    return res.status(500).json({ error: message });
  }
}
