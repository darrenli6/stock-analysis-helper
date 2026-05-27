import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "auto";

// ─── Icons ────────────────────────────────────────────────────────────────────
function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

// ─── Theme helpers ────────────────────────────────────────────────────────────
function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "auto") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = prefersDark ? "dark" : "light";
  } else {
    root.dataset.theme = theme;
  }
}

const OPTIONS: { value: Theme; label: string; Icon: () => React.JSX.Element }[] = [
  { value: "light", label: "浅色", Icon: SunIcon },
  { value: "dark",  label: "深色", Icon: MoonIcon },
  { value: "auto",  label: "跟随系统", Icon: MonitorIcon },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme) ?? "dark";
    setTheme(stored);
    applyTheme(stored);
    setMounted(true);

    // Sync "auto" when system preference changes
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if ((localStorage.getItem("theme") as Theme) === "auto") applyTheme("auto");
    };
    mql.addEventListener("change", onSystemChange);
    return () => mql.removeEventListener("change", onSystemChange);
  }, []);

  function select(t: Theme) {
    setTheme(t);
    localStorage.setItem("theme", t);
    applyTheme(t);
  }

  // Avoid hydration mismatch — render nothing until mounted
  if (!mounted) return null;

  return (
    <div
      className="fixed right-5 top-5 z-50 flex items-center gap-0.5 rounded-full border border-white/12 bg-slate-900/80 p-1 shadow-xl shadow-black/30 backdrop-blur-md"
      role="group"
      aria-label="切换主题"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          title={label}
          aria-label={label}
          aria-pressed={theme === value}
          onClick={() => select(value)}
          className={[
            "flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200",
            theme === value
              ? "bg-cyan-400/20 text-cyan-300 shadow-inner"
              : "text-slate-400 hover:bg-white/8 hover:text-slate-200",
          ].join(" ")}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
