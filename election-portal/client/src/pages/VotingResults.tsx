import { useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import VoterLayout from '@/components/layouts/VoterLayout';
import { getElectionLabel } from '@/lib/electionHelpers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  CheckCircle2,
  Calendar,
  ArrowLeft,
  Info,
  Trophy,
  FileCheck,
  Shield,
} from 'lucide-react';

export default function VotingResults() {
  const { electionId } = useParams();
  const [, navigate] = useLocation();

  const { data: electionData, isLoading: isLoadingElection, isError: isElectionError } = useQuery({
    queryKey: ['/api/elections', electionId, 'single'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/elections/${electionId}`);
      return res.json();
    },
    enabled: !!electionId,
    retry: false,
  });

  const { data: voteData, isLoading: isLoadingVote } = useQuery({
    queryKey: ['/api/vote/my-vote', electionId, 'single'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', `/api/vote/my-vote/${electionId}`);
        return res.json();
      } catch {
        return { success: false };
      }
    },
    enabled: !!electionId,
    retry: false,
  });

  const { data: publishedResp } = useQuery({
    queryKey: ['/api/vote/results', electionId, 'published'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', `/api/vote/results/${electionId}`);
        return res.json();
      } catch {
        return null;
      }
    },
    enabled: !!electionId,
    retry: false,
  });
  const publishedResults = publishedResp?.data || null;

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) { navigate('/login'); return; }
    if (voteData && !voteData.success && voteData.message === 'No vote found for this election') {
      navigate(`/election/${electionId}`);
    }
  }, [voteData, electionId, navigate]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-GB", {
      year: 'numeric', month: 'short', day: 'numeric',
    });

  const formatTimestamp = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-GB", {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  // ── Loading ──
  if (isLoadingElection || isLoadingVote) {
    return (
      <VoterLayout title="Loading Results…" showBack onBack={() => navigate('/voting')}>
        <div className="px-4 pt-4 max-w-lg mx-auto space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
        </div>
      </VoterLayout>
    );
  }

  // ── Error ──
  if (isElectionError) {
    return (
      <VoterLayout title="Error" showBack onBack={() => navigate('/voting')}>
        <div className="px-4 pt-4 max-w-lg mx-auto">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Error loading results</p>
              <p className="text-xs mt-0.5 text-red-600">Please try again later.</p>
            </div>
          </div>
        </div>
      </VoterLayout>
    );
  }

  // ── No vote found ──
  if (!voteData?.success) {
    return (
      <VoterLayout title="No Vote Found" showBack onBack={() => navigate('/voting')}>
        <div className="px-4 pt-4 max-w-lg mx-auto">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 mb-4">
            <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">No vote recorded</p>
              <p className="text-xs mt-0.5 text-blue-600">You haven't voted in this election yet.</p>
            </div>
          </div>
          <Button className="w-full h-12 rounded-xl" onClick={() => navigate(`/election/${electionId}`)}>
            Go to Voting Page
          </Button>
        </div>
      </VoterLayout>
    );
  }

  const election = electionData?.data;
  const vote = voteData?.data;
  const nominees = vote?.nominees || [];

  return (
    <VoterLayout title="My Vote" showBack onBack={() => navigate('/voting')}>
      <div className="px-4 pt-4 pb-4 max-w-lg mx-auto">

        {/* ── Election info card ── */}
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 mb-4">
          {election?.franchise?.name && (
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center dark:border-gray-700 dark:bg-gray-900">
                {election.franchise.logo?.url ? (
                  <img
                    src={election.franchise.logo.url}
                    alt={election.franchise.logo.alt || election.franchise.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Shield className="h-3.5 w-3.5 text-primary/70" />
                )}
              </div>
              <p className="truncate text-xs font-medium text-gray-500">{election.franchise.name}</p>
            </div>
          )}
          <h1 className="app-page-title">{election ? getElectionLabel(election) : ''}</h1>
          {election?.electionDate && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(election.electionDate)}
            </div>
          )}
        </div>

        {/* ── Vote confirmed banner ── */}
        <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 mb-5">
          <div className="flex items-center gap-2 mb-1.5">
            <FileCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h2 className="font-bold text-green-700 dark:text-green-300">Vote Confirmed</h2>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mb-3">
            Submitted on {formatTimestamp(vote?.timestamp)}
          </p>
          <div className="flex items-start gap-2 bg-white/60 dark:bg-gray-800/60 rounded-xl p-3">
            <Info className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Your vote is confidential. Only you can see the nominees you selected.
            </p>
          </div>
        </div>

        {/* ── Who you voted for ── */}
        <h3 className="font-bold text-base text-gray-800 dark:text-white mb-3">
          You voted for:
        </h3>
        <div className="space-y-3 mb-6">
          {nominees.map((nominee: any) => (
            <div
              key={nominee._id}
              className="flex items-center gap-3 bg-white dark:bg-gray-800 border-2 border-green-200 dark:border-green-800 rounded-2xl p-4"
            >
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0 text-lg font-bold text-green-700 dark:text-green-300">
                {nominee.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white">{nominee.name}</p>
                {nominee.bio && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{nominee.bio}</p>
                )}
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* ── Published results ── */}
        {publishedResults && Array.isArray(publishedResults.nominees) && (() => {
          const mode = publishedResults.election?.voterResultDisplay || 'full';
          const showScore = mode === 'score' || mode === 'full';
          const showPercentage = mode === 'percentage' || mode === 'full';
          return (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-base text-gray-800 dark:text-white">Election Results</h3>
                <span className="text-[10px] font-bold text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full">
                  Published
                </span>
              </div>

              {/* Stats row */}
              <div className={`grid ${showScore ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mb-3`}>
                {showScore && (
                  <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-center">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{publishedResults.totalBallots ?? 0}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Votes Cast</p>
                  </div>
                )}
                <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{publishedResults.eligibleVoters ?? 0}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Eligible</p>
                </div>
                <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{publishedResults.turnout ?? 0}%</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Turnout</p>
                </div>
              </div>

              {/* Rankings */}
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
                {[...publishedResults.nominees]
                  .sort((a: any, b: any) => (b.voteCount ?? b.percentage ?? 0) - (a.voteCount ?? a.percentage ?? 0))
                  .map((n: any, idx: number) => {
                    const elected = typeof n.isElected === 'boolean'
                      ? n.isElected
                      : idx < (publishedResults.election?.numberToBeElected || 1);
                    return (
                      <div
                        key={n._id || n.id || idx}
                        className={`flex items-center gap-3 px-4 py-3 ${idx !== 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''} ${elected ? 'bg-green-50 dark:bg-green-900/10' : ''}`}
                      >
                        <span className="text-sm font-bold text-gray-400 w-5 text-center flex-shrink-0">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm truncate ${elected ? 'text-green-700 dark:text-green-300' : 'text-gray-900 dark:text-white'}`}>
                            {n.name}
                          </p>
                          {elected && (
                            <span className="text-[10px] font-bold text-green-700 dark:text-green-400">✓ Elected</span>
                          )}
                        </div>
                        {(showScore || showPercentage) && (
                          <div className="text-right flex-shrink-0">
                            {showScore && (
                              <p className="font-bold text-sm text-gray-900 dark:text-white">{n.voteCount ?? 0}</p>
                            )}
                            {showPercentage && (
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {(n.percentage ?? 0).toFixed(1)}%
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })()}

        {/* ── Thank you ── */}
        <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-6 text-center mb-4">
          <p className="text-2xl mb-2">🗳️</p>
          <h2 className="font-bold text-lg text-gray-900 dark:text-white mb-1">Thank You For Voting</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your participation in this election is important and valued.
          </p>
        </div>

        <Button onClick={() => navigate('/voting')} className="w-full h-12 rounded-xl" variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Return to All Elections
        </Button>
      </div>
    </VoterLayout>
  );
}
