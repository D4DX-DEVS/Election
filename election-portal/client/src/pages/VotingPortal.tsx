import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  Vote,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import VoterLayout from '@/components/layouts/VoterLayout';
import { PageContent } from '@/components/layout/PageContent';
import { StatCard } from '@/components/dashboard/StatCard';
import { VoterElectionList } from '@/components/voting/VoterElectionList';

export default function VotingPortal() {
  const [, setLocation] = useLocation();
  const [votingStatus, setVotingStatus] = useState<Record<string, string>>({});
  const [availableElections, setAvailableElections] = useState<any[]>([]);

  const {
    data: electionsData,
    isLoading: isLoadingElections,
    isError: isElectionsError,
  } = useQuery({ queryKey: ['/api/vote/available-elections'] });

  const {
    data: voterStatusData,
    isLoading: isLoadingStatus,
    isError: isStatusError,
  } = useQuery({ queryKey: ['/api/vote/voter-status'] });

  useEffect(() => {
    if (Array.isArray(electionsData)) {
      setAvailableElections(electionsData);
    } else if (electionsData && typeof electionsData === 'object' && 'data' in electionsData) {
      if (Array.isArray((electionsData as any).data)) {
        setAvailableElections((electionsData as any).data);
      }
    }
  }, [electionsData]);

  useEffect(() => {
    if (voterStatusData && typeof voterStatusData === 'object') {
      if ('data' in voterStatusData && (voterStatusData as any).data) {
        setVotingStatus((voterStatusData as any).data);
      } else if (!('success' in voterStatusData)) {
        setVotingStatus(voterStatusData as Record<string, string>);
      }
    }
  }, [voterStatusData]);

  const handleElectionClick = (electionId: string) => {
    const election = availableElections.find(
      (e) => String(e._id || e.id) === String(electionId)
    );
    const voted = votingStatus[electionId] === 'voted';
    // Voted in a still-active election that allows revoting → back to the
    // ballot so they can change their vote. Otherwise voted → their results.
    if (voted && election?.status === 'active' && election?.allowRevote) {
      setLocation(`/election/${electionId}`);
    } else if (voted) {
      setLocation(`/results/${electionId}`);
    } else {
      setLocation(`/election/${electionId}`);
    }
  };

  const userFullName =
    (() => {
      try {
        const u = localStorage.getItem('user');
        if (u) {
          const p = JSON.parse(u);
          return p.fullName || p.username || '';
        }
      } catch { /* ignore */ }
      return localStorage.getItem('userFullName') || '';
    })();

  // Voters belong to a single franchise (tenant) — show its branding so they
  // can visually confirm which organization's elections they're viewing.
  const franchise = useMemo(() => {
    const withFranchise = availableElections.find((e) => e?.franchiseId?.name);
    return withFranchise?.franchiseId as { name?: string; logo?: { url?: string; alt?: string } } | undefined;
  }, [availableElections]);

  const stats = useMemo(() => {
    const total = availableElections.length;
    const voted = availableElections.filter((e) => {
      const id = e._id || e.id;
      return id && votingStatus[String(id)] === 'voted';
    }).length;
    // "Awaiting vote" only counts elections actually open for voting right now —
    // not-started/completed elections aren't actionable, so they shouldn't inflate this.
    const pending = availableElections.filter((e) => {
      const id = e._id || e.id;
      return e.status === 'active' && !(id && votingStatus[String(id)] === 'voted');
    }).length;
    return { total, voted, pending };
  }, [availableElections, votingStatus]);

  if (isLoadingElections || isLoadingStatus) {
    return (
      <VoterLayout title="My Elections">
        <PageContent className="px-4 sm:px-6 py-4 max-w-3xl mx-auto w-full space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </PageContent>
      </VoterLayout>
    );
  }

  if (isElectionsError || isStatusError) {
    return (
      <VoterLayout title="My Elections">
        <PageContent className="px-4 sm:px-6 py-4 max-w-3xl mx-auto w-full">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Failed to load elections</p>
              <p className="text-xs mt-0.5 text-red-600">Please check your connection and try again.</p>
            </div>
          </div>
        </PageContent>
      </VoterLayout>
    );
  }

  return (
    <VoterLayout title="My Elections">
      <PageContent className="px-4 sm:px-6 py-4 max-w-3xl mx-auto w-full">
        {franchise?.name && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center dark:border-gray-700 dark:bg-gray-900">
              {franchise.logo?.url ? (
                <img
                  src={franchise.logo.url}
                  alt={franchise.logo.alt || franchise.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Vote className="h-5 w-5 text-primary/70" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Voting for</p>
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{franchise.name}</p>
            </div>
          </div>
        )}

        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Hi, {userFullName || 'Voter'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {stats.total > 0
              ? `${stats.voted} of ${stats.total} election${stats.total !== 1 ? 's' : ''} completed`
              : 'No elections assigned yet'}
          </p>
        </div>

        {stats.total > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
            <StatCard
              title="Total elections"
              value={stats.total}
              icon={<Vote className="h-full w-full" />}
              iconBgColor="bg-primary/10"
              iconColor="text-primary"
            />
            <StatCard
              title="Awaiting vote"
              value={stats.pending}
              icon={<Clock className="h-full w-full" />}
              iconBgColor="bg-amber-100"
              iconColor="text-amber-600"
            />
            <StatCard
              title="Completed"
              value={stats.voted}
              icon={<CheckCircle2 className="h-full w-full" />}
              iconBgColor="bg-blue-100"
              iconColor="text-blue-600"
            />
          </div>
        )}

        {availableElections.length > 0 ? (
          <VoterElectionList
            elections={availableElections}
            votingStatus={votingStatus}
            onElectionClick={handleElectionClick}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed border-gray-200 bg-gray-50/80">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Info className="h-7 w-7 text-gray-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-1">
              No elections yet
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              When an admin assigns you to an election, it will appear here.
            </p>
          </div>
        )}
      </PageContent>
    </VoterLayout>
  );
}
