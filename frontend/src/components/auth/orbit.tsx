"use client";

import { BarChart3, CalendarDays, CheckSquare, Flame, Sparkles, Target, Wallet } from "lucide-react";

import { LogoMark } from "@/components/brand/logo";

const RINGS = [
  { size: 220, dur: "32s", items: [CheckSquare, CalendarDays] },
  { size: 340, dur: "46s", items: [Wallet, Target, Flame] },
  { size: 460, dur: "64s", items: [BarChart3, Sparkles] },
];

/** Modules orbiting the NEXUS core — pure CSS animation, no JS per frame. */
export function ModuleOrbit() {
  return (
    <div className="relative mx-auto grid size-[480px] place-items-center" aria-hidden>
      <div className="absolute size-40 rounded-full bg-accent/30 blur-3xl" />
      {RINGS.map((ring, ri) => (
        <div
          key={ri}
          className="orbit absolute rounded-full border border-line-strong/70"
          style={{ width: ring.size, height: ring.size, ["--dur" as string]: ring.dur, animationDirection: ri % 2 ? "reverse" : "normal" }}
        >
          {ring.items.map((Icon, i) => {
            const angle = (360 / ring.items.length) * i + ri * 30;
            return (
              <div
                key={i}
                className="absolute top-1/2 left-1/2"
                style={{ transform: `rotate(${angle}deg) translateX(${ring.size / 2}px) rotate(-${angle}deg)` }}
              >
                <div
                  className="counter-orbit -mt-5 -ml-5 grid size-10 place-items-center rounded-xl border border-line-strong bg-surface/90 text-accent-2 shadow-[0_0_24px_-6px_var(--accent)] backdrop-blur"
                  style={{ ["--dur" as string]: ring.dur, animationDirection: ri % 2 ? "reverse" : "normal" }}
                >
                  <Icon className="size-[18px]" />
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div className="pulse-ring relative rounded-[22px]">
        <LogoMark className="size-16 rounded-[18px] [&_svg]:size-[55%]" />
      </div>
    </div>
  );
}
