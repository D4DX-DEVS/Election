import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RowSelectCheckbox } from "@/components/ui/row-select-checkbox";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Pagination, User, Election } from "@/lib/types";
import { getElectionLabel } from "@/lib/electionHelpers";
import { Loader2, Pencil, Printer, Trash2 } from "lucide-react";
import { VoterSlipPrinter } from "./VoterSlipPrinter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CompactList,
  CompactListActions,
  CompactListLeading,
  CompactListPrimary,
  CompactListRow,
  CompactListSecondary,
} from "@/components/ui/compact-list";

type VoterRecord = User & {
  _id?: string;
  electionAccess?: Array<string | number | { toString: () => string }>;
};

type ElectionRecord = Election & {
  _id?: string;
  id?: string | number;
};

interface VotersTableProps {
  voters: VoterRecord[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  elections?: ElectionRecord[];
  selectionMode?: boolean;
  isSelected?: (id: string) => boolean;
  onToggleSelect?: (id: string) => void;
  allSelected?: boolean;
  someSelected?: boolean;
  onToggleSelectAll?: () => void;
}

function VoterRowActions({
  voter,
  voterId,
  electionNames,
  onEdit,
  onDelete,
}: {
  voter: VoterRecord;
  voterId: string;
  electionNames: string[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [printOpen, setPrintOpen] = useState(false);
  const [printVoter, setPrintVoter] = useState<VoterRecord>(voter);
  const [loadingCredential, setLoadingCredential] = useState(false);
  const { toast } = useToast();

  const openPrintableCredential = async () => {
    setLoadingCredential(true);
    try {
      const response = await apiRequest("POST", "/api/users/voters/credentials", {
        voterIds: [voterId],
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Could not load voter credential.");
      const credential = body?.data?.[0];
      if (!credential?.plainPassword) {
        throw new Error("This voter does not have a recoverable credential yet.");
      }
      setPrintVoter({
        ...voter,
        plainPassword: credential.plainPassword,
      });
      setPrintOpen(true);
    } catch (error) {
      toast({
        title: "Could not print credential",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoadingCredential(false);
    }
  };

  return (
    <>
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Edit"
          aria-label={`Edit ${voter.fullName || voter.username}`}
          onClick={() => onEdit(voterId)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Print slip"
        aria-label="Print voter slip"
        onClick={openPrintableCredential}
        disabled={loadingCredential}
      >
        {loadingCredential ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
      </Button>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
          title="Delete"
          aria-label="Delete voter"
          onClick={() => onDelete(voterId)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      <VoterSlipPrinter
        voter={printVoter}
        electionNames={electionNames}
        open={printOpen}
        onOpenChange={setPrintOpen}
        hideTrigger
      />
    </>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
        Active
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
      Inactive
    </Badge>
  );
}

export function VotersTable({
  voters,
  pagination,
  onPageChange,
  onEdit,
  onDelete,
  elections = [],
  selectionMode = false,
  isSelected,
  onToggleSelect,
  allSelected = false,
  someSelected = false,
  onToggleSelectAll,
}: VotersTableProps) {
  const getElectionNamesForVoter = (voter: VoterRecord) => {
    if (!voter.electionAccess || !elections.length) return [];

    const voterElectionIds = voter.electionAccess.map((id) => id.toString());

    return elections
      .filter((election) => {
        const electionId = election._id?.toString() || election.id?.toString();
        return electionId && voterElectionIds.includes(electionId);
      })
      .map((election) => getElectionLabel(election));
  };

  const totalPages = Math.max(Math.ceil(pagination.total / pagination.pageSize), 1);

  return (
    <Card className="border-0 shadow-none bg-transparent lg:border lg:bg-white lg:shadow-sm">
      <CardContent className="p-0">
        {selectionMode && onToggleSelectAll && voters.length > 0 && (
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="inline-flex items-center gap-2">
              <RowSelectCheckbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={onToggleSelectAll}
                aria-label="Select all voters on this page"
              />
              <span
                onClick={onToggleSelectAll}
                className="cursor-pointer select-none text-sm font-medium text-primary"
              >
                {allSelected ? "Clear selection" : "Select all on this page"}
              </span>
            </div>
            <span className="app-helper">{voters.length} shown</span>
          </div>
        )}
        {voters.length > 0 ? (
          <CompactList className="rounded-none border-0">
            {voters.map((voter) => {
              const voterId = voter._id?.toString() || voter.id?.toString() || "";
              const electionNames = getElectionNamesForVoter(voter);
              const displayName = voter.fullName || voter.username;
              const showUsername =
                voter.fullName &&
                voter.username &&
                voter.fullName.trim().toLowerCase() !== voter.username.trim().toLowerCase();

              return (
                <CompactListRow
                  key={voterId}
                  label={onEdit && !selectionMode ? `Open ${displayName}` : undefined}
                  onClick={
                    selectionMode && onToggleSelect
                      ? () => onToggleSelect(voterId)
                      : onEdit
                        ? () => onEdit(voterId)
                        : undefined
                  }
                >
                  {selectionMode && onToggleSelect && isSelected && (
                    <CompactListLeading>
                      <RowSelectCheckbox
                        checked={isSelected(voterId)}
                        onCheckedChange={() => onToggleSelect(voterId)}
                        aria-label={`Select ${displayName}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </CompactListLeading>
                  )}
                  <CompactListPrimary>{displayName}</CompactListPrimary>
                  <CompactListSecondary>{showUsername ? voter.username : ""}</CompactListSecondary>
                  <StatusBadge status={voter.status} />
                  <CompactListActions>
                    <VoterRowActions
                      voter={voter}
                      voterId={voterId}
                      electionNames={electionNames}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  </CompactListActions>
                </CompactListRow>
              );
            })}
          </CompactList>
        ) : (
          <EmptyState title="No voters found" description="Add a voter or adjust your search to see results here." />
        )}
      </CardContent>
      {pagination.total > 0 && totalPages > 1 && (
        <CardFooter className="px-4 py-3 border-t flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {totalPages} · {pagination.total} voters
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
            >
              Next
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
