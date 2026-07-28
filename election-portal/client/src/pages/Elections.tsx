import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { ElectionFilters } from "@/components/elections/ElectionFilters";
import { ElectionsTable } from "@/components/elections/ElectionsTable";
import { Button } from "@/components/ui/button";
import { PlusIcon, AlertCircle } from "lucide-react";
import { ElectionFilter, ElectionWithDetails, Franchise, Pagination } from "@/lib/types";
import { useCallback } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageContent, PageBottom, PageHeader } from "@/components/layout/PageContent";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteByIds } from "@/lib/bulkDelete";
import { useToast } from "@/hooks/use-toast";
import { isElectionEditable } from "@/lib/electionHelpers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getStoredUser } from "@/lib/authUser";

export default function Elections() {
  const [filters, setFilters] = useState<ElectionFilter>({});
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const { toast } = useToast();

  // Get user data from localStorage for role-based filtering
  const userData = getStoredUser();
  const userRole = userData?.role || '';
  const userFranchiseId = userData?.franchiseId || '';
  const userElectionAccess = userData?.electionAccess || [];

  // Construct query string from filters
  const getQueryString = useCallback(() => {
    const queryParams = new URLSearchParams();

    if (filters.franchiseId) {
      queryParams.append('franchiseId', filters.franchiseId.toString());
    }

    if (filters.status) {
      queryParams.append('status', filters.status);
    }

    if (filters.dateFrom) {
      queryParams.append('fromDate', filters.dateFrom.toISOString().split('T')[0]);
    }

    if (filters.dateTo) {
      queryParams.append('toDate', filters.dateTo.toISOString().split('T')[0]);
    }

    const queryString = queryParams.toString();
    return queryString ? `?${queryString}` : '';
  }, [filters]);

  // Auto-apply franchise filter for franchise admins
  useEffect(() => {
    if (userRole === 'franchise_admin' && userFranchiseId) {
      setFilters(prev => ({
        ...prev,
        franchiseId: userFranchiseId
      }));
    }
  }, [userRole, userFranchiseId]);

  // Fetch elections with filters + server-side pagination applied
  const {
    data: electionsResponse,
    isLoading: electionsLoading,
    isError: electionsError,
    refetch: refetchElections
  } = useQuery<{ data: ElectionWithDetails[]; pagination?: Pagination }>({
    queryKey: ['/api/elections', getQueryString(), page],
    queryFn: async () => {
      const qs = getQueryString();
      const sep = qs ? '&' : '?';
      const res = await apiRequest('GET', `/api/elections${qs}${sep}page=${page}&limit=${pageSize}`);
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  const elections = electionsResponse?.data ?? [];
  const electionsPagination = electionsResponse?.pagination;

  // Fetch franchises for filtering
  const { 
    data: franchises = [], 
    isLoading: franchisesLoading, 
    isError: franchisesError 
  } = useQuery<Franchise[]>({
    queryKey: ['/api/franchises']
  });

  const handleStatusChange = async (id: string, newStatus: 'draft' | 'active' | 'completed' | 'archived') => {
    try {
      // Use apiRequest so a non-2xx response actually throws (the old raw fetch
      // swallowed errors and showed "success" even when nothing changed).
      // Making an election active also opens it for voting; completing or
      // archiving closes voting.
      const payload: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'active') payload.votingOpen = true;
      if (newStatus === 'completed' || newStatus === 'archived') payload.votingOpen = false;

      await apiRequest('PUT', `/api/elections/${id}`, payload);

      // Refetch elections
      queryClient.invalidateQueries({ queryKey: ['/api/elections'] });

      toast({
        title: "Status Updated",
        description: "Election status has been updated successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update election status.",
        variant: "destructive"
      });
    }
  };

  const deleteElectionsMutation = useMutation({
    mutationFn: async (ids: string[]) => deleteByIds(ids, (id) => `/api/elections/${id}`),
    onSuccess: (result, ids) => {
      toast({
        title: ids.length === 1 ? "Election deleted" : "Elections deleted",
        description:
          result.failed.length === 0
            ? ids.length === 1
              ? "The election has been successfully deleted."
              : `${result.deleted.length} election(s) deleted successfully.`
            : `${result.deleted.length} deleted, ${result.failed.length} failed.`,
        variant: result.failed.length ? "destructive" : "success",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/elections"] });
      setPendingDeleteIds(null);
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: `Failed to delete election: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
      setPendingDeleteIds(null);
    },
  });

  const handleApplyFilters = (newFilters: ElectionFilter) => {
    // For franchise admin, ensure franchiseId filter is always applied
    if (userRole === 'franchise_admin' && userFranchiseId) {
      newFilters.franchiseId = userFranchiseId;
    }
    setPage(1);
    setFilters(newFilters);
  };

  const handleDeleteElection = (id: string) => {
    const target = displayElections.find(
      (e) => (e._id?.toString() || e.id?.toString()) === id
    );
    if (target && !isElectionEditable(target.status)) {
      toast({
        title: "Cannot delete election",
        description: "Completed or archived elections cannot be deleted.",
        variant: "destructive",
      });
      return;
    }
    setPendingDeleteIds([id]);
  };

  const confirmDelete = () => {
    if (pendingDeleteIds?.length) {
      deleteElectionsMutation.mutate(pendingDeleteIds);
    }
  };

  useEffect(() => {
    document.title = "Elections | Vote+";
  }, []);

  // Get filtered elections based on user role
  const getFilteredElections = () => {
    if (!elections || !elections.length) return [];

    if (userRole === 'super_admin') {
      // Super admin can see all elections
      return elections;
    } else if (userRole === 'franchise_admin') {
      // Franchise admin sees only their franchise's elections
      // (Already filtered by API due to franchiseId filter set above)
      return elections;
    } else if (userRole === 'election_admin' && userElectionAccess && userElectionAccess.length > 0) {
      // Election admin sees only elections they have access to
      return elections.filter(election => {
        const electionId = election._id?.toString() || election.id?.toString();
        return electionId && userElectionAccess.includes(electionId);
      });
    } else {
      // Default fallback
      return elections;
    }
  };

  // Use the data from API responses
  const displayElections = getFilteredElections();
  const displayFranchises = franchises || [];

  return (
    <MainLayout>
      <PageContent>
      <PageHeader
        title="Elections"
        description="Select an election to manage its nominees and voters"
        actions={userRole !== "election_admin" ? (
          <Link href="/elections/create">
          <Button size="sm">
            <PlusIcon className="mr-1 h-3.5 w-3.5" />
            Add election
          </Button>
          </Link>
        ) : undefined}
      />

      {franchisesError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to fetch franchises. Showing cached data instead.
          </AlertDescription>
        </Alert>
      )}

      {/* Only super admins need cross-franchise filtering; franchise/election admins are already scoped */}
      {userRole === 'super_admin' && !franchisesLoading && (
        <ElectionFilters
          franchises={displayFranchises}
          onApplyFilters={handleApplyFilters}
        />
      )}

      {electionsError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to fetch elections. Showing cached data instead.
          </AlertDescription>
        </Alert>
      )}

      {electionsLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <ElectionsTable
            elections={displayElections}
            onDelete={handleDeleteElection}
            onStatusChange={handleStatusChange}
          />
          <PageBottom>
          {electionsPagination && (
            <PaginationControls
              page={electionsPagination.page}
              totalPages={electionsPagination.totalPages ?? 1}
              total={electionsPagination.total}
              pageSize={electionsPagination.pageSize}
              onPageChange={setPage}
            />
          )}
          </PageBottom>
        </>
      )}

      </PageContent>

      <ConfirmDialog
        open={!!pendingDeleteIds?.length}
        onOpenChange={(open) => !open && setPendingDeleteIds(null)}
        onConfirm={confirmDelete}
        loading={deleteElectionsMutation.isPending}
        title="Are you sure?"
        description={
          pendingDeleteIds && pendingDeleteIds.length > 1
            ? `This will permanently delete ${pendingDeleteIds.length} elections and all related data. This action cannot be undone.`
            : "This action cannot be undone. This will permanently delete the election and all related data."
        }
        confirmText={
          pendingDeleteIds && pendingDeleteIds.length > 1
            ? `Delete ${pendingDeleteIds.length} elections`
            : "Delete election"
        }
      />
    </MainLayout>
  );
}
