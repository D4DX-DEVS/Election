import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  className?: string;
  /** kept for API compatibility — no longer changes layout */
  compact?: boolean;
}

export function StatCard({
  title,
  value,
  icon,
  iconBgColor = "bg-primary/10",
  iconColor = "text-primary",
  trend,
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-150 hover:border-primary/20 hover:shadow-md",
        className
      )}
    >
      <CardContent className="p-3.5 sm:p-4">
        {/* Icon + value row */}
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              iconBgColor
            )}
            aria-hidden
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center [&>svg]:block [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
                iconColor
              )}
            >
              {icon}
            </span>
          </div>
          <p className="app-metric tabular-nums">{value}</p>
        </div>

        {/* Label */}
        <p className="app-stat-label mt-2.5 leading-snug">{title}</p>

        {/* Optional trend */}
        {trend && (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-[11px] font-medium",
              trend.direction === "up"
                ? "text-emerald-600"
                : trend.direction === "down"
                  ? "text-red-500"
                  : "text-gray-400"
            )}
          >
            {trend.direction === "up" && (
              <TrendingUp className="h-3 w-3 shrink-0" />
            )}
            {trend.direction === "down" && (
              <TrendingDown className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate">{trend.value}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
