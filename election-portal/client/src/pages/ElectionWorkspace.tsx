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
  Trophy,
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
  const s = status ?? "";
  const variant =
    s === "active" || s === "completed" || s === "draft" || s === "archived"
      ? (s as "active" | "completed" | "draft" | "archived")
      : "outline";
  return (
    <Badge variant={variant}>
      {s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown"}
    </Badge>
  );
}

function getTabFromSearch() {
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (tab === "home" || tab === "voters" || tab === "results" || tab === "admin" || tab === "nominees" || tab === "status" || tab === "generate") {
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

  // Results (turnout / ballots) — poll while voting is open so tallies shown
  // here (and to the embedded Analytics/ManualWinnerPicker/turnout stat) stay
  // live as other voters cast or admins edit votes, without a manual refresh.
  const { data: resultsResp } = useQuery({
    queryKey: ["/api/vote/results", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vote/results/${id}`);
      return res.json();
    },
    enabled: !!id,
    refetchInterval: election?.votingOpen ? 15000 : false,
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
      <div className="mb-3">
        <Link href="/elections">
          <Button variant="ghost" size="sm" className="text-gray-600 hover:text-primary -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            All Elections
          </Button>
        </Link>
      </div>

      {/* Election header */}
      {electionLoading ? (
        <Skeleton className="h-28 w-full mb-4 rounded-lg" />
      ) : !election ? (
        <Card className="mb-4">
          <CardContent className="py-10 text-center text-gray-500">
            Election not found.
          </CardContent>
        </Card>
      ) : (
        <div className="mb-4 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {/* Header row */}
          <div className="flex items-start gap-3 px-4 pt-4 pb-3">
            {election.logo?.url && (
              <img
                src={election.logo.url}
                alt={election.logo?.alt || getElectionLabel(election)}
                className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border border-gray-100 object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h1 className="min-w-0 truncate text-base font-semibold leading-snug text-gray-900">
                  {getElectionLabel(election)}
                </h1>
                <StatusBadge status={election.status} />
              </div>
              {election.electionDate && (
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {format(new Date(election.electionDate), "PPP")}
                </p>
              )}
            </div>
            {!electionLocked && (
              <Link href={`/elections/${id}/edit`} className="shrink-0">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </Link>
            )}
          </div>

          {/* Stat grid */}
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <span className="app-stat-label">Nominees</span>
                <span className="app-stat-value">{nomineeCount}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="app-stat-label">Voters</span>
                <span className="app-stat-value">{voterCount}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="app-stat-label">Turnout</span>
                <span className="app-stat-value">
                  {turnout != null ? `${turnout}%` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs — ONE shared pill container; active tab gets white bg from base TabsTrigger */}
      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        {/* overflow wrapper allows horizontal scroll on mobile with hidden scrollbar */}
        <div className="mb-3 overflow-x-auto scrollbar-hidden">
          <TabsList className="flex h-auto min-w-full gap-0.5 rounded-xl bg-slate-100 p-1">
            <TabsTrigger
              value="home"
              className="flex-1 min-w-[52px] flex-col gap-0.5 whitespace-normal px-1.5 py-2 text-[11px] leading-tight font-medium"
            >
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span className="text-center">Home</span>
            </TabsTrigger>

            <TabsTrigger
              value="nominees"
              className="flex-1 min-w-[52px] flex-col gap-0.5 whitespace-normal px-1.5 py-2 text-[11px] leading-tight font-medium"
            >
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span className="text-center">Nominees</span>
            </TabsTrigger>

            <TabsTrigger
              value="voters"
              className="flex-1 min-w-[52px] flex-col gap-0.5 whitespace-normal px-1.5 py-2 text-[11px] leading-tight font-medium"
            >
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="text-center">Voters</span>
            </TabsTrigger>

            {!electionLocked && election?.status === "active" && (
              <TabsTrigger
                value="status"
                className="flex-1 min-w-[52px] flex-col gap-0.5 whitespace-normal px-1.5 py-2 text-[11px] leading-tight font-medium"
              >
                <BarChart3 className="h-3.5 w-3.5 shrink-0" />
                <span className="text-center">Status</span>
              </TabsTrigger>
            )}

            {election?.manualWinnerSelection && (
              <TabsTrigger
                value="generate"
                className="flex-1 min-w-[52px] flex-col gap-0.5 whitespace-normal px-1.5 py-2 text-[11px] leading-tight font-medium"
              >
                <Trophy className="h-3.5 w-3.5 shrink-0" />
                <span className="text-center">Generate</span>
              </TabsTrigger>
            )}

            <TabsTrigger
              value="results"
              className="flex-1 min-w-[52px] flex-col gap-0.5 whitespace-normal px-1.5 py-2 text-[11px] leading-tight font-medium"
            >
              <Vote className="h-3.5 w-3.5 shrink-0" />
              <span className="text-center">Results</span>
            </TabsTrigger>
          </TabsList>
        </div>

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

        {/* Generate Result — manual-winner elections pick their winners here */}
        {election?.manualWinnerSelection && (
          <TabsContent value="generate" className="mt-0">
            {id && (
              <ManualWinnerPicker
                electionId={id}
                enabled={!!election.manualWinnerSelection}
                numberToBeElected={election?.numberToBeElected || 1}
                nominees={results?.nominees || []}
                manualWinnerIds={election?.manualWinnerIds || results?.election?.manualWinnerIds || []}
                electionStatus={election?.status}
              />
            )}
          </TabsContent>
        )}

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
          {id && election?.adminVotingDetailsEnabled && (
            <AdminVotingDetailsPanel
              electionId={id}
              enabled={!!election.adminVotingDetailsEnabled}
              votingOpen={!!election?.votingOpen}
              numberToBeElected={election?.numberToBeElected || 1}
              ballotSelectionRule={election?.ballotSelectionRule === "up_to" ? "up_to" : "exact"}
              genderBasedSelection={!!election?.genderBasedSelection}
              maleMinimum={election?.maleMinimum || 0}
              femaleMinimum={election?.femaleMinimum || 0}
            />
          )}
          {id && <Analytics electionId={id} />}
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
