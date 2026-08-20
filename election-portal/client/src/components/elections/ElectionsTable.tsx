import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { ElectionStatus, ElectionWithDetails } from "@/lib/types";
import {
  DropdownMenuItem,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { RowSelectCheckbox } from "@/components/ui/row-select-checkbox";
import { Activity, Trash2, Pencil, SlidersHorizontal } from "lucide-react";
import {
  getElectionLabel,
  isElectionEditable,
  allowedStatusChanges,
} from "@/lib/electionHelpers";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { AddButton } from "@/components/ui/add-button";
import { ElectionCard } from "./ElectionCard";

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

function statusActionLabel(current: string | undefined, next: string) {
  if (current === "archived" && next === "completed") return "Unarchive";
  return STATUS_ACTION_LABELS[next];
}

function getElectionId(election: ElectionWithDetails) {
  return election._id?.toString() || election.id?.toString() || "";
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
    <div className="flex items-center gap-0">
      {editable && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          title="Edit"
          aria-label="Edit election"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(`/elections/${id}/edit`);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {statusOptions.length > 0 && onStatusChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              title="Change status"
              aria-label="Change election status"
              onClick={(e) => e.stopPropagation()}
            >
              <Activity className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-44"
            onClick={(e) => e.stopPropagation()}
          >
            {statusOptions.map((next) => (
              <DropdownMenuItem
                key={next}
                onClick={() => onStatusChange(id, next)}
              >
                {statusActionLabel(status, next)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {canDelete && onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
          title="Delete"
          aria-label="Delete election"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
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
  search?: string;
  onSearchChange?: (value: string) => void;
  onToggleFilters?: () => void;
  filtersOpen?: boolean;
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
    <Card className="overflow-hidden rounded-xl border border-gray-100 shadow-sm">
      {showToolbar && (
        <CardHeader className="flex-row items-center gap-2.5 border-b border-gray-100 px-3 py-2 sm:px-4">
          {onSearchChange && (
            <SearchInput
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search elections"
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
              <AddButton title={addLabel} label={addLabel} />
            </Link>
          )}
        </CardHeader>
      )}

      <CardContent className="p-0">
        {elections.length === 0 && <EmptyElections />}

        {/* Selection-mode select-all row */}
        {selectionMode && onToggleSelectAll && elections.length > 0 && (
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="inline-flex items-center gap-2">
              <RowSelectCheckbox
                checked={
                  allSelected ? true : someSelected ? "indeterminate" : false
                }
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

        {/* Election cards */}
        {elections.length > 0 && (
          <div className="flex flex-col gap-2 p-3">
            {elections.map((election) => {
              const id = getElectionId(election);
              const deletable = isElectionEditable(election.status);

              const selectionLeading =
                selectionMode && deletable && onToggleSelect && isSelected ? (
                  <RowSelectCheckbox
                    checked={isSelected(id)}
                    onCheckedChange={() => onToggleSelect(id)}
                    aria-label={`Select ${getElectionLabel(election)}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : undefined;

              return (
                <ElectionCard
                  key={id}
                  election={election}
                  onClick={() => navigate(`/elections/${id}`)}
                  selectionLeading={selectionLeading}
                  actions={
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
                  }
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
