"use client";

interface ThemeToggleProps {
  variant?: "default" | "header";
  className?: string;
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function ThemeToggle({
  variant = "default",
  className = "",
}: ThemeToggleProps) {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ppd-theme", next);
    } catch {
      // localStorage unavailable — fine, theme still applies for the session.
    }
  }

  const styles =
    variant === "header"
      ? "border-white/15 bg-white/5 text-header-muted hover:border-white/30 hover:bg-white/10 hover:text-header-text"
      : "border-border bg-surface text-muted hover:border-border-strong hover:text-text";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle colour theme"
      className={`theme-toggle flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${styles} ${className}`}
    >
      <span className="theme-toggle-moon">
        <MoonIcon />
      </span>
      <span className="theme-toggle-sun">
        <SunIcon />
      </span>
    </button>
  );
}

export default ThemeToggle;
