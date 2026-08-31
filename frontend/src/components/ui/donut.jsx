import * as React from "react";

const Donut = ({ segments, size = 200, thickness = 28, centerLabel, centerValue }) => {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-slate-200 dark:stroke-white/5"
        />
        {segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              className="transition-all duration-500"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-slate-900 dark:text-white">
          {centerValue}
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {centerLabel}
        </span>
      </div>
    </div>
  );
};

export { Donut };