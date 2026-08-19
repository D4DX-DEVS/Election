import { useState, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { MainLayout } from "@/components/layout/MainLayout";
import { VoterBulkGenerator } from "@/components/voters/VoterBulkGenerator";
import { VotersTable } from "@/components/voters/VotersTable";
import { BulkVoterSlipPrinter } from "@/components/voters/BulkVoterSlipPrinter";
import VoterGroups from "@/pages/VoterGroups";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SelectCheckbox } from "@/components/ui/row-select-checkbox";
import { PlusIcon, Upload, AlertCircle, UsersRound, Download, MoreHorizontal, FileSpreadsheet, Printer } from "lucide-react";
import {
  downloadVoterImportTemplate,
  exportVotersToExcel,
  fetchAllVoters,
  importVotersFromRows,
  parseVoterImportFile,
  type ParsedVoterImportRow,
} from "@/lib/voterImportExport";
import { BulkVoterGenerationOptions, Pagination, User, Election } from "@/lib/types";
import { getElectionLabel, isElectionLocked } from "@/lib/electionHelpers";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DeleteModeBar } from "@/components/ui/delete-mode-bar";
import { DeleteModeButton } from "@/components/ui/delete-mode-button";
import { useBulkDeleteMode } from "@/hooks/useBulkDeleteMode";
import { deleteByIds } from "@/lib/bulkDelete";
import { SearchInput } from "@/components/ui/search-input";
import { AddButton } from "@/components/ui/add-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isValidNameField } from "@/lib/utils";

type EntityRecord = { _id?: string; id?: string };
type VoterRecord = User & EntityRecord & { electionAccess?: string[] };
type ElectionRecord = Election & EntityRecord;
type VotersResponse = { data?: VoterRecord[]; pagination?: Pagination };
type ElectionsResponse = { data?: ElectionRecord[] };
type CredentialSlipVoter = {
  _id?: string;
  username: string;
  plainPassword: string;
  sequenceNumber?: number;
  electionAccess?: string[];
};

function getRecordId(record: EntityRecord): string {
  return record._id?.toString() || record.id?.toString() || "";
}

