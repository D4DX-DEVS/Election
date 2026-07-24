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
}

export function StatCard({
  title,
  value,
  icon,
  iconBgColor = "bg-primary-100",
  iconColor = "text-primary",
  trend,
}: StatCardProps) {
  return (
    <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30">
      {/* Mobile: number + icon on one row, label below */}
      <CardContent className="p-3 md:hidden">
        <div className="flex items-start justify-between gap-2">
          <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
          <div className={cn("shrink-0 rounded-lg p-1.5", iconBgColor)}>
            <div className={cn("h-4 w-4", iconColor)}>{icon}</div>
          </div>
        </div>
        <p className="text-[11px] font-medium text-gray-500 leading-tight line-clamp-2 mt-2">{title}</p>
        {trend && (
          <p
            className={cn(
              "text-[10px] mt-0.5 font-medium",
              trend.direction === "up"
                ? "text-green-500"
                : trend.direction === "down"
                  ? "text-red-500"
                  : "text-gray-400"
            )}
          >
            {trend.value}
          </p>
        )}
      </CardContent>

      {/* Desktop: horizontal layout */}
      <CardContent className="hidden md:block p-6">
        <div className="flex items-center gap-4">
          <div className={cn("flex-shrink-0 rounded-lg p-3", iconBgColor)}>
            <div className={cn("h-5 w-5", iconColor)}>{icon}</div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              {trend && (
                <>
                  {trend.direction === "up" && <TrendingUp className="h-4 w-4 text-green-500" />}
                  {trend.direction === "down" && <TrendingDown className="h-4 w-4 text-red-500" />}
                  <span
                    className={cn(
                      "text-sm truncate",
                      trend.direction === "up"
                        ? "text-green-500"
                        : trend.direction === "down"
                          ? "text-red-500"
                          : "text-gray-500"
                    )}
                  >
                    {trend.value}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
