type Props = { data: unknown };

export function DebugJson({ data }: Props) {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <section className="panel rounded-[28px] border border-white/10 p-5">
      <h3 className="text-base font-semibold text-white">调试结果 JSON</h3>
      <pre className="mt-4 overflow-x-auto rounded-[20px] bg-slate-950/70 p-4 text-xs leading-6 text-slate-300">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}
