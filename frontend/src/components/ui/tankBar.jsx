import { cn } from "@/lib/utils";

const colorMap = {
  high: "bg-emerald-500",
  medium: "bg-amber-400",
  low: "bg-red-500",
};

function getLevelColor(percent) {
  if (percent >= 60) return colorMap.high;
  if (percent >= 30) return colorMap.medium;
  return colorMap.low;
}

export function TankBar({ level = 0, capacity = 0, className }) {
  const percent = capacity > 0 ? Math.min(100, Math.max(0, (level / capacity) * 100)) : 0;
  const color = getLevelColor(percent);

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative w-8 h-24 rounded-md border-2 border-slate-300 dark:border-slate-600 overflow-hidden bg-slate-100 dark:bg-slate-800">
        <div
          className={cn("absolute bottom-0 left-0 right-0 transition-all duration-500 rounded-b-sm", color)}
          style={{ height: `${percent}%` }}
        />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
        {Math.round(percent)}%
      </span>
      <span className="text-[10px] text-slate-400 dark:text-slate-500">
        {Math.round(level)}/{capacity}L
      </span>
    </div>
  );
}
