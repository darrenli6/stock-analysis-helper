export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-white/8 px-4 pb-10 pt-8 xl:px-6 2xl:px-8">
      <div className="mx-auto max-w-[1720px]">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          {/* Left — disclaimer */}
          <div className="max-w-2xl space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              免责声明
            </p>
            <p className="text-xs leading-6 text-slate-500">
              本平台所提供的所有股票分析结果、技术指标解读、宏观环境判断及买卖建议，
              均由算法模型自动生成，<strong className="text-slate-400">仅供参考，不构成任何形式的投资建议或买卖邀约</strong>。
              投资者应结合自身风险偏好、财务状况及市场研判，独立做出投资决策。
              本平台不对任何因参考本平台分析内容而产生的投资损失承担任何法律责任。
            </p>
            <p className="text-xs leading-6 text-slate-500">
              本平台不提供个股荐股、配资、理财等服务。如有机构或个人利用本平台名义从事上述活动，均与本平台无关。
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/6 px-3 py-2 text-xs text-amber-300/90">
              <span className="shrink-0">⚠</span>
              <span>
                <strong>投资有风险，入市需谨慎。</strong>历史数据及回测结果不代表未来实际收益，
                市场存在不确定性，请充分评估风险后再做决策。
              </span>
            </div>
          </div>

          {/* Right — data source & copyright */}
          <div className="shrink-0 space-y-2 text-right text-xs text-slate-500 md:min-w-[200px]">
            <p className="font-medium text-slate-400">数据来源</p>
            <p>行情数据取自互联网公开数据源</p>
            <p>技术指标由本地算法模型计算生成</p>
            <p>宏观分析采用静态规则，不代表实时市场观点</p>
            <div className="mt-4 border-t border-white/8 pt-4">
              <p className="text-slate-600">分析结果仅供参考，不构成投资建议</p>
              <p className="mt-1 text-slate-600">© {year} Stock Analysis Helper</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
