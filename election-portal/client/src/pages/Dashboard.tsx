import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentElectionsTable } from "@/components/dashboard/RecentElectionsTable";
import { FranchiseOverview } from "@/components/dashboard/FranchiseOverview";
import { Vote, Users, AlertCircle, Building2, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardStats, ElectionWithDetails } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { PageContent, PageHeader } from "@/components/layout/PageContent";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";

const EMPTY_STATS: DashboardStats = {
  activeElections: 0,
  totalVoters: 0,
  votesCast: 0,
  totalFranchises: 0,
  totalElections: 0,
  franchiseDistribution: [],
  recentActivity: [],
};

export default function Dashboard() {
  const [user, setUser] = useState<{ fullName?: string; username?: string; role?: string } | null>(null);

  useEffect(() => {
    const userJson = localStorage.getItem("user");
    if (userJson) {
      try {
        setUser(JSON.parse(userJson));
      } catch (error) {
        console.error("Error parsing user data", error);
      }
    }
  }, []);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsFetchError,
  } = useQuery<DashboardStats>({
    queryKey: ["/api/analytics/dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/analytics/dashboard");
      const body = await res.json();
      if (!body.success || !body.data) {
        throw new Error(body.message || "Failed to load dashboard stats");
      }
      return body.data as DashboardStats;
    },
  });

  const {
    data: electionsResponse,
    isLoading: electionsLoading,
    isError: electionsError,
    error: electionsFetchError,
  } = useQuery<{ data?: ElectionWithDetails[]; success?: boolean }>({
    queryKey: ["/api/elections"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/elections");
      return res.json();
    },
  });

  const recentElections: ElectionWithDetails[] = Array.isArray(electionsResponse?.data)
    ? [...electionsResponse.data]
        .sort((a, b) => {
          const dateA = new Date(a.electionDate || a.createdAt || 0).getTime();
          const dateB = new Date(b.electionDate || b.createdAt || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, 3)
    : [];

  const displayStats = stats ?? EMPTY_STATS;

  useEffect(() => {
    document.title = "Dashboard | Vote+";
  }, []);

  return (
    <MainLayout>
      <PageContent>
        <PageHeader
          title="Dashboard"
          description={
            user
              ? `Welcome, ${user.fullName || user.username}`
              : "Overview of all election activities"
          }
        />

        {(statsError || electionsError) && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Could not load dashboard data</AlertTitle>
            <AlertDescription>
              {statsError && (statsFetchError as Error)?.message}
              {statsError && electionsError ? " · " : ""}
              {electionsError && (electionsFetchError as Error)?.message}
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:gap-5">
          {statsLoading ? (
            <>
              <Skeleton className="h-24 w-full md:h-28" />
              <Skeleton className="h-24 w-full md:h-28" />
              <Skeleton className="h-24 w-full md:h-28" />
            </>
          ) : user?.role === "super_admin" ? (
            <>
              <StatCard
                title="Active Elections"
                value={displayStats.activeElections}
                icon={<Vote className="h-5 w-5" />}
                trend={{
                  value: `${displayStats.activeElections} active now`,
                  direction: displayStats.activeElections > 0 ? "up" : "neutral",
                }}
              />

              <StatCard
                title="Franchises"
                value={displayStats.totalFranchises.toLocaleString()}
                icon={<Building2 className="h-5 w-5" />}
                iconBgColor="bg-indigo-100"
                iconColor="text-indigo-600"
                trend={{
                  value: `${displayStats.totalFranchises} total`,
                  direction: "neutral",
                }}
              />

              <StatCard
                title="Total Elections"
                value={displayStats.totalElections.toLocaleString()}
                icon={<BarChart3 className="h-5 w-5" />}
                iconBgColor="bg-green-100"
                iconColor="text-green-600"
                trend={{
                  value: `${displayStats.totalElections} total`,
                  direction: "neutral",
                }}
              />
            </>
          ) : (
            <>
              <StatCard
                title="Active Elections"
                value={displayStats.activeElections}
                icon={<Vote className="h-5 w-5" />}
                trend={{
                  value: `${displayStats.activeElections} active now`,
                  direction: displayStats.activeElections > 0 ? "up" : "neutral",
                }}
              />

              <StatCard
                title="Total Elections"
                value={displayStats.totalElections.toLocaleString()}
                icon={<BarChart3 className="h-5 w-5" />}
                iconBgColor="bg-green-100"
                iconColor="text-green-600"
                trend={{
                  value: `${displayStats.totalElections} total`,
                  direction: "neutral",
                }}
              />

              <StatCard
                title="Registered Voters"
                value={displayStats.totalVoters.toLocaleString()}
                icon={<Users className="h-5 w-5" />}
                iconBgColor="bg-indigo-100"
                iconColor="text-indigo-600"
                trend={{
                  value: `${displayStats.totalVoters} total`,
                  direction: "neutral",
                }}
              />
            </>
          )}
        </div>

        {user?.role !== "super_admin" && (
          electionsLoading ? (
            <div className="mb-6">
              <Skeleton className="h-8 w-48 mb-4" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : electionsError ? (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Recent elections unavailable</AlertTitle>
              <AlertDescription>{(electionsFetchError as Error)?.message}</AlertDescription>
            </Alert>
          ) : recentElections.length > 0 ? (
            <RecentElectionsTable elections={recentElections} />
          ) : (
            <Card className="mb-6 border border-gray-200 shadow-none">
              <CardContent className="p-0">
                <EmptyState
                  title="No elections yet"
                  description="Create an election to see recent activity here."
                />
              </CardContent>
            </Card>
          )
        )}

        {user?.role === "super_admin" && (
          <div className="mt-6">
            {statsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : statsError ? null : (
              <FranchiseOverview
                stats={{
                  totalFranchises: displayStats.totalFranchises,
                  totalElections: displayStats.totalElections,
                  franchiseDistribution: displayStats.franchiseDistribution,
                }}
              />
            )}
          </div>
        )}
      </PageContent>
    </MainLayout>
  );
}