export default function Voters({ embedded = false, electionId, readOnly = false }: { embedded?: boolean; electionId?: string; readOnly?: boolean } = {}) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const searchQuery = useDebouncedValue(searchInput, 300);
  const [selectedElectionId, setSelectedElectionId] = useState<string>(electionId || "all");
  const [createVoterOpen, setCreateVoterOpen] = useState(false);
  const [bulkVoterOpen, setBulkVoterOpen] = useState(false);
  const [printSlipsOpen, setPrintSlipsOpen] = useState(false);
  const [credentialSlipVoters, setCredentialSlipVoters] = useState<CredentialSlipVoter[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ParsedVoterImportRow[]>([]);
  const [importElectionId, setImportElectionId] = useState(electionId || "");
  const [isExporting, setIsExporting] = useState(false);
  const [editVoterOpen, setEditVoterOpen] = useState(false);
  const [editingVoter, setEditingVoter] = useState<VoterRecord | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    username: "",
    registrationNumber: "",
    status: "active",
    electionIds: [] as string[],
  });
  const [newVoter, setNewVoter] = useState({
    fullName: "",
    username: "",
    password: "",
    registrationNumber: "",
    electionId: electionId || "",
  });
  
  // Construct the query string for pagination and filtering
  const getVotersQueryString = () => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    
    // Add election filter if selected and not "all"
    if (selectedElectionId && selectedElectionId !== "all") {
      params.append('electionId', selectedElectionId);
    }
    if (searchQuery.trim()) {
      params.append('search', searchQuery.trim());
    }

    return params.toString();
  };
  
  const { 
    data: votersResponse, 
    isLoading: votersLoading, 
    isFetching: votersFetching,
    isError: votersError,
  } = useQuery<VotersResponse>({
    queryKey: ['/api/users/voters', selectedElectionId, page, pageSize, searchQuery],
    queryFn: async () => {
      const queryString = getVotersQueryString();
      const response = await apiRequest('GET', `/api/users/voters?${queryString}`);
      return response.json();
    },
    refetchOnWindowFocus: false
  });

  // Fetch elections for the bulk generator
  const { 
    data: allElections,
    isLoading: electionsLoading,
    isError: electionsError
  } = useQuery<ElectionsResponse>({
    queryKey: ['/api/elections'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/elections');
      return response.json();
    },
    refetchOnWindowFocus: false
  });
  
  // Fetch voter groups for the bulk generator
  const { data: voterGroupsData } = useQuery<{ data: Array<{ _id: string; name?: string; description?: string; voters?: string[] }> }>({
    queryKey: ['/api/voter-groups/all-for-bulk'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/voter-groups?limit=200');
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const updateVoterMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        fullName: string;
        username: string;
        registrationNumber: string;
        status: string;
        electionAccess: string[];
      };
    }) => {
      const response = await apiRequest("PUT", `/api/users/${id}`, payload);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Failed to update voter");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Voter updated", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["/api/users/voters"] });
      setEditVoterOpen(false);
      setEditingVoter(null);
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const importVotersMutation = useMutation({
    mutationFn: async ({
      rows,
      defaultElectionIds,
    }: {
      rows: ParsedVoterImportRow[];
      defaultElectionIds: string[];
    }) => importVotersFromRows(rows, defaultElectionIds),
    onSuccess: (result) => {
      toast({
        title: "Import complete",
        description: `${result.created} created, ${result.skipped} skipped.`,
        variant: result.errors.length ? "destructive" : "success",
      });
      if (result.errors.length) {
        console.warn("Voter import errors:", result.errors);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users/voters"] });
      setImportOpen(false);
      setImportFile(null);
      setImportPreview([]);
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Mutation for generating voters in bulk
  const generateVotersMutation = useMutation({
    mutationFn: async (options: BulkVoterGenerationOptions) => {
      const response = await apiRequest('POST', '/api/users/voters/generate', options);
      return response.json();
    },
    onSuccess: (data, options) => {
      const generatedCredentials: CredentialSlipVoter[] = Array.isArray(data?.data)
        ? data.data.map((voter: any, index: number) => ({
            _id: voter.id,
            username: voter.username,
            plainPassword: voter.plainPassword,
            sequenceNumber: options.startingNumber + index,
            electionAccess: options.electionIds || [],
          }))
        : [];
      toast({
        title: "Voters generated",
        description: `Generated ${data.count} voter accounts. You can print them now or reprint them later from the voter list.`,
        variant: "success",
      });
      setBulkVoterOpen(false);
      setCredentialSlipVoters(generatedCredentials);
      setPrintSlipsOpen(generatedCredentials.length > 0);
      
      // Invalidate and refetch voters
      queryClient.invalidateQueries({ queryKey: ['/api/users/voters'] });
    },
    onError: (error) => {
      toast({
        title: "Generation failed",
        description: `Failed to generate voters: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });
  
  // Mutation for creating a single voter
  const createVoterMutation = useMutation({
    mutationFn: async (payload: { fullName: string; username: string; password: string; registrationNumber: string; electionIds: string[] }) => {
      const response = await apiRequest('POST', '/api/users/voters', payload);
      return response.json();
    },
    onSuccess: (data) => {
      const credential = data?.data?.password
        ? [{
            _id: data.data.id,
            username: data.data.username,
            plainPassword: data.data.password,
            electionAccess: newVoter.electionId ? [newVoter.electionId] : [],
          }]
        : [];
      toast({
        title: "Voter created",
        description: credential.length
          ? `Voter "${data.data.username}" created. Print or save the credential now.`
          : `Voter "${data?.data?.username}" created.`,
        variant: "success",
      });
      setCredentialSlipVoters(credential);
      setPrintSlipsOpen(credential.length > 0);
      queryClient.invalidateQueries({ queryKey: ['/api/users/voters'] });
      setCreateVoterOpen(false);
      setNewVoter({ fullName: "", username: "", password: "", registrationNumber: "", electionId: electionId || "" });
    },
    onError: (error) => {
      toast({
        title: "Create failed",
        description: `Failed to create voter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });

  const deleteVotersMutation = useMutation({
    mutationFn: async (ids: string[]) =>
      deleteByIds(ids, (id) => `/api/users/voters/${id}`),
    onSuccess: (result, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/voters"] });
      setPendingDeleteIds(null);
      selection.exitDeleteMode();

      if (result.failed.length === 0) {
        toast({
          title: ids.length === 1 ? "Voter deleted" : "Voters deleted",
          description:
            ids.length === 1
              ? "The voter has been successfully deleted."
              : `${result.deleted.length} voter(s) deleted successfully.`,
          variant: "success",
        });
        return;
      }

      toast({
        title: "Some deletions failed",
        description: `${result.deleted.length} deleted, ${result.failed.length} failed.`,
        variant: "destructive",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setPendingDeleteIds(null);
    },
  });

  // Use data from API responses
  const voters = votersResponse?.data || [];
  const voterPageIds = voters.map((v) => getRecordId(v)).filter(Boolean);
  const selection = useBulkDeleteMode(voterPageIds);
  const pagination = votersResponse?.pagination || {
    page,
    pageSize,
    total: 0
  };
  const displayElections = allElections?.data || [];

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleGenerateVoters = (options: BulkVoterGenerationOptions) => {
    generateVotersMutation.mutate(options);
  };

  const handleImportVoters = () => {
    setImportFile(null);
    setImportPreview([]);
    setImportElectionId(embedded && electionId ? electionId : selectedElectionId !== "all" ? selectedElectionId : "");
    setImportOpen(true);
  };

  const handleImportFileChange = async (file: File | null) => {
    setImportFile(file);
    setImportPreview([]);
    if (!file) return;
    try {
      const rows = await parseVoterImportFile(file, displayElections);
      setImportPreview(rows);
    } catch (error) {
      toast({
        title: "Could not read file",
        description: error instanceof Error ? error.message : "Invalid file",
        variant: "destructive",
      });
      setImportFile(null);
    }
  };

  const handleSubmitImport = () => {
    if (!importPreview.length) {
      toast({ title: "No rows to import", variant: "destructive" });
      return;
    }
    const defaultElectionIds =
      importElectionId && importElectionId !== "all" ? [importElectionId] : [];
    importVotersMutation.mutate({ rows: importPreview, defaultElectionIds });
  };

  const handleExportVoters = async () => {
    setIsExporting(true);
    try {
      const allVoters = await fetchAllVoters({
        electionId: selectedElectionId,
        search: searchQuery,
      });
      if (!allVoters.length) {
        toast({ title: "No voters to export", variant: "destructive" });
        return;
      }
      const label =
        selectedElectionId !== "all"
          ? displayElections.find((e) => getRecordId(e) === selectedElectionId)?.organization || "Filtered_Voters"
          : "All_Voters";
      exportVotersToExcel(allVoters, displayElections, { electionFilterLabel: label });
      toast({
        title: "Export complete",
        description: `${allVoters.length} voter(s) exported to Excel.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleEditVoter = (id: string) => {
    const voter = voters.find((v) => getRecordId(v) === id);
    if (!voter) {
      toast({ title: "Voter not found", variant: "destructive" });
      return;
    }
    setEditingVoter(voter);
    setEditForm({
      fullName: voter.fullName || "",
      username: voter.username || "",
      registrationNumber: voter.registrationNumber || "",
      status: voter.status || "active",
      electionIds: (voter.electionAccess || []).map(String),
    });
    setEditVoterOpen(true);
  };

  const handleSubmitEditVoter = () => {
    if (!editingVoter) return;
    if (!editForm.username.trim()) {
      toast({ title: "Username required", variant: "destructive" });
      return;
    }
    updateVoterMutation.mutate({
      id: getRecordId(editingVoter),
      payload: {
        fullName: editForm.fullName.trim() || editForm.username.trim(),
        username: editForm.username.trim(),
        registrationNumber: editForm.registrationNumber.trim() || editForm.username.trim(),
        status: editForm.status,
        electionAccess: editForm.electionIds,
      },
    });
  };

  const toggleEditElection = (electionIdValue: string, checked: boolean) => {
    setEditForm((prev) => ({
      ...prev,
      electionIds: checked
        ? [...new Set([...prev.electionIds, electionIdValue])]
        : prev.electionIds.filter((id) => id !== electionIdValue),
    }));
  };

  const handleDeleteVoter = (id: string) => {
    setPendingDeleteIds([id]);
  };

  const handleBulkDeleteClick = () => {
    if (selection.selectedCount > 0) {
      setPendingDeleteIds([...selection.selectedIds]);
    }
  };

  const confirmDelete = () => {
    if (pendingDeleteIds?.length) {
      deleteVotersMutation.mutate(pendingDeleteIds);
    }
  };

  const handleAddVoter = () => {
    setCreateVoterOpen(true);
  };

  const handleSubmitNewVoter = () => {
    if (!newVoter.username.trim()) {
      toast({ title: "Username required", description: "Please enter a username for the voter", variant: "destructive" });
      return;
    }
    if (!isValidNameField(newVoter.username)) {
      toast({ title: "Invalid username", description: "Username cannot be numbers only — mix in at least one letter.", variant: "destructive" });
      return;
    }
    if (newVoter.fullName.trim() && !isValidNameField(newVoter.fullName)) {
      toast({ title: "Invalid full name", description: "Full name cannot be numbers only — mix in at least one letter.", variant: "destructive" });
      return;
    }
    createVoterMutation.mutate({
      fullName: newVoter.fullName.trim() || newVoter.username.trim(),
      username: newVoter.username.trim(),
      password: newVoter.password.trim(),
      registrationNumber: newVoter.registrationNumber.trim(),
      electionIds: embedded && electionId ? [electionId] : (newVoter.electionId ? [newVoter.electionId] : []),
    });
  };

  // Reset to page 1 when filters or debounced search change
  useEffect(() => {
    setPage(1);
  }, [selectedElectionId, searchQuery]);

  useEffect(() => {
    if (!embedded) document.title = "Voter Groups | Vote+";
  }, [embedded]);

  useEffect(() => {
    if (embedded) document.title = "Voters | Vote+";
  }, [embedded]);

  // When embedded in an election workspace, scope bulk generation / create to
  // the current election only.
  const formElections = embedded
    ? displayElections.filter((election) => getRecordId(election) === selectedElectionId)
    : displayElections;
  const bulkGeneratorElections = formElections
    .map((election) => ({
      _id: getRecordId(election),
      organization: election.organization,
      title: election.title,
    }))
    .filter((election) => election._id);

  const scopedElection = displayElections.find((e) => getRecordId(e) === selectedElectionId);
  const isReadOnly =
    readOnly ||
    (embedded && electionId
      ? isElectionLocked(displayElections.find((e) => getRecordId(e) === electionId)?.status)
      : selectedElectionId !== "all" && isElectionLocked(scopedElection?.status));

  const Wrapper = embedded ? Fragment : MainLayout;

  const votersListContent = (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <SearchInput
              placeholder="Search by name or username..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          {isReadOnly && (
            <div className="flex items-center gap-2 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label="Bulk Print Slips"
                    onClick={() => setPrintSlipsOpen(true)}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bulk Print Slips</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label="Export"
                    onClick={handleExportVoters}
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isExporting ? "Exporting…" : "Export"}</TooltipContent>
              </Tooltip>
            </div>
          )}
          {!embedded && (
            <Select value={selectedElectionId} onValueChange={setSelectedElectionId}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All elections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All elections</SelectItem>
                {displayElections.map((election) => (
                  <SelectItem
                    key={getRecordId(election)}
                    value={getRecordId(election) || "unknown"}
                  >
                    {getElectionLabel(election)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {!isReadOnly && (
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <AddButton title="Add voter" label="Add voter" onClick={handleAddVoter} />
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-center gap-1.5 px-3"
                  >
                    <MoreHorizontal className="h-4 w-4 shrink-0" />
                    <span className="truncate">More</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleImportVoters}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import from Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportVoters} disabled={isExporting}>
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? "Exporting…" : "Export to Excel"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBulkVoterOpen(true)}>
                    <UsersRound className="h-4 w-4 mr-2" />
                    Bulk create
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPrintSlipsOpen(true)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DeleteModeButton
                active={selection.deleteMode}
                onClick={() =>
                  selection.deleteMode ? selection.exitDeleteMode() : selection.enterDeleteMode()
                }
              />
            </div>
            <BulkVoterSlipPrinter
              voters={credentialSlipVoters.length ? credentialSlipVoters : voters}
              elections={displayElections}
              selectedElectionId={selectedElectionId}
              open={printSlipsOpen}
              onOpenChange={(open) => {
                setPrintSlipsOpen(open);
                if (!open) setCredentialSlipVoters([]);
              }}
              hideTrigger
              title={credentialSlipVoters.length ? "New Voter Credentials · Print Now" : undefined}
            />
          </div>
        )}
        {isReadOnly && (
          <BulkVoterSlipPrinter
            voters={credentialSlipVoters.length ? credentialSlipVoters : voters}
            elections={displayElections}
            selectedElectionId={selectedElectionId}
            open={printSlipsOpen}
            onOpenChange={(open) => {
              setPrintSlipsOpen(open);
              if (!open) setCredentialSlipVoters([]);
            }}
            hideTrigger
            title={credentialSlipVoters.length ? "New Voter Credentials · Print Now" : undefined}
          />
        )}
      </div>

      {electionsError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to fetch data. Showing cached data instead.
          </AlertDescription>
        </Alert>
      )}

      {votersError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to fetch voters. Please try again.
          </AlertDescription>
        </Alert>
      )}

      {votersLoading || (votersFetching && !!searchQuery.trim()) ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="space-y-6">
          {!isReadOnly && (
            <DeleteModeBar
              active={selection.deleteMode}
              count={selection.selectedCount}
              entityLabel="voter"
              onCancel={selection.exitDeleteMode}
              onConfirmDelete={handleBulkDeleteClick}
              deleting={deleteVotersMutation.isPending}
            />
          )}
          <VotersTable
            voters={voters}
            pagination={pagination}
            onPageChange={handlePageChange}
            onEdit={isReadOnly || selection.deleteMode ? undefined : handleEditVoter}
            onDelete={isReadOnly || selection.deleteMode ? undefined : handleDeleteVoter}
            elections={displayElections}
            selectionMode={selection.showSelectors}
            isSelected={selection.isSelected}
            onToggleSelect={selection.toggle}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
            onToggleSelectAll={selection.toggleAll}
          />
        </div>
      )}
    </>
  );

  return (
    <Wrapper>
      {!embedded ? (
        <VoterGroups embedded />
      ) : electionId ? (
        <VoterGroups embedded electionId={electionId} suppressTitle mode="view" />
      ) : (
        votersListContent
      )}

      <Dialog open={bulkVoterOpen} onOpenChange={setBulkVoterOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader className="pr-8">
            <DialogTitle>Create Bulk Voters</DialogTitle>
            <DialogDescription>
              Generate multiple voter accounts and assign them to an election, group, or voter group.
            </DialogDescription>
          </DialogHeader>
          {(electionsLoading) ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <VoterBulkGenerator
              elections={bulkGeneratorElections}
              voterGroups={voterGroupsData?.data || []}
              onGenerate={handleGenerateVoters}
              onCancel={() => setBulkVoterOpen(false)}
              isGenerating={generateVotersMutation.isPending}
              fixedElectionId={embedded ? electionId : undefined}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDeleteIds?.length}
        onOpenChange={(open) => !open && setPendingDeleteIds(null)}
        onConfirm={confirmDelete}
        loading={deleteVotersMutation.isPending}
        title="Are you sure?"
        description={
          pendingDeleteIds && pendingDeleteIds.length > 1
            ? `This will permanently delete ${pendingDeleteIds.length} voter accounts. This action cannot be undone.`
            : "This action cannot be undone. This will permanently delete the voter account."
        }
        confirmText={
          pendingDeleteIds && pendingDeleteIds.length > 1
            ? `Delete ${pendingDeleteIds.length} voters`
            : "Delete voter"
        }
      />

      <Dialog open={createVoterOpen} onOpenChange={setCreateVoterOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Voter</DialogTitle>
            <DialogDescription>Create a new voter account.</DialogDescription>
          </DialogHeader>
          <div className="app-form-fields">
              <div className="grid gap-1">
                <Label htmlFor="voter-fullname">Full Name</Label>
                <Input id="voter-fullname" value={newVoter.fullName} onChange={(e) => setNewVoter({ ...newVoter, fullName: e.target.value })} placeholder="e.g. John Doe" autoFocus />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="voter-username">Username *</Label>
                <Input id="voter-username" value={newVoter.username} onChange={(e) => setNewVoter({ ...newVoter, username: e.target.value })} placeholder="e.g. john.doe" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="voter-password">Password</Label>
                <Input id="voter-password" value={newVoter.password} onChange={(e) => setNewVoter({ ...newVoter, password: e.target.value })} placeholder="Leave blank to auto-generate" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="voter-regno">Registration Number</Label>
                <Input id="voter-regno" value={newVoter.registrationNumber} onChange={(e) => setNewVoter({ ...newVoter, registrationNumber: e.target.value })} placeholder="Optional (defaults to username)" />
              </div>
              {!embedded && (
                <div className="grid gap-1">
                  <Label>Assign to Election</Label>
                  <Select value={newVoter.electionId} onValueChange={(value) => setNewVoter({ ...newVoter, electionId: value })}>
                    <SelectTrigger><SelectValue placeholder="Select an election" /></SelectTrigger>
                    <SelectContent>
                      {formElections.map((election) => (
                        <SelectItem key={getRecordId(election)} value={getRecordId(election)}>{getElectionLabel(election)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateVoterOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitNewVoter} disabled={createVoterMutation.isPending}>
              {createVoterMutation.isPending ? 'Creating…' : 'Create Voter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editVoterOpen} onOpenChange={(open) => {
        setEditVoterOpen(open);
        if (!open) setEditingVoter(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Voter</DialogTitle>
            <DialogDescription>Update voter account details and election access.</DialogDescription>
          </DialogHeader>
          <div className="app-form-fields">
            <div className="space-y-1.5">
              <Label htmlFor="edit-fullname">Full Name</Label>
              <Input
                id="edit-fullname"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-username">Username *</Label>
              <Input
                id="edit-username"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-regno">Registration Number</Label>
              <Input
                id="edit-regno"
                value={editForm.registrationNumber}
                onChange={(e) => setEditForm({ ...editForm, registrationNumber: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!embedded && displayElections.length > 0 && (
              <div className="space-y-2">
                <Label>Election Access</Label>
                <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                  {displayElections.map((election) => {
                    const eid = getRecordId(election);
                    return (
                      <div key={eid} className="flex items-center gap-2 px-3 py-2 hover:bg-primary/5">
                        <SelectCheckbox
                          checked={editForm.electionIds.includes(eid)}
                          onCheckedChange={() => toggleEditElection(eid, !editForm.electionIds.includes(eid))}
                          aria-label={`Select ${getElectionLabel(election)}`}
                        />
                        <span className="text-sm">{getElectionLabel(election)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVoterOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitEditVoter} disabled={updateVoterMutation.isPending}>
              {updateVoterMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(open) => {
        setImportOpen(open);
        if (!open) {
          setImportFile(null);
          setImportPreview([]);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Voters</DialogTitle>
            <DialogDescription>
              Upload Excel (.xlsx) or CSV with columns: username, full_name, password (optional), registration_number, elections.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-0.5">
            <label className="flex flex-col items-center justify-center w-full min-h-20 border-2 border-dashed rounded-lg cursor-pointer bg-white hover:bg-primary/10">
              <div className="flex flex-col items-center py-4">
                <FileSpreadsheet className="h-6 w-6 text-gray-400 mb-1.5" />
                <p className="text-sm text-gray-600">
                  {importFile ? importFile.name : "Click to upload spreadsheet"}
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.csv,.xls"
                onChange={(e) => handleImportFileChange(e.target.files?.[0] || null)}
              />
            </label>
            <Button type="button" variant="link" className="px-0 h-auto" onClick={downloadVoterImportTemplate}>
              Download template
            </Button>
            {importPreview.length > 0 && (
              <p className="text-sm text-primary font-medium">{importPreview.length} row(s) ready to import</p>
            )}
            {!embedded && (
              <div className="grid gap-1">
                <Label>Default election (optional)</Label>
                <Select value={importElectionId || "none"} onValueChange={(v) => setImportElectionId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Assign all imported voters to…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None — use elections column only</SelectItem>
                    {displayElections.map((election) => (
                      <SelectItem key={getRecordId(election)} value={getRecordId(election)}>
                        {getElectionLabel(election)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmitImport}
              disabled={!importPreview.length || importVotersMutation.isPending}
            >
              {importVotersMutation.isPending ? "Importing…" : `Import ${importPreview.length || 0} Voter(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
