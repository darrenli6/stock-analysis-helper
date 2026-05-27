import { type NextApiRequest, type NextApiResponse } from "next";
import { createAnalysisTask } from "~/server/stock/workflow";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userInput =
    typeof req.body?.userInput === "string" ? req.body.userInput.trim() : "";

  if (!userInput) {
    return res.status(400).json({ error: "请输入股票分析需求" });
  }

  try {
    console.log("[api/analyze] request", { userInput });
    console.log("[api/analyze] before createAnalysisTask");
    const task = await createAnalysisTask(userInput);
    console.log("[api/analyze] task created", { taskId: task.id, status: task.status });
    return res.status(200).json({ taskId: task.id, status: task.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建任务失败";
    console.error("[api/analyze] error", { message });
    return res.status(500).json({ error: message });
  }
}
