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

function StatIcon({
  icon,
  iconBgColor,
  iconColor,
}: {
  icon: ReactNode;
  iconBgColor: string;
  iconColor: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full leading-none",
        iconBgColor
      )}
      aria-hidden
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center leading-none [&>svg]:block [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
          iconColor
        )}
      >
        {icon}
      </span>
    </div>
  );
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
  const iconNode = (
    <StatIcon icon={icon} iconBgColor={iconBgColor} iconColor={iconColor} />
  );

  return (
    <Card
      className={cn(
        "overflow-hidden transition-shadow duration-200 hover:shadow-card-hover hover:border-primary/20",
        className
      )}
    >
      {compact ? (
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="app-metric-compact">{value}</p>
            {iconNode}
          </div>
          <p className="app-helper mt-1 line-clamp-2 font-medium leading-tight">
            {title}
          </p>
        </CardContent>
      ) : (
        <CardContent className="relative p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            {iconNode}
            <p className="app-metric">
              {value}
            </p>
          </div>
          <p className="app-helper mt-2 line-clamp-2 font-medium leading-snug">{title}</p>
          {trend && (
            <p
              className={cn(
                "app-helper mt-1.5 flex items-center gap-1 truncate font-medium",
                trend.direction === "up"
                  ? "text-emerald-600"
                  : trend.direction === "down"
                    ? "text-red-500"
                    : "text-slate-400"
              )}
            >
              {trend.direction === "up" && <TrendingUp className="h-3 w-3 shrink-0" />}
              {trend.direction === "down" && <TrendingDown className="h-3 w-3 shrink-0" />}
              <span className="truncate">{trend.value}</span>
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
