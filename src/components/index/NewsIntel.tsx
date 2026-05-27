import type { NewsData } from "~/types";

interface NewsIntelProps {
  data: NewsData;
}

const CATEGORY_ICON: Record<string, string> = {
  公司动态: "📰",
  行业分析: "🏭",
  竞品信息: "⚔️",
  财报业绩: "📊",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function ScoreDot({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "bg-emerald-400" : pct >= 60 ? "bg-cyan-400" : "bg-slate-500";
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${color} mr-1`}
      title={`相关度 ${pct}%`}
    />
  );
}

export function NewsIntel({ data }: NewsIntelProps) {
  const nonEmpty = data.categories.filter((c) => c.items.length > 0);
  if (nonEmpty.length === 0) return null;

  return (
    <div className="space-y-5">
      {nonEmpty.map((cat) => (
        <div key={cat.category}>
          {/* Category header */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">{CATEGORY_ICON[cat.category] ?? "🔍"}</span>
            <h4 className="text-sm font-semibold text-white">{cat.category}</h4>
            <span className="ml-auto text-[10px] text-slate-500">{cat.items.length} 条</span>
          </div>

          {/* AI answer */}
          {cat.answer && (
            <div className="mb-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/8 px-4 py-3 text-sm leading-7 text-cyan-100">
              {cat.answer}
            </div>
          )}

          {/* News items */}
          <div className="space-y-2">
            {cat.items.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-white/8 bg-white/4 px-4 py-3 transition hover:border-cyan-400/30 hover:bg-white/8"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-6 text-slate-100 line-clamp-2">
                    <ScoreDot score={item.score} />
                    {item.title}
                  </p>
                  {item.publishedDate && (
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {formatDate(item.publishedDate)}
                    </span>
                  )}
                </div>
                {item.content && (
                  <p className="mt-1 text-xs leading-6 text-slate-400 line-clamp-2">
                    {item.content}
                  </p>
                )}
              </a>
            ))}
          </div>
        </div>
      ))}

      <p className="text-right text-[10px] text-slate-600">
        数据来源 Tavily · {new Date(data.fetchedAt).toLocaleTimeString("zh-CN", { hour12: false })}
      </p>
    </div>
  );
}
