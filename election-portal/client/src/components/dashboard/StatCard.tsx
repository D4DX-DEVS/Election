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
  /** Tighter stacked mobile layout for grids that must keep 3 cards in one row (e.g. the dashboard). */
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
  compact = false,
}: StatCardProps) {
  return (
    <Card className={cn("group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover hover:border-primary/20", className)}>
      {/* Decorative gradient blob, subtle on hover */}
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-primary opacity-[0.06] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.12]"
        aria-hidden
      />

      {/* Mobile, compact: icon/value/title stacked so 3 cards fit one row without crowding. */}
      {compact ? (
        <CardContent className="relative p-2.5 md:hidden">
          <div className={cn("inline-flex shrink-0 rounded-lg p-1.5", iconBgColor)}>
            <div className={cn("h-3.5 w-3.5", iconColor)}>{icon}</div>
          </div>
          <p className="mt-1.5 truncate text-lg font-bold leading-none text-slate-900">{value}</p>
          <p className="mt-1 line-clamp-2 text-[10.5px] font-medium leading-tight text-slate-500">{title}</p>
        </CardContent>
      ) : (
        <CardContent className="relative p-4 md:hidden">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-2xl font-bold leading-none text-slate-900">{value}</p>
            <div className={cn("shrink-0 rounded-xl p-2", iconBgColor)}>
              <div className={cn("h-4 w-4", iconColor)}>{icon}</div>
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-xs font-medium leading-snug text-slate-500">{title}</p>
          {trend && (
            <p
              className={cn(
                "mt-0.5 truncate text-[11px] font-semibold",
                trend.direction === "up"
                  ? "text-emerald-600"
                  : trend.direction === "down"
                    ? "text-red-500"
                    : "text-slate-400"
              )}
            >
              {trend.value}
            </p>
          )}
        </CardContent>
      )}

      {/* Desktop layout */}
      <CardContent className="relative hidden p-6 md:block">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          </div>
          <div className={cn("shrink-0 rounded-2xl p-3 shadow-sm transition-transform duration-300 group-hover:scale-105", iconBgColor)}>
            <div className={cn("h-5 w-5", iconColor)}>{icon}</div>
          </div>
        </div>

        {trend && (
          <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3">
            {trend.direction === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
            {trend.direction === "down" && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
            <span
              className={cn(
                "truncate text-xs font-medium",
                trend.direction === "up"
                  ? "text-emerald-600"
                  : trend.direction === "down"
                    ? "text-red-500"
                    : "text-slate-400"
              )}
            >
              {trend.value}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
