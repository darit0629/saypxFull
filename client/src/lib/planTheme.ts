import { Rocket, Sprout, Camera, Star, Gem, Briefcase, Crown, Package, type LucideIcon } from 'lucide-react';

// Cosmetic-only plan presentation (icon + color) - a curated set so the
// admin picks from a small list rather than typing anything, and so
// Tailwind's build-time class scanner can see every class name as a literal
// (never string-interpolated from a variable) and include it in the build.
export const PLAN_ICON_OPTIONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'rocket', label: 'Rocket', Icon: Rocket },
  { key: 'sprout', label: 'Sprout', Icon: Sprout },
  { key: 'camera', label: 'Camera', Icon: Camera },
  { key: 'star', label: 'Star', Icon: Star },
  { key: 'gem', label: 'Gem', Icon: Gem },
  { key: 'briefcase', label: 'Briefcase', Icon: Briefcase },
  { key: 'crown', label: 'Crown', Icon: Crown },
  { key: 'package', label: 'Package', Icon: Package },
];

export function getPlanIcon(key: string | null): LucideIcon {
  return PLAN_ICON_OPTIONS.find((o) => o.key === key)?.Icon || Package;
}

interface PlanColorClasses {
  bg: string;
  text: string;
  border: string;
  check: string;
  buttonOutline: string;
}

const COLOR_MAP: Record<string, PlanColorClasses> = {
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/40', check: 'text-purple-400', buttonOutline: 'border-purple-500/50 text-purple-300 hover:bg-purple-500/10' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/40', check: 'text-blue-400', buttonOutline: 'border-blue-500/50 text-blue-300 hover:bg-blue-500/10' },
  green: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/40', check: 'text-emerald-400', buttonOutline: 'border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/40', check: 'text-amber-400', buttonOutline: 'border-amber-500/50 text-amber-300 hover:bg-amber-500/10' },
  orange: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/40', check: 'text-orange-400', buttonOutline: 'border-orange-500/50 text-orange-300 hover:bg-orange-500/10' },
  pink: { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/40', check: 'text-pink-400', buttonOutline: 'border-pink-500/50 text-pink-300 hover:bg-pink-500/10' },
  violet: { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/40', check: 'text-violet-400', buttonOutline: 'border-violet-500/50 text-violet-300 hover:bg-violet-500/10' },
};

export const PLAN_COLOR_OPTIONS = Object.keys(COLOR_MAP);

export function getPlanColor(key: string | null): PlanColorClasses {
  return COLOR_MAP[key || ''] || COLOR_MAP.orange;
}
