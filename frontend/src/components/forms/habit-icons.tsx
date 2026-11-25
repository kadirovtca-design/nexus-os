import {
  Apple, Bike, BookOpen, Brain, Coffee, Droplets, Dumbbell, Footprints, Heart, Leaf, Moon, Music, PenLine, Sparkles,
  Sun, Code2, type LucideIcon,
} from "lucide-react";

export const HABIT_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles, footprints: Footprints, "book-open": BookOpen, brain: Brain, apple: Apple, "pen-line": PenLine,
  dumbbell: Dumbbell, droplets: Droplets, moon: Moon, sun: Sun, bike: Bike, heart: Heart, leaf: Leaf, music: Music,
  coffee: Coffee, code: Code2,
};

export function HabitIcon({ name, className }: { name: string; className?: string }) {
  const Icon = HABIT_ICONS[name] ?? Sparkles;
  return <Icon className={className} />;
}
