import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageContent, PageHeader } from "@/components/layout/PageContent";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, User as UserIcon, Globe, ChevronLeft, ChevronRight } from "lucide-react";
import { CompactList, CompactListPrimary, CompactListRow, CompactListSecondary } from "@/components/ui/compact-list";
import { apiRequest } from "@/lib/queryClient";

const PAGE_SIZE = 10;

interface AuditLog {
  _id: string;
  action?: string;
  entityType?: string;
  ipAddress?: string;
  timestamp?: string;
  createdAt?: string;
  details?: { entity?: string } | null;
  userId?: { username?: string; fullName?: string; email?: string } | null;
}

interface AuditLogResponse {
  success: boolean;
  count: number;
  pagination: { total: number; page: number; limit: number; totalPages: number };
  data: AuditLog[];
}

function actionColor(action?: string) {
  const a = (action || "").toLowerCase();
  if (a.includes("creat")) return "bg-green-100 text-green-800";
  if (a.includes("delet")) return "bg-red-100 text-red-800";
  if (a.includes("updat") || a.includes("edit")) return "bg-amber-100 text-amber-800";
  if (a.includes("login") || a.includes("logout")) return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-800";
}

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AuditLogs() {
  const [page, setPage] = useState(1);

  useEffect(() => {
    document.title = "Audit Logs | Vote+";
  }, []);

  const { data, isLoading, error } = useQuery<AuditLogResponse>({
    queryKey: ["/api/audit-logs", page],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/audit-logs?page=${page}&limit=${PAGE_SIZE}`);
      return res.json();
    },
    placeholderData: (prev) => prev,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Server returns newest-first and already paginated
  const logs = data?.data ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const total = pagination?.total ?? 0;
  const currentPage = pagination?.page ?? page;

  return (
    <MainLayout>
      <PageContent>
      <PageHeader
        title="Audit Logs"
        description="A record of important actions performed across the system."
      />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load audit logs</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No audit logs recorded yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <CompactList>
            {logs.map((log) => (
              <CompactListRow key={log._id}>
                <CompactListPrimary>
                  {log.entityType || "—"}
                  {log.details?.entity ? `: ${log.details.entity}` : ""}
                </CompactListPrimary>
                <CompactListSecondary>
                  {[
                    log.userId?.fullName || log.userId?.username || "System",
                    formatDate(log.createdAt || log.timestamp),
                    log.ipAddress,
                  ].filter(Boolean).join(" · ")}
                </CompactListSecondary>
                <Badge className={`${actionColor(log.action)} shrink-0`}>{log.action || "Action"}</Badge>
              </CompactListRow>
            ))}
          </CompactList>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
                {total > 0 ? ` · ${total} total` : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      </PageContent>
    </MainLayout>
  );
}
