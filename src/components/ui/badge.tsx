import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-brand-blue-50 text-brand-blue",
        yellow: "bg-brand-yellow-50 text-brand-yellow-dark",
        outline: "border border-border text-muted",
        open: "bg-[color-mix(in_srgb,var(--color-status-open)_14%,white)] text-status-open",
        progress:
          "bg-[color-mix(in_srgb,var(--color-status-progress)_20%,white)] text-brand-blue-dark",
        pending:
          "bg-[color-mix(in_srgb,var(--color-status-pending)_16%,white)] text-status-pending",
        resolved:
          "bg-[color-mix(in_srgb,var(--color-status-resolved)_14%,white)] text-status-resolved",
        closed: "bg-slate-100 text-slate-600",
        cancelled:
          "bg-[color-mix(in_srgb,var(--color-status-cancelled)_12%,white)] text-status-cancelled",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
