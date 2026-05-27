import nodemailer from "nodemailer";
import { type NextApiRequest, type NextApiResponse } from "next";
import { env } from "~/env";
import type { AnalysisResult } from "~/types";

function actionLabel(action: "buy" | "watch" | "avoid") {
  if (action === "buy") return { text: "可考虑买入", color: "#10b981" };
  if (action === "watch") return { text: "建议观察", color: "#f59e0b" };
  return { text: "建议回避", color: "#ef4444" };
}

function fmt(v: number | null, digits = 2) {
  return v !== null ? v.toFixed(digits) : "—";
}

function buildHtml(result: AnalysisResult): string {
  const { stock, company, technical, backtest, macro, recommendation } = result;
  const action = actionLabel(recommendation.action);
  const genAt = new Date(result.overview.generatedAt).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });

  const buyRows = technical.buyConditions
    .map(
      (c) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${c.passed ? "✅" : "⬜"} ${c.name}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">${c.reason}</td>
        </tr>`
    )
    .join("");

  const warnRows = technical.warnings
    .filter((w) => w.triggered)
    .map(
      (w) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #fee2e2;">⚠️ ${w.name}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #fee2e2;color:#6b7280;font-size:12px;">${w.reason}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8" /><title>${stock.name} 股票分析报告</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="max-width:680px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 32px 24px;">
      <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;">达轮股票分析助手</p>
      <h1 style="margin:0 0 4px;font-size:26px;color:#fff;font-weight:700;">
        ${stock.name}
        <span style="font-size:14px;color:#64748b;font-weight:400;margin-left:8px;">${stock.code.toUpperCase()}</span>
      </h1>
      ${company.industry ? `<p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">${company.industry}</p>` : ""}
      <p style="margin:12px 0 0;font-size:12px;color:#475569;">生成时间：${genAt}</p>
    </div>

    <!-- Recommendation banner -->
    <div style="background:${action.color}18;border-left:4px solid ${action.color};margin:24px 24px 0;padding:16px 20px;border-radius:0 12px 12px 0;">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <div>
          <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">综合建议</p>
          <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:${action.color};">${action.text}</p>
        </div>
        <div style="border-left:1px solid #e5e7eb;padding-left:16px;">
          <p style="margin:0;font-size:11px;color:#6b7280;">置信度</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1e293b;">${recommendation.confidence}%</p>
        </div>
        <div style="border-left:1px solid #e5e7eb;padding-left:16px;">
          <p style="margin:0;font-size:11px;color:#6b7280;">技术评分</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1e293b;">${technical.score} / 100</p>
        </div>
      </div>
    </div>

    <!-- Price & TP/SL -->
    <div style="display:flex;gap:0;margin:20px 24px 0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="flex:1;padding:14px 18px;border-right:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;">最新价</p>
        <p style="margin:6px 0 0;font-size:20px;font-weight:600;color:#1e293b;">
          ${fmt(technical.price)} <span style="font-size:13px;color:#9ca3af;">${technical.currency}</span>
        </p>
      </div>
      <div style="flex:1;padding:14px 18px;border-right:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;">止盈参考</p>
        <p style="margin:6px 0 0;font-size:20px;font-weight:600;color:#10b981;">${fmt(recommendation.takeProfit)}</p>
      </div>
      <div style="flex:1;padding:14px 18px;">
        <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;">止损参考</p>
        <p style="margin:6px 0 0;font-size:20px;font-weight:600;color:#ef4444;">${fmt(recommendation.stopLoss)}</p>
      </div>
    </div>

    <!-- Technical summary -->
    <div style="margin:20px 24px 0;">
      <h2 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;padding-bottom:8px;">📊 技术面分析</h2>
      <p style="margin:0 0 10px;font-size:13px;color:#4b5563;">${technical.summary}</p>
      <p style="margin:0 0 10px;font-size:13px;color:#4b5563;">
        评级：<strong style="color:#1e293b;">${technical.rating}</strong> ·
        信号：<strong style="color:#1e293b;">${technical.signal}</strong> ·
        买入条件满足 <strong style="color:#10b981;">${technical.buySatisfied}</strong>/7 ·
        高位预警触发 <strong style="color:#ef4444;">${technical.warningCount}</strong>/6
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
        ${buyRows}
      </table>
      ${warnRows ? `<p style="margin:10px 0 6px;font-size:13px;font-weight:500;color:#b45309;">触发的高位预警：</p><table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">${warnRows}</table>` : ""}
    </div>

    <!-- Backtest -->
    <div style="margin:20px 24px 0;">
      <h2 style="margin:0 0 10px;font-size:14px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;padding-bottom:8px;">📈 历史回测</h2>
      <p style="margin:0;font-size:13px;color:#4b5563;">${backtest.summary}</p>
      <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap;">
        <span style="font-size:12px;color:#6b7280;">区间：${backtest.window}</span>
        <span style="font-size:12px;color:#6b7280;">趋势：${backtest.trend}</span>
        <span style="font-size:12px;color:#6b7280;">最高：${fmt(backtest.maxClose)}</span>
        <span style="font-size:12px;color:#6b7280;">最低：${fmt(backtest.minClose)}</span>
        <span style="font-size:12px;color:${(backtest.returnPct ?? 0) >= 0 ? "#10b981" : "#ef4444"};">
          收益：${backtest.returnPct !== null ? (backtest.returnPct >= 0 ? "+" : "") + fmt(backtest.returnPct) + "%" : "—"}
        </span>
      </div>
    </div>

    <!-- Macro -->
    <div style="margin:20px 24px 0;">
      <h2 style="margin:0 0 10px;font-size:14px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;padding-bottom:8px;">🌐 宏观环境</h2>
      <div style="background:#f9fafb;border-radius:8px;padding:14px 16px;">
        <p style="margin:0 0 6px;font-size:12px;"><strong>行业景气：</strong>${macro.industryCycle}</p>
        <p style="margin:0 0 6px;font-size:12px;"><strong>公司治理：</strong>${macro.governance}</p>
        <p style="margin:0;font-size:12px;"><strong>宏观经济：</strong>${macro.macroEconomy}</p>
      </div>
    </div>

    <!-- Rationale -->
    <div style="margin:20px 24px 0;">
      <h2 style="margin:0 0 10px;font-size:14px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;padding-bottom:8px;">💡 决策依据</h2>
      <ul style="margin:0;padding-left:18px;">
        ${recommendation.rationale.map((r) => `<li style="font-size:13px;color:#4b5563;margin-bottom:4px;">${r}</li>`).join("")}
      </ul>
    </div>

    <!-- Footer -->
    <div style="margin:24px 0 0;padding:20px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">本报告由 <strong>达轮股票分析助手</strong> 自动生成，仅供参考，不构成投资建议。</p>
      <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;">投资有风险，入市需谨慎</p>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { toEmail, result } = req.body as { toEmail?: string; result?: AnalysisResult };

  if (!toEmail || typeof toEmail !== "string" || !toEmail.includes("@")) {
    return res.status(400).json({ error: "请输入有效的邮箱地址" });
  }
  if (!result?.stock?.name) {
    return res.status(400).json({ error: "缺少分析结果数据" });
  }
  if (!env.FROM_EMAIL || !env.SHOUQUAN_163_EMAIL) {
    return res.status(503).json({ error: "服务端邮件配置未完成，请联系管理员" });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.163.com",
    port: 465,
    secure: true,
    auth: {
      user: env.FROM_EMAIL,
      pass: env.SHOUQUAN_163_EMAIL,
    },
  });

  const action = result.recommendation.action === "buy"
    ? "可考虑买入"
    : result.recommendation.action === "watch"
    ? "建议观察"
    : "建议回避";

  try {
    await transporter.sendMail({
      from: `"达轮股票分析助手" <${env.FROM_EMAIL}>`,
      to: toEmail,
      subject: `【${result.stock.name}】分析报告 · ${action} · 评分 ${result.technical.score}/100`,
      html: buildHtml(result),
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "发送失败";
    console.error("[send-email] error", message);
    return res.status(500).json({ error: message });
  }
}
