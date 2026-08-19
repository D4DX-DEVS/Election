import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { ElectionStatus, ElectionWithDetails } from "@/lib/types";
import { DropdownMenuItem, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { RowSelectCheckbox } from "@/components/ui/row-select-checkbox";
import { MoreHorizontal, Activity, Trash2, Pencil, Vote, SlidersHorizontal } from "lucide-react";
import { getElectionLabel, isElectionEditable, allowedStatusChanges } from "@/lib/electionHelpers";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { AddButton } from "@/components/ui/add-button";
import {
  CompactList,
  CompactListActions,
  CompactListLeading,
  CompactListPrimary,
  CompactListRow,
  CompactListSecondary,
} from "@/components/ui/compact-list";

function EmptyElections() {
  return (
    <EmptyState
      title="No elections found"
      description="Try a different search term, or create a new election to get started."
    />
  );
}

const STATUS_ACTION_LABELS: Record<string, string> = {
  draft: "Set as Draft",
  active: "Set as Active",
  completed: "Set as Completed",
  archived: "Set as Archived",
};

/** Restoring an archived election reads as "Unarchive", not "Set as Completed". */
function statusActionLabel(current: string | undefined, next: string) {
  if (current === "archived" && next === "completed") return "Unarchive";
  return STATUS_ACTION_LABELS[next];
}

function getElectionId(election: ElectionWithDetails) {
  return election._id?.toString() || election.id?.toString() || "";
}

/** Election logo with a neutral fallback tile when none is uploaded. */
function ElectionLogo({
  election,
  className = "h-9 w-9",
}: {
  election: ElectionWithDetails;
  className?: string;
}) {
  const url = election.logo?.url;
  const label = getElectionLabel(election);
  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center",
        className
      )}
    >
      {url ? (
        <img
          src={url}
          alt={election.logo?.alt || label}
          className="h-full w-full object-cover"
        />
      ) : (
        <Vote className="h-1/2 w-1/2 text-gray-400" />
      )}
    </div>
  );
}

