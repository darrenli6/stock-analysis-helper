import type { AnalysisResult } from "~/types";

interface CompanyProfileProps {
  result: AnalysisResult;
}

export function CompanyProfile({ result }: CompanyProfileProps) {
  const { company } = result;

  return (
    <section className="panel rounded-[28px] border border-white/10 p-5">
      <h3 className="text-base font-semibold text-white">公司简介</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2 text-sm text-slate-300">
          <p>公司名称：{company.name || "-"}</p>
          <p>所属行业：{company.industry || "-"}</p>
          <p>董事长：{company.chairman || "-"}</p>
          <p>上市日期：{company.listedDate || "-"}</p>
        </div>
        <div className="space-y-2 text-sm text-slate-300">
          <p>官网：{company.website || "-"}</p>
          <p>注册地：{company.regAddress || "-"}</p>
          <p>电话：{company.tel || "-"}</p>
          <p>邮箱：{company.email || "-"}</p>
        </div>
      </div>
      <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">公司介绍</p>
          <p className="mt-2 whitespace-pre-line">{company.introduction || "暂无公司介绍。"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">主营业务</p>
          <p className="mt-2 whitespace-pre-line">{company.business || "暂无主营业务描述。"}</p>
        </div>
      </div>
    </section>
  );
}
