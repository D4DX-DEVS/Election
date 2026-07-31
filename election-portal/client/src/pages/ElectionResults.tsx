import { useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { getElectionLabel } from "@/lib/electionHelpers";
import { ElectionResultsSummary } from "@/components/elections/ElectionResultsSummary";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  draft: "bg-gray-100 text-gray-800",
  archived: "bg-yellow-100 text-yellow-800",
};

export default function ElectionResults() {
  const { id } = useParams<{ id: string }>();

  const { data: electionResp, isLoading } = useQuery({
    queryKey: [`/api/elections/${id}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/elections/${id}`);
      return res.json();
    },
    enabled: !!id,
  });
  const election = electionResp?.data || electionResp || null;

  useEffect(() => {
    document.title = election ? `${getElectionLabel(election)} Results | Vote+` : "Results | Vote+";
  }, [election]);

  return (
    <MainLayout>
      <div className="mb-4">
        <Link href="/elections">
          <Button variant="ghost" size="sm" className="text-gray-600 hover:text-primary -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            All Elections
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full mb-6 rounded-lg" />
      ) : !election ? (
        <Card className="mb-6">
          <CardContent className="py-10 text-center text-gray-500">
            Election not found.
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="app-page-title">{getElectionLabel(election)}</h1>
              <Badge variant="outline" className={STATUS_STYLES[election.status] || "bg-gray-100 text-gray-800"}>
                {election.status ? election.status.charAt(0).toUpperCase() + election.status.slice(1) : "Unknown"}
              </Badge>
            </div>
            {election.electionDate && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {format(new Date(election.electionDate), "PPP")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {id && <ElectionResultsSummary electionId={id} />}
    </MainLayout>
  );
}
