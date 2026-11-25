/** Tiny dependency-free confetti burst. Respects prefers-reduced-motion. */
const COLORS = ["#7c5cff", "#a78bfa", "#338ced", "#00a888", "#d28e05", "#e24d8b", "#eb6263"];

export function celebrate(origin?: { x: number; y: number }, count = 90) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "100" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const ox = origin?.x ?? innerWidth / 2;
  const oy = origin?.y ?? innerHeight / 3;
  const parts = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = 4 + Math.random() * 7;
    return {
      x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5,
      w: 5 + Math.random() * 5, h: 3 + Math.random() * 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      c: COLORS[Math.floor(Math.random() * COLORS.length)]!, life: 0,
    };
  });
  const start = performance.now();
  const tick = (t: number) => {
    const el = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.22; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - el / 1700);
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (el < 1800) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}

/** Remember where the user last clicked so bursts start under their cursor. */
let lastClick: { x: number; y: number } | undefined;
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", (e) => (lastClick = { x: e.clientX, y: e.clientY }), { passive: true, capture: true });
}
export const celebrateAtCursor = (count?: number) => celebrate(lastClick, count);
