import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, BarChart3, ExternalLink } from "lucide-react";
import { PageContent, PageHeader } from "@/components/layout/PageContent";
import { getElectionLabel } from "@/lib/electionHelpers";
import { apiRequest } from "@/lib/queryClient";
import { DashboardStats, ElectionWithDetails } from "@/lib/types";

function getElectionId(election: ElectionWithDetails) {
  return election._id?.toString() || election.id?.toString() || "";
}

function statusBadgeClass(status?: string) {
  switch ((status || "").toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-800 border-green-200";
    case "completed":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "draft":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "archived":
      return "bg-gray-100 text-gray-700 border-gray-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function formatStatus(status?: string) {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function Reports() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    document.title = "Reports | Vote+";
  }, []);

  const {
    data: electionsResponse,
    isLoading: electionsLoading,
    error: electionsError,
  } = useQuery<{ success?: boolean; data?: ElectionWithDetails[] }>({
    queryKey: ["/api/elections", "reports"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/elections");
      return res.json();
    },
  });

  const {
    data: dashboardStats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery<DashboardStats>({
    queryKey: ["/api/analytics/dashboard", "reports"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/analytics/dashboard");
      const body = await res.json();
      if (!body.success || !body.data) {
        throw new Error(body.message || "Failed to load dashboard stats");
      }
      return body.data as DashboardStats;
    },
  });

  const elections = Array.isArray(electionsResponse?.data) ? electionsResponse.data : [];

  const counts = useMemo(() => {
    const total = elections.length;
    const active = elections.filter((e) => e.status === "active").length;
    const completed = elections.filter((e) => e.status === "completed").length;
    const draft = elections.filter((e) => e.status === "draft").length;
    const archived = elections.filter((e) => e.status === "archived").length;
    return { total, active, completed, draft, archived };
  }, [elections]);

  const filteredElections = useMemo(() => {
    if (statusFilter === "all") return elections;
    return elections.filter((e) => e.status === statusFilter);
  }, [elections, statusFilter]);

  const isLoading = electionsLoading || statsLoading;
  const loadError = electionsError || statsError;

  return (
    <MainLayout>
      <PageContent>
      <PageHeader
        title="Reports"
        description="Summary of all elections — active, completed, and overall participation."
      />

      {loadError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load reports</AlertTitle>
          <AlertDescription>{(loadError as Error).message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total Elections", value: counts.total, className: "text-primary" },
          { label: "Active", value: counts.active, className: "text-green-600" },
          { label: "Completed", value: counts.completed, className: "text-blue-600" },
          { label: "Draft", value: counts.draft, className: "text-amber-600" },
          { label: "Votes Cast", value: dashboardStats?.votesCast ?? "—", className: "text-gray-900" },
        ].map(({ label, value, className }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${className}`}>
                {isLoading ? "—" : value}
              </p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && dashboardStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Registered voters (franchise)</p>
                <p className="text-xl font-bold text-gray-900">{dashboardStats.totalVoters}</p>
              </div>
              <Badge variant="outline" className="bg-white">
                {dashboardStats.activeElections} active now
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Overall turnout</p>
              <p className="text-xl font-bold text-gray-900">
                {dashboardStats.totalVoters > 0
                  ? `${Math.round((dashboardStats.votesCast / dashboardStats.totalVoters) * 100)}%`
                  : "—"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {dashboardStats.votesCast} ballots of {dashboardStats.totalVoters} voters
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b">
          <CardTitle className="text-lg">Election Reports</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredElections.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              {elections.length === 0
                ? "No elections found yet."
                : "No elections match this filter."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-white">Election</TableHead>
                    <TableHead className="bg-white">Date</TableHead>
                    <TableHead className="bg-white">Status</TableHead>
                    <TableHead className="bg-white text-right">Nominees</TableHead>
                    <TableHead className="bg-white text-right">Voters</TableHead>
                    <TableHead className="bg-white">Voting</TableHead>
                    <TableHead className="bg-white text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredElections.map((election) => {
                    const id = getElectionId(election);
                    return (
                      <TableRow key={id}>
                        <TableCell>
                          <div className="min-w-[160px]">
                            <p className="font-medium text-gray-900">{getElectionLabel(election)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                          {election.electionDate
                            ? format(new Date(election.electionDate), "yyyy-MM-dd")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadgeClass(election.status)}>
                            {formatStatus(election.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {election.nomineeCount ?? 0}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {election.voterCount ?? 0}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span className={election.votingOpen ? "text-green-600" : "text-gray-500"}>
                              {election.votingOpen ? "Open" : "Closed"}
                            </span>
                            {election.resultsPublished && (
                              <span className="text-blue-600">Results published</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Link href={`/elections/${id}`}>
                              <Button variant="outline" size="sm" className="gap-1 h-8">
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open
                              </Button>
                            </Link>
                            <Link href={`/elections/${id}?tab=results`}>
                              <Button variant="outline" size="sm" className="gap-1 h-8">
                                <BarChart3 className="h-3.5 w-3.5" />
                                Analytics
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </PageContent>
    </MainLayout>
  );
}
