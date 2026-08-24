import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageContent, PageHeader } from "@/components/layout/PageContent";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Cpu, Database, HardDrive, Server } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SystemHealthData {
  timestamp: string;
  uptimeSeconds: number;
  memory: { usedMB: number; totalMB: number; percentUsed: number };
  cpu: { cores: number; loadAvg1: number; loadAvg5: number; loadAvg15: number; loadPercent: number };
  database: { connected: boolean; latencyMs: number; message?: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const days  = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins  = Math.floor((seconds % 3600) / 60);
  if (days > 0)  return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

type StatusLevel = "ok" | "warn" | "critical";

function getMemoryStatus(pct: number): StatusLevel {
  if (pct >= 90) return "critical";
  if (pct >= 70) return "warn";
  return "ok";
}

function getCpuStatus(pct: number): StatusLevel {
  if (pct >= 80) return "critical";
  if (pct >= 60) return "warn";
  return "ok";
}

const STATUS = {
  ok:       { dot: "bg-green-500", bar: "bg-green-500",  icon: "bg-green-50 text-green-700"  },
  warn:     { dot: "bg-amber-500", bar: "bg-amber-500",  icon: "bg-amber-50 text-amber-700"  },
  critical: { dot: "bg-red-500",   bar: "bg-red-500",    icon: "bg-red-50   text-red-700"    },
} as const;

// ── Status card ───────────────────────────────────────────────────────────────

function HealthCard({
  icon,
  label,
  statusText,
  statusLevel,
  subtitle,
  bar,
}: {
  icon: ReactNode;
  label: string;
  statusText: string;
  statusLevel: StatusLevel;
  subtitle?: string;
  bar?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="p-3.5 sm:p-4">
        {/* Icon + label */}
        <div className="mb-3 flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              STATUS[statusLevel].icon,
            )}
          >
            {icon}
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {label}
          </span>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block h-2 w-2 shrink-0 rounded-full",
              STATUS[statusLevel].dot,
            )}
          />
          <span className="text-sm font-semibold text-gray-800">{statusText}</span>
        </div>

        {/* Optional mini progress bar */}
        {bar !== undefined && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                STATUS[statusLevel].bar,
              )}
              style={{ width: `${Math.min(bar, 100)}%` }}
            />
          </div>
        )}

        {/* Subtitle */}
        {subtitle && (
          <p className="mt-1.5 text-[11px] text-gray-400">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SystemHealth() {
  useEffect(() => {
    document.title = "System Health | Vote+";
  }, []);

  const { data, isLoading, isError, error } = useQuery<{ data?: SystemHealthData }>({
    queryKey: ["/api/system/health"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/system/health");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const health = data?.data;

  const memStatus: StatusLevel = health ? getMemoryStatus(health.memory.percentUsed) : "ok";
  const cpuStatus: StatusLevel = health ? getCpuStatus(health.cpu.loadPercent)       : "ok";
  const dbStatus:  StatusLevel = health ? (health.database.connected ? "ok" : "critical") : "ok";

  return (
    <MainLayout>
      <PageContent>
        <PageHeader
          title="System Health"
          description="Live resource usage and service status"
        />

        {isError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Could not load system health</AlertTitle>
            <AlertDescription>
              {(error as Error)?.message || "Please try again."}
            </AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* Live data — 2 × 2 grid */}
        {health && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {/* Server */}
              <HealthCard
                icon={<Server className="h-3.5 w-3.5" />}
                label="Server"
                statusText="Running"
                statusLevel="ok"
                subtitle={`Uptime: ${formatUptime(health.uptimeSeconds)}`}
              />

              {/* Database */}
              <HealthCard
                icon={<Database className="h-3.5 w-3.5" />}
                label="Database"
                statusText={health.database.connected ? "Connected" : "Disconnected"}
                statusLevel={dbStatus}
                subtitle={
                  health.database.connected
                    ? `${health.database.latencyMs}ms`
                    : (health.database.message ?? "No connection")
                }
              />

              {/* Memory */}
              <HealthCard
                icon={<HardDrive className="h-3.5 w-3.5" />}
                label="Memory"
                statusText={`${health.memory.percentUsed}% Used`}
                statusLevel={memStatus}
                bar={health.memory.percentUsed}
              />

              {/* CPU */}
              <HealthCard
                icon={<Cpu className="h-3.5 w-3.5" />}
                label="CPU"
                statusText={`${health.cpu.loadPercent}% Load`}
                statusLevel={cpuStatus}
                bar={Math.min(health.cpu.loadPercent, 100)}
              />
            </div>

            {/* Last checked timestamp */}
            <p className="mt-3 text-[11px] text-gray-400">
              Last checked · {new Date(health.timestamp).toLocaleTimeString()}
            </p>
          </>
        )}
      </PageContent>
    </MainLayout>
  );
}
