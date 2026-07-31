import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Pencil,
  Users,
  User,
  Vote,
  BarChart3,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import Nominees from "@/pages/Nominees";
import Voters from "@/pages/Voters";
import Analytics from "@/pages/Analytics";
import { ElectionResultActions } from "@/components/elections/ElectionResultActions";
import { ElectionHomePanel } from "@/components/elections/ElectionHomePanel";
import { VotingStatusPanel } from "@/components/elections/VotingStatusPanel";
import { AdminVotingDetailsPanel } from "@/components/elections/AdminVotingDetailsPanel";
import { ManualWinnerPicker } from "@/components/elections/ManualWinnerPicker";
import { getElectionLabel, isElectionLocked } from "@/lib/electionHelpers";

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    completed: "bg-blue-100 text-blue-800",
    draft: "bg-gray-100 text-gray-800",
    archived: "bg-yellow-100 text-yellow-800",
  };
  return (
    <Badge variant="outline" className={map[status || ""] || "bg-gray-100 text-gray-800"}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown"}
    </Badge>
  );
}

function getTabFromSearch() {
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (tab === "home" || tab === "voters" || tab === "results" || tab === "admin" || tab === "nominees" || tab === "status") {
    return tab;
  }
  return "home";
}

export default function ElectionWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const [tab, setTab] = useState(getTabFromSearch);

  // Election details
  const { data: electionResp, isLoading: electionLoading } = useQuery({
    queryKey: [`/api/elections/${id}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/elections/${id}`);
      return res.json();
    },
    enabled: !!id,
  });
  const election = electionResp?.data || electionResp || null;

  // Nominee count
  const { data: nomineesResp } = useQuery({
    queryKey: [`/api/nominees/election/${id}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/nominees/election/${id}`);
      return res.json();
    },
    enabled: !!id,
  });
  const nomineeCount = Array.isArray(nomineesResp?.data) ? nomineesResp.data.length : 0;

  // Voter count (scoped to this election)
  const { data: votersResp } = useQuery({
    queryKey: [`/api/users/voters`, id, "count"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/voters?electionId=${id}&page=1&pageSize=1`);
      return res.json();
    },
    enabled: !!id,
  });
  const voterCount = votersResp?.pagination?.total ?? (Array.isArray(votersResp?.data) ? votersResp.data.length : 0);

  // Results (turnout / ballots)
  const { data: resultsResp } = useQuery({
    queryKey: ["/api/vote/results", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vote/results/${id}`);
      return res.json();
    },
    enabled: !!id,
  });
  const results = resultsResp?.data || null;
  const turnout = results?.turnout ?? null;

  useEffect(() => {
    document.title = election ? `${getElectionLabel(election)} | Vote+` : "Election | Vote+";
  }, [election]);

  useEffect(() => {
    const nextTab = getTabFromSearch();
    setTab(nextTab);
  }, [location]);

  const handleTabChange = (value: string) => {
    setTab(value);
    if (id) {
      navigate(`/elections/${id}?tab=${value}`);
    }
  };

  const electionLocked = isElectionLocked(election?.status);

  return (
    <MainLayout>
      {/* Back link */}
      <div className="mb-4">
        <Link href="/elections">
          <Button variant="ghost" size="sm" className="text-gray-600 hover:text-primary -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            All Elections
          </Button>
        </Link>
      </div>

      {/* Election header */}
      {electionLoading ? (
        <Skeleton className="h-28 w-full mb-6 rounded-lg" />
      ) : !election ? (
        <Card className="mb-6">
          <CardContent className="py-10 text-center text-gray-500">
            Election not found.
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-start gap-4 min-w-0">
              {election.logo?.url && (
                <img
                  src={election.logo.url}
                  alt={election.logo?.alt || getElectionLabel(election)}
                  className="h-14 w-14 rounded-lg object-cover border border-gray-200 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 flex-wrap">
                    <h1 className="app-page-title truncate">{getElectionLabel(election)}</h1>
                    <StatusBadge status={election.status} />
                  </div>
                  {!electionLocked && (
                    <Link href={`/elections/${id}/edit`} className="shrink-0">
                      <Button variant="outline" size="sm">
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </Link>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {election.electionDate && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {format(new Date(election.electionDate), "PPP")}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {nomineeCount} nominees
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {voterCount} voters
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {turnout != null ? `${turnout}% turnout` : "— turnout"}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-5 flex h-auto w-full justify-start gap-1 overflow-x-auto sm:mb-6">
          <TabsTrigger value="home" className="shrink-0 gap-1.5">
            <CalendarDays className="h-4 w-4" /> Home
          </TabsTrigger>
          <TabsTrigger value="nominees" className="shrink-0 gap-1.5">
            <Users className="h-4 w-4" /> Nominees
          </TabsTrigger>
          <TabsTrigger value="voters" className="shrink-0 gap-1.5">
            <User className="h-4 w-4" /> Voters
          </TabsTrigger>
          {!electionLocked && election?.status === "active" && (
            <TabsTrigger value="status" className="shrink-0 gap-1.5">
              <BarChart3 className="h-4 w-4" /> Live Status
            </TabsTrigger>
          )}
          <TabsTrigger value="results" className="shrink-0 gap-1.5">
            <Vote className="h-4 w-4" /> Results &amp; Analytics
          </TabsTrigger>
        </TabsList>

        {/* Home — election identity, franchise, dates, and creation-time settings */}
        <TabsContent value="home" className="mt-0">
          {id && election && (
            <ElectionHomePanel electionId={id} election={election} editable={!electionLocked} />
          )}
        </TabsContent>

        {/* Nominees */}
        <TabsContent value="nominees" className="mt-0">
          {id && <Nominees key={id} embedded electionId={id} readOnly={electionLocked} />}
        </TabsContent>

        {/* Voters */}
        <TabsContent value="voters" className="mt-0">
          {id && <Voters embedded electionId={id} readOnly={electionLocked} />}
        </TabsContent>

        {/* Live Status — while voting is actively open */}
        <TabsContent value="status" className="mt-0">
          {id && <VotingStatusPanel electionId={id} />}
        </TabsContent>

        {/* Results & Analytics — always visible; publish/print actions are completed-only */}
        <TabsContent value="results" className="mt-0">
          {id && !electionLocked && (
            <Alert className="mb-5">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Election still in progress</AlertTitle>
              <AlertDescription>
                Results below are live and provisional — they will keep changing until the election
                is completed. Publishing to voters is available once it's done.
              </AlertDescription>
            </Alert>
          )}
          {id && electionLocked && (
            <ElectionResultActions
              electionId={id}
              electionTitle={election ? getElectionLabel(election) : undefined}
              organization={election?.organization}
              electionDate={election?.electionDate}
              resultsPublished={!!election?.resultsPublished}
              resultsPublishedAt={election?.resultsPublishedAt}
              results={results}
              numberToBeElected={election?.numberToBeElected || 1}
              genderBasedSelection={!!election?.genderBasedSelection}
            />
          )}
          {id && !electionLocked && election?.manualWinnerSelection && (
            <ManualWinnerPicker
              electionId={id}
              enabled={!!election.manualWinnerSelection}
              numberToBeElected={election?.numberToBeElected || 1}
              nominees={results?.nominees || []}
              manualWinnerIds={election?.manualWinnerIds || results?.election?.manualWinnerIds || []}
            />
          )}
          {id && election?.adminVotingDetailsEnabled && (
            <AdminVotingDetailsPanel electionId={id} enabled={!!election.adminVotingDetailsEnabled} />
          )}
          {id && <Analytics embedded electionId={id} />}
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
