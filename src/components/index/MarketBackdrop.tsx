import type { CSSProperties } from "react";

export function MarketBackdrop() {
  const columns = Array.from({ length: 18 }, (_, index) => {
    const height = 72 + (index % 6) * 18;
    const bodyHeight = 24 + (index % 5) * 10;
    const offset = 30 + (index * 41) % 180;
    const isUp = index % 3 !== 1;

    return {
      index,
      height,
      bodyHeight,
      offset,
      isUp,
      delay: `${index * 0.28}s`,
      duration: `${7 + (index % 4)}s`,
      x: 36 + index * 48,
      width: 18 + (index % 3) * 2,
    };
  });

  const trendPath =
    "M20 210 C120 170 160 190 240 146 S390 82 470 118 S628 212 760 134";

  return (
    <div className="market-backdrop" aria-hidden="true">
      <div className="market-backdrop__grid" />
      <div className="market-backdrop__glow market-backdrop__glow--left" />
      <div className="market-backdrop__glow market-backdrop__glow--right" />

      <svg
        viewBox="0 0 920 320"
        className="market-backdrop__scene market-backdrop__scene--far"
        preserveAspectRatio="xMidYMid slice"
      >
        {columns.map((column) => {
          const bodyY = column.offset + (column.height - column.bodyHeight) / 2;
          return (
            <g
              key={`far-${column.index}`}
              className="market-candle market-candle--far"
              style={
                {
                  "--float-delay": column.delay,
                  "--float-duration": column.duration,
                } as CSSProperties
              }
            >
              <line
                x1={column.x + column.width / 2}
                y1={column.offset}
                x2={column.x + column.width / 2}
                y2={column.offset + column.height}
                className={column.isUp ? "market-wick market-wick--up" : "market-wick market-wick--down"}
              />
              <rect
                x={column.x}
                y={bodyY}
                width={column.width}
                height={column.bodyHeight}
                rx="4"
                className={column.isUp ? "market-body market-body--up" : "market-body market-body--down"}
              />
            </g>
          );
        })}
      </svg>

      <svg
        viewBox="0 0 920 320"
        className="market-backdrop__scene market-backdrop__scene--near"
        preserveAspectRatio="xMidYMid slice"
      >
        <path d={trendPath} className="market-trend market-trend--glow" />
        <path d={trendPath} className="market-trend market-trend--core" />
        {columns.map((column) => {
          const scale = 1.15;
          const x = column.x + 8;
          const height = column.height * scale;
          const bodyHeight = column.bodyHeight * scale;
          const offset = column.offset - 20;
          const bodyY = offset + (height - bodyHeight) / 2;

          return (
            <g
              key={`near-${column.index}`}
              className="market-candle market-candle--near"
              style={
                {
                  "--float-delay": `${column.index * 0.19}s`,
                  "--float-duration": `${6 + (column.index % 5)}s`,
                } as CSSProperties
              }
            >
              <line
                x1={x + column.width / 2}
                y1={offset}
                x2={x + column.width / 2}
                y2={offset + height}
                className={column.isUp ? "market-wick market-wick--up" : "market-wick market-wick--down"}
              />
              <rect
                x={x}
                y={bodyY}
                width={column.width}
                height={bodyHeight}
                rx="4"
                className={column.isUp ? "market-body market-body--up" : "market-body market-body--down"}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
