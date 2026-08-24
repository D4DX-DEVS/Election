import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import VoterLayout from '@/components/layouts/VoterLayout';
import { getElectionLabel } from '@/lib/electionHelpers';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertCircle,
  CheckCircle2,
  Vote as VoteIcon,
  ArrowLeft,
  Calendar,
  Shield,
  ThumbsUp,
  ChevronRight,
  Users,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

enum VotingStep {
  SELECT = 'select',
  REVIEW = 'review',
  CONFIRMED = 'confirmed',
}

export default function VotingBallot() {
  const { electionId } = useParams();
  const [, navigate] = useLocation();
  const [selectedNominees, setSelectedNominees] = useState<string[]>([]);
  const [votingStep, setVotingStep] = useState<VotingStep>(VotingStep.SELECT);
  const [selectedMaleCount, setSelectedMaleCount] = useState(0);
  const [selectedFemaleCount, setSelectedFemaleCount] = useState(0);

  const handleCloseApp = () => {
    window.close();
    setTimeout(() => navigate('/voting'), 300);
  };

  const { data: electionData, isLoading: isLoadingElection, isError: isElectionError } = useQuery({
    queryKey: [`/api/elections/${electionId}`],
    enabled: !!electionId,
  });

  const { data: nomineesData, isLoading: isLoadingNominees, isError: isNomineesError } = useQuery({
    queryKey: [`/api/nominees/election/${electionId}`],
    enabled: !!electionId,
  });

  const { data: voterStatusData } = useQuery({
    queryKey: ['/api/vote/voter-status'],
    enabled: !!electionId,
  });

  const alreadyVotedFlag = Boolean(
    voterStatusData &&
      typeof voterStatusData === 'object' &&
      'data' in voterStatusData &&
      (voterStatusData as any).data &&
      electionId &&
      (voterStatusData as any).data[electionId] === 'voted'
  );

  const { data: myVoteData } = useQuery({
    queryKey: [`/api/vote/my-vote/${electionId}`],
    enabled: !!electionId && alreadyVotedFlag,
  });

  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (!prefilled && myVoteData) {
      const vote: any = (myVoteData as any)?.data || myVoteData;
      const previousIds: string[] = Array.isArray(vote?.nominees) ? vote.nominees.map((id: any) => String(id)) : [];
      if (previousIds.length > 0) {
        setSelectedNominees(previousIds);
      }
      setPrefilled(true);
    }
  }, [myVoteData, prefilled]);

  const election: any = Array.isArray(electionData)
    ? electionData.length > 0 ? electionData[0] : null
    : electionData && typeof electionData === 'object' && 'data' in electionData
      ? (electionData as any).data
      : electionData || null;

  let nominees: any[] = [];
  if (Array.isArray(nomineesData)) {
    nominees = nomineesData;
  } else if (nomineesData && typeof nomineesData === 'object' && Array.isArray((nomineesData as any).data)) {
    nominees = (nomineesData as any).data;
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString("en-GB", {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  const castVoteMutation = useMutation({
    mutationFn: async (nomineeIds: string[]) => {
      const response = await fetch(`/api/vote/cast/${electionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ nomineeIds }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cast vote');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vote/voter-status'] });
      queryClient.invalidateQueries({ queryKey: [`/api/vote/my-vote/${electionId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/vote/available-elections'] });
      setVotingStep(VotingStep.CONFIRMED);
    },
    onError: (error) => {
      toast({ title: 'Error', description: (error as Error).message || 'Failed to submit vote.', variant: 'destructive' });
      setVotingStep(VotingStep.SELECT);
    },
  });

  const alreadyVoted = alreadyVotedFlag;

  useEffect(() => {
    // Voters who already voted are bounced back — unless the election allows
    // revoting, in which case they may open the ballot again to change it.
    // Wait for the election to load so allowRevote is known before deciding.
    if (alreadyVoted && election && !election.allowRevote) {
      navigate('/voting');
    }
  }, [alreadyVoted, election, navigate]);

  useEffect(() => {
    let maleCount = 0;
    let femaleCount = 0;
    selectedNominees.forEach((id) => {
      const nominee = nominees.find((n: any) => n._id === id);
      if (nominee) {
        if (nominee.gender === 'female') femaleCount++;
        else maleCount++;
      }
    });
    setSelectedMaleCount(maleCount);
    setSelectedFemaleCount(femaleCount);
  }, [selectedNominees, nominees]);

  const handleNomineeSelection = (nomineeId: string) => {
    if (selectedNominees.includes(nomineeId)) {
      setSelectedNominees(selectedNominees.filter((id) => id !== nomineeId));
    } else {
      if (election && selectedNominees.length < election.numberToBeElected) {
        setSelectedNominees([...selectedNominees, nomineeId]);
      } else {
        toast({
          title: 'Maximum Selections Reached',
          description: `You can only select ${election?.numberToBeElected} nominee(s)`,
        });
      }
    }
  };

  const validateSelections = () => {
    if (!election) return false;
    const requiresExactSelection = election.ballotSelectionRule !== "up_to";
    if (
      (requiresExactSelection && selectedNominees.length !== election.numberToBeElected) ||
      (!requiresExactSelection && selectedNominees.length === 0)
    ) {
      toast({
        title: 'Selection Required',
        description: requiresExactSelection
          ? `Please select exactly ${election.numberToBeElected} nominee(s)`
          : `Please select at least 1 and up to ${election.numberToBeElected} nominee(s)`,
        variant: 'destructive',
      });
      return false;
    }
    if (election.genderBasedSelection) {
      if ((election.maleMinimum || 0) > 0 && selectedMaleCount < election.maleMinimum) {
        toast({ title: 'Gender Requirement', description: `Please select at least ${election.maleMinimum} male nominee(s)`, variant: 'destructive' });
        return false;
      }
      if ((election.femaleMinimum || 0) > 0 && selectedFemaleCount < election.femaleMinimum) {
        toast({ title: 'Gender Requirement', description: `Please select at least ${election.femaleMinimum} female nominee(s)`, variant: 'destructive' });
        return false;
      }
    }
    return true;
  };

  const handleReviewVote = () => {
    if (!election || !validateSelections()) return;
    setVotingStep(VotingStep.REVIEW);
  };

  const calculateProgress = () => {
    if (!election) return 0;
    return (selectedNominees.length / election.numberToBeElected) * 100;
  };

  const getSelectedNominees = () =>
    selectedNominees.map((id) => nominees.find((n: any) => n._id === id)).filter(Boolean);

  // ── Loading ──
  if (isLoadingElection || isLoadingNominees) {
    return (
      <VoterLayout title="Loading Ballot..." showBack onBack={() => navigate('/voting')}>
        <div className="px-4 pt-4 max-w-lg mx-auto space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </VoterLayout>
    );
  }

  // ── Error ──
  if (isElectionError || isNomineesError) {
    return (
      <VoterLayout title="Error" showBack onBack={() => navigate('/voting')}>
        <div className="px-4 pt-4 max-w-lg mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load election data. Please try again later.</AlertDescription>
          </Alert>
        </div>
      </VoterLayout>
    );
  }

  // ── Not open for voting ──
  // The election list only lets voters click into active elections, but a direct
  // link (or an election that closed while the page was open) can still land here.
  if (election && votingStep !== VotingStep.CONFIRMED && election.status !== 'active') {
    const notStarted = election.status !== 'completed' && election.status !== 'archived';
    return (
      <VoterLayout title={getElectionLabel(election)} showBack onBack={() => navigate('/voting')}>
        <div className="px-4 pt-4 max-w-lg mx-auto">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{notStarted ? 'Voting has not started' : 'Voting has closed'}</AlertTitle>
            <AlertDescription>
              {notStarted
                ? 'This election is not open for voting yet. You will be able to cast your vote once it starts.'
                : 'This election has ended, so votes can no longer be cast.'}
            </AlertDescription>
          </Alert>
          <Button className="mt-4 w-full" variant="outline" onClick={() => navigate('/voting')}>
            Back to my elections
          </Button>
        </div>
      </VoterLayout>
    );
  }

  // ── Confirmed ──
  if (votingStep === VotingStep.CONFIRMED && election) {
    return (
      <VoterLayout title="Vote Submitted">
        <div className="px-4 pt-6 max-w-lg mx-auto">
          {/* Success icon */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-5 shadow-lg shadow-green-200/60">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="app-page-title mb-2">Vote Submitted!</h1>
            <p className="app-muted max-w-xs">
              Thank you for participating. Your vote has been securely recorded.
            </p>
          </div>

          {/* Election info */}
          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <p className="app-helper mb-1">Election</p>
            <h2 className="app-section-title">{getElectionLabel(election)}</h2>
            <div className="app-muted mt-2 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(election.electionDate)}
            </div>
          </div>

          {/* Info banners */}
          <div className="space-y-3 mb-8">
            <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 flex items-start gap-3">
              <ThumbsUp className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-green-800 dark:text-green-300">Voting Complete</p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Your vote has been securely recorded in the system.</p>
              </div>
            </div>
            <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">Privacy Notice</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Individual vote details are kept confidential.</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button onClick={() => navigate('/voting')} size="lg" className="w-full h-12 rounded-xl">
              Return to Elections
            </Button>
            <Button onClick={handleCloseApp} size="lg" variant="outline" className="w-full h-12 rounded-xl">
              Close App
            </Button>
          </div>
        </div>
      </VoterLayout>
    );
  }

  // ── Review ──
  if (votingStep === VotingStep.REVIEW && election) {
    const selectedNomineesList = getSelectedNominees();
    return (
      <VoterLayout title="Review Vote" showBack onBack={() => setVotingStep(VotingStep.SELECT)}>
        <div className="px-4 pt-4 max-w-lg mx-auto pb-4">
          {/* Warning banner */}
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4 mb-5 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">Review Carefully</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {election.allowRevote
                  ? 'You can change your vote later while voting is open.'
                  : 'Once submitted, your vote cannot be changed.'}
              </p>
            </div>
          </div>

          {/* Election info */}
          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 mb-5">
            <h2 className="app-section-title">{getElectionLabel(election)}</h2>
          </div>

          <h3 className="app-section-title mb-3">
            Your selections ({selectedNomineesList.length})
          </h3>

          <div className="space-y-3 mb-6">
            {selectedNomineesList.map((nominee: any) => (
              <div
                key={nominee._id}
                className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {nominee.photo?.url ? (
                    <img src={nominee.photo.url} alt={nominee.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-primary">{nominee.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">{nominee.name}</p>
                  {nominee.description && (
                    <p className="app-muted mt-0.5 truncate">{nominee.description}</p>
                  )}
                </div>
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleSubmitVote}
              disabled={castVoteMutation.isPending}
              size="lg"
              className="w-full h-12 rounded-xl"
            >
              {castVoteMutation.isPending ? 'Submitting…' : 'Confirm & Submit Vote'}
              {!castVoteMutation.isPending && <CheckCircle2 className="h-4 w-4 ml-2" />}
            </Button>
            <Button
              variant="outline"
              onClick={() => setVotingStep(VotingStep.SELECT)}
              size="lg"
              className="w-full h-12 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Change Selections
            </Button>
          </div>
        </div>
      </VoterLayout>
    );
  }

  // ── Helper to submit vote (used from review step) ──
  function handleSubmitVote() {
    castVoteMutation.mutate(selectedNominees);
  }

  // ── Select nominees (main view) ──
  return (
    <VoterLayout title={election ? getElectionLabel(election) : 'Cast Your Vote'} showBack onBack={() => navigate('/voting')}>
      <div className="px-4 pt-4 pb-28 max-w-lg mx-auto">
        {election && (
          <>
            {/* Election banner image */}
            {election.logo?.url && (
              <div className="w-full h-40 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-700 mb-4">
                <img
                  src={election.logo.url}
                  alt={election.logo.alt || getElectionLabel(election)}
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Election meta */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 mb-4">
              {election.franchise?.name && (
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
                  <p className="app-muted truncate font-medium">{election.franchise.name}</p>
                </div>
              )}
              <h1 className="app-page-title">{getElectionLabel(election)}</h1>
              <div className="app-muted mt-2 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(election.electionDate)}
              </div>
            </div>

            {/* Revote notice */}
            {alreadyVoted && election.allowRevote && (
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4 mb-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">You have already voted</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Your previous selections are shown below. Edit them and submit again to replace your vote.
                  </p>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 mb-5">
              <div className="flex items-start gap-3">
                <VoteIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">Instructions</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                    Tap a nominee to select them. Select {election.ballotSelectionRule === 'up_to' ? 'up to' : 'exactly'}{' '}
                    <strong>{election.numberToBeElected}</strong> nominee{election.numberToBeElected !== 1 ? 's' : ''}.
                  </p>
                </div>
              </div>
            </div>

            {/* Progress tracker */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <Users className="h-4 w-4" />
                  {selectedNominees.length} / {election.numberToBeElected} selected
                </div>
                {election.genderBasedSelection &&
                  ((election.maleMinimum || 0) > 0 || (election.femaleMinimum || 0) > 0) && (
                    <div className="flex items-center gap-3 text-xs">
                      {(election.maleMinimum || 0) > 0 && (
                        <span className={selectedMaleCount >= election.maleMinimum ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                          M: {selectedMaleCount}/{election.maleMinimum}
                        </span>
                      )}
                      {(election.femaleMinimum || 0) > 0 && (
                        <span className={selectedFemaleCount >= election.femaleMinimum ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                          F: {selectedFemaleCount}/{election.femaleMinimum}
                        </span>
                      )}
                    </div>
                  )}
              </div>
              <Progress value={calculateProgress()} className="h-2.5 rounded-full" />
            </div>
          </>
        )}

        {/* ── Nominee list ── */}
        {nominees.length > 0 ? (
          <div className="space-y-3">
            {nominees.map((nominee: any) => {
              const selected = selectedNominees.includes(nominee._id);
              return (
                <button
                  key={nominee._id}
                  type="button"
                  className="w-full text-left"
                  onClick={() => handleNomineeSelection(nominee._id)}
                  aria-pressed={selected}
                  aria-label={`${selected ? 'Deselect' : 'Select'} ${nominee.name}`}
                >
                  <div
                    className={cn(
                      'flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-150 active:scale-[0.98]',
                      selected
                        ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
                    )}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className={cn(
                        'w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-lg font-bold',
                        selected ? 'bg-primary/20 text-primary' : 'bg-gray-100 dark:bg-gray-700 text-gray-500',
                      )}>
                        {nominee.photo?.url ? (
                          <img src={nominee.photo.url} alt={nominee.name} className="w-full h-full object-cover" />
                        ) : nominee.image?.url ? (
                          <img src={nominee.image.url} alt={nominee.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{nominee.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      {selected && (
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'app-body font-semibold leading-tight',
                          selected ? 'text-primary' : 'text-gray-900 dark:text-white',
                        )}>
                          {nominee.name}
                        </span>
                        {election?.genderBasedSelection && nominee.gender && (
                          <Badge variant="outline" className="capitalize text-xs px-1.5 py-0 h-4">
                            {nominee.gender}
                          </Badge>
                        )}
                      </div>
                      {(nominee.description || nominee.bio) && (
                        <p className="app-muted mt-0.5 line-clamp-2">
                          {nominee.description || nominee.bio}
                        </p>
                      )}
                    </div>

                    {/* Selection indicator */}
                    <div className={cn(
                      'flex-shrink-0 w-6 h-6 rounded-full border-2 transition-colors',
                      selected ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-600',
                    )} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="h-10 w-10 text-orange-400 mb-3" />
            <p className="font-semibold text-gray-700 dark:text-gray-200">No nominees available</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">Please contact the administrator.</p>
            <Button variant="outline" onClick={() => navigate('/voting')}>
              Return to Elections
            </Button>
          </div>
        )}
      </div>

      {/* ── Sticky Review button ── */}
      {nominees.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 px-4 py-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 56px)' }}>
          <Button
            onClick={handleReviewVote}
            className="w-full h-12 rounded-xl text-sm font-bold shadow-lg"
            size="lg"
            disabled={
              !election ||
              selectedNominees.length === 0 ||
              (election.ballotSelectionRule !== 'up_to' &&
                selectedNominees.length !== election.numberToBeElected)
            }
          >
            Review Selections ({selectedNominees.length}/{election?.numberToBeElected})
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </VoterLayout>
  );
}
