import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageContent, PageHeader } from "@/components/layout/PageContent";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Cpu, Database, MemoryStick, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SystemHealthData {
  timestamp: string;
  uptimeSeconds: number;
  memory: { usedMB: number; totalMB: number; percentUsed: number };
  cpu: { cores: number; loadAvg1: number; loadAvg5: number; loadAvg15: number; loadPercent: number };
  database: { connected: boolean; latencyMs: number; message?: string };
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

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

  return (
    <MainLayout>
      <PageContent>
        <PageHeader title="System Health" description="Live resource usage and service status" />

        {isError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Could not load system health</AlertTitle>
            <AlertDescription>{(error as Error)?.message || "Please try again."}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Skeleton className="h-24 w-full md:h-28" />
            <Skeleton className="h-24 w-full md:h-28" />
            <Skeleton className="h-24 w-full md:h-28" />
            <Skeleton className="h-24 w-full md:h-28" />
          </div>
        ) : health ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                title="Server uptime"
                value={formatUptime(health.uptimeSeconds)}
                icon={<Clock className="h-5 w-5" />}
              />
              <StatCard
                title="Memory used"
                value={`${health.memory.percentUsed}%`}
                icon={<MemoryStick className="h-5 w-5" />}
                iconBgColor="bg-indigo-100"
                iconColor="text-indigo-600"
                trend={{ value: `${health.memory.usedMB} / ${health.memory.totalMB} MB`, direction: "neutral" }}
              />
              <StatCard
                title="CPU load"
                value={`${health.cpu.loadPercent}%`}
                icon={<Cpu className="h-5 w-5" />}
                iconBgColor="bg-amber-100"
                iconColor="text-amber-600"
                trend={{ value: `${health.cpu.cores} core(s)`, direction: "neutral" }}
              />
              <StatCard
                title="Database"
                value={health.database.connected ? "Connected" : "Down"}
                icon={<Database className="h-5 w-5" />}
                iconBgColor={health.database.connected ? "bg-green-100" : "bg-red-100"}
                iconColor={health.database.connected ? "text-green-600" : "text-red-600"}
                trend={{ value: `${health.database.latencyMs}ms`, direction: "neutral" }}
              />
            </div>

            <Card>
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-gray-700">Memory usage</p>
                    <p className="text-xs text-gray-500">
                      {health.memory.usedMB} MB / {health.memory.totalMB} MB
                    </p>
                  </div>
                  <Progress value={health.memory.percentUsed} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-gray-700">CPU load (1 min avg)</p>
                    <p className="text-xs text-gray-500">
                      {health.cpu.loadAvg1} / {health.cpu.cores} cores
                    </p>
                  </div>
                  <Progress value={Math.min(health.cpu.loadPercent, 100)} className="h-2" />
                  <p className="text-[11px] text-gray-400 mt-1">
                    5 min: {health.cpu.loadAvg5} · 15 min: {health.cpu.loadAvg15}
                  </p>
                </div>
                {!health.database.connected && health.database.message && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Database connection issue</AlertTitle>
                    <AlertDescription>{health.database.message}</AlertDescription>
                  </Alert>
                )}
                <p className="text-[11px] text-gray-400">
                  Last checked {new Date(health.timestamp).toLocaleTimeString()}
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </PageContent>
    </MainLayout>
  );
}
