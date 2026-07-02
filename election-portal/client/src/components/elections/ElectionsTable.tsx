import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { ElectionStatus, ElectionWithDetails } from "@/lib/types";
import { DropdownMenuItem, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { RowSelectCheckbox } from "@/components/ui/row-select-checkbox";
import { MoreHorizontal, Activity, Trash2, Pencil } from "lucide-react";
import { getElectionLabel, isElectionEditable } from "@/lib/electionHelpers";

function getElectionId(election: ElectionWithDetails) {
  return election._id?.toString() || election.id?.toString() || "";
}

function ElectionMobileActions({
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onStatusChange?.(id, "draft")}>
          <Activity className="mr-2 h-4 w-4" /> Set as Draft
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange?.(id, "active")}>
          <Activity className="mr-2 h-4 w-4" /> Set as Active
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange?.(id, "completed")}>
          <Activity className="mr-2 h-4 w-4" /> Set as Completed
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange?.(id, "archived")}>
          <Activity className="mr-2 h-4 w-4" /> Set as Archived
        </DropdownMenuItem>
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
}: ElectionsTableProps) {
  const [, navigate] = useLocation();

  return (
    <Card className="border border-gray-200 md:shadow-sm shadow-none">
      <CardHeader className="hidden md:flex px-6 py-4 border-b border-gray-200">
        <CardTitle className="text-lg font-medium text-gray-900">Elections</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="md:hidden mx-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {elections.map((election) => {
            const id = getElectionId(election);
            const editable = isElectionEditable(election.status);
            const deletable = editable;
            const dateLabel = election.electionDate
              ? format(new Date(election.electionDate), "MMM d, yyyy")
              : "—";
            const meta = `${dateLabel} · ${election.nomineeCount ?? 0} nominees · ${election.voterCount ?? 0} voters`;

            return (
              <div
                key={id}
                className="flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-primary/5 active:bg-primary/10 border-b border-gray-200 last:border-b-0"
                onClick={() => navigate(`/elections/${id}`)}
              >
                {selectionMode && deletable && onToggleSelect && isSelected && (
                  <RowSelectCheckbox
                    checked={isSelected(id)}
                    onCheckedChange={() => onToggleSelect(id)}
                    aria-label={`Select ${getElectionLabel(election)}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 leading-tight truncate">
                      {getElectionLabel(election)}
                    </h3>
                    <StatusBadge status={election.status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 truncate">{meta}</p>
                </div>
                <ElectionMobileActions
                  id={id}
                  status={election.status}
                  onDelete={selectionMode ? undefined : onDelete}
                  onStatusChange={selectionMode ? undefined : onStatusChange}
                  onNavigate={navigate}
                  selectionMode={selectionMode && deletable}
                  selected={isSelected?.(id)}
                  onToggleSelect={onToggleSelect}
                />
              </div>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {selectionMode && onToggleSelectAll && (
                  <TableHead className="bg-white w-6 px-1">
                    <RowSelectCheckbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={() => onToggleSelectAll()}
                      aria-label="Select all deletable elections on this page"
                    />
                  </TableHead>
                )}
                <TableHead className="bg-white">Election</TableHead>
                <TableHead className="bg-white">Date</TableHead>
                <TableHead className="bg-white">Positions</TableHead>
                <TableHead className="bg-white">Nominees</TableHead>
                <TableHead className="bg-white">Voters</TableHead>
                <TableHead className="bg-white">Status</TableHead>
                <TableHead className="bg-white text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {elections.map((election) => {
                const electionId = getElectionId(election);
                const editable = isElectionEditable(election.status);
            const deletable = editable;
                return (
                <TableRow
                  key={election._id || election.id}
                  className="hover:bg-primary/5 cursor-pointer transition-colors duration-150"
                  onClick={() => navigate(`/elections/${electionId}`)}
                >
                  {selectionMode && onToggleSelect && isSelected && (
                    <TableCell className="w-6 px-1" onClick={(event) => event.stopPropagation()}>
                      {deletable ? (
                        <RowSelectCheckbox
                          checked={isSelected(electionId)}
                          onCheckedChange={() => onToggleSelect(electionId)}
                          aria-label={`Select ${getElectionLabel(election)}`}
                        />
                      ) : null}
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    {getElectionLabel(election)}
                  </TableCell>
                  <TableCell>
                    {format(new Date(election.electionDate), 'yyyy-MM-dd')}
                  </TableCell>
                  <TableCell>
                    {election.numberToBeElected}
                  </TableCell>
                  <TableCell>
                    {election.nomineeCount ?? 0}
                  </TableCell>
                  <TableCell>
                    {election.voterCount ?? 0}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={election.status} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                    {!selectionMode && (
                      <>
                    {editable ? (
                      <Link href={`/elections/${electionId}/edit`}>
                        <Button variant="ghost" size="sm" className="mr-1">
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </Link>
                    ) : (
                      <Link href={`/elections/${electionId}/results`}>
                        <Button variant="ghost" size="sm" className="mr-1">
                          View results
                        </Button>
                      </Link>
                    )}
                    {deletable && onDelete && (
                      <Button 
                        variant="ghost"
                        size="sm"
                        className="mr-1 text-red-600 hover:text-red-900 hover:bg-red-50"
                        onClick={() => onDelete(electionId)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="mr-1 h-4 w-4" /> More
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onStatusChange?.(electionId, 'draft')}>
                          <Activity className="mr-2 h-4 w-4" /> Set as Draft
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onStatusChange?.(electionId, 'active')}>
                          <Activity className="mr-2 h-4 w-4" /> Set as Active
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onStatusChange?.(electionId, 'completed')}>
                          <Activity className="mr-2 h-4 w-4" /> Set as Completed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onStatusChange?.(electionId, 'archived')}>
                          <Activity className="mr-2 h-4 w-4" /> Set as Archived
                        </DropdownMenuItem>
                        {deletable && onDelete && (
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => onDelete(electionId)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );})}
            </TableBody>
          </Table>
        </div>
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