function ElectionRowActions({
  id,
  status,
  onDelete,
  onStatusChange,
  onNavigate,
  selectionMode,
  selected,
  onToggleSelect,
}: {
  id: string;
  status: string;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: ElectionStatus) => void;
  onNavigate: (path: string) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const editable = isElectionEditable(status);
  const canDelete = editable;
  const statusOptions = allowedStatusChanges(status as ElectionStatus);

  if (selectionMode && onToggleSelect) {
    return (
      <RowSelectCheckbox
        checked={selected}
        onCheckedChange={() => onToggleSelect(id)}
        aria-label="Select election"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Election actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => onNavigate(`/elections/${id}`)}>
          Open election
        </DropdownMenuItem>
        {editable ? (
          <DropdownMenuItem onClick={() => onNavigate(`/elections/${id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onNavigate(`/elections/${id}/results`)}>
            View results
          </DropdownMenuItem>
        )}
        {statusOptions.length > 0 && <DropdownMenuSeparator />}
        {statusOptions.map((next) => (
          <DropdownMenuItem key={next} onClick={() => onStatusChange?.(id, next)}>
            <Activity className="mr-2 h-4 w-4" /> {statusActionLabel(status, next)}
          </DropdownMenuItem>
        ))}
        {canDelete && onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => onDelete(id)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ElectionsTableProps {
  elections: ElectionWithDetails[];
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: ElectionStatus) => void;
  selectionMode?: boolean;
  isSelected?: (id: string) => boolean;
  onToggleSelect?: (id: string) => void;
  allSelected?: boolean;
  someSelected?: boolean;
  onToggleSelectAll?: () => void;
  /** Toolbar search box — purely client-side filtering of the visible rows. */
  search?: string;
  onSearchChange?: (value: string) => void;
  /** Toggles the (existing) advanced filters panel rendered by the parent page. */
  onToggleFilters?: () => void;
  filtersOpen?: boolean;
  /** Compact add button shown beside the search box — navigates to the create-election route. */
  addHref?: string;
  addLabel?: string;
}

export function ElectionsTable({
  elections,
  onDelete,
  onStatusChange,
  selectionMode = false,
  isSelected,
  onToggleSelect,
  allSelected = false,
  someSelected = false,
  onToggleSelectAll,
  search,
  onSearchChange,
  onToggleFilters,
  filtersOpen,
  addHref,
  addLabel = "Add",
}: ElectionsTableProps) {
  const [, navigate] = useLocation();
  const showToolbar = onSearchChange || onToggleFilters || addHref;

  return (
    <Card className="border border-gray-200 shadow-none">
      {showToolbar && (
        <CardHeader className="flex-row items-center gap-2.5 px-3 py-2 border-b border-gray-200 sm:px-4">
          {onSearchChange && (
            <SearchInput
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search elections"
              className="h-9 text-sm min-w-0 flex-1 max-w-sm"
            />
          )}
          {onToggleFilters && (
            <Button
              variant={filtersOpen ? "secondary" : "outline"}
              size="sm"
              className="h-9 shrink-0 gap-1.5"
              onClick={onToggleFilters}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
            </Button>
          )}
          {addHref && (
            <Link href={addHref}>
              <AddButton
                title={addLabel}
                label={addLabel}
              />
            </Link>
          )}
        </CardHeader>
      )}
      <CardContent className="p-0">
        {elections.length === 0 && <EmptyElections />}
        {selectionMode && onToggleSelectAll && elections.length > 0 && (
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="inline-flex items-center gap-2">
              <RowSelectCheckbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={() => onToggleSelectAll()}
                aria-label="Select all deletable elections on this page"
              />
              <span
                onClick={() => onToggleSelectAll()}
                className="cursor-pointer select-none text-sm font-medium text-primary"
              >
                {allSelected ? "Clear selection" : "Select all on this page"}
              </span>
            </div>
          </div>
        )}
        {elections.length > 0 && (
          <CompactList className="rounded-none border-0">
            {elections.map((election) => {
              const id = getElectionId(election);
              const deletable = isElectionEditable(election.status);
              const dateLabel = election.electionDate
                ? format(new Date(election.electionDate), "MMM d, yyyy")
                : "—";
              const meta = `${dateLabel} · ${election.voterCount ?? 0} voters`;

              return (
                <CompactListRow key={id} onClick={() => navigate(`/elections/${id}`)} label={`Open ${getElectionLabel(election)}`}>
                  {selectionMode && deletable && onToggleSelect && isSelected && (
                    <CompactListLeading>
                      <RowSelectCheckbox
                        checked={isSelected(id)}
                        onCheckedChange={() => onToggleSelect(id)}
                        aria-label={`Select ${getElectionLabel(election)}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </CompactListLeading>
                  )}
                  <CompactListLeading>
                    <ElectionLogo election={election} className="h-8 w-8" />
                  </CompactListLeading>
                  <CompactListPrimary>{getElectionLabel(election)}</CompactListPrimary>
                  <CompactListSecondary>{meta}</CompactListSecondary>
                  <StatusBadge status={election.status} />
                  <CompactListActions>
                    <ElectionRowActions
                      id={id}
                      status={election.status}
                      onDelete={selectionMode ? undefined : onDelete}
                      onStatusChange={selectionMode ? undefined : onStatusChange}
                      onNavigate={navigate}
                      selectionMode={selectionMode && deletable}
                      selected={isSelected?.(id)}
                      onToggleSelect={onToggleSelect}
                    />
                  </CompactListActions>
                </CompactListRow>
              );
            })}
          </CompactList>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
          Active
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          Completed
        </Badge>
      );
    case 'draft':
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-800 hover:bg-primary/10">
          Draft
        </Badge>
      );
    case 'archived':
      return (
        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          Archived
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-800 hover:bg-primary/10">
          {status}
        </Badge>
      );
  }
}