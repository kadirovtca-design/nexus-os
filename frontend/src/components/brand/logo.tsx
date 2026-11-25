import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative grid size-8 place-items-center overflow-hidden rounded-[10px] bg-gradient-to-br from-accent to-accent-2 shadow-[0_0_0_1px_rgba(255,255,255,0.15)_inset,0_6px_20px_-6px_var(--accent)]",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[58%] text-white" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 19V5l14 14V5" />
      </svg>
    </div>
  );
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed ? (
        <div className="leading-none">
          <span className="text-[15px] font-semibold tracking-tight text-fg">NEXUS</span>
          <span className="ml-1 text-[15px] font-light tracking-tight text-fg-subtle">OS</span>
        </div>
      ) : null}
    </div>
  );
}
