import { useState, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, Pencil, Trash2, AlertCircle } from "lucide-react";
import { DeleteModeBar } from "@/components/ui/delete-mode-bar";
import { DeleteModeButton } from "@/components/ui/delete-mode-button";
import { ExportMenu } from "@/components/ui/export-menu";
import { RowSelectCheckbox } from "@/components/ui/row-select-checkbox";
import { useBulkDeleteMode } from "@/hooks/useBulkDeleteMode";
import { deleteByIds } from "@/lib/bulkDelete";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from 'xlsx';
import { drawPdfHeader, drawPdfFooter, brandedTableTheme } from "@/lib/pdfBranding";
import { autoSizeColumns } from "@/lib/excelHelpers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getElectionLabel, isElectionLocked } from "@/lib/electionHelpers";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { NomineeForm } from "@/components/nominees/NomineeForm";
import { NomineeAvatar } from "@/components/nominees/NomineeAvatar";

export default function Nominees({
  embedded = false,
  electionId,
  readOnly = false,
}: { embedded?: boolean; electionId?: string; readOnly?: boolean } = {}) {
  const [selectedElectionId, setSelectedElectionId] = useState<string>(electionId || "all");
  const [searchInput, setSearchInput] = useState<string>("");
  const searchTerm = useDebouncedValue(searchInput, 300);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [isAddNomineeOpen, setIsAddNomineeOpen] = useState(false);
  const [isEditNomineeOpen, setIsEditNomineeOpen] = useState(false);
  const [currentNominee, setCurrentNominee] = useState<any>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { toast } = useToast();

  useEffect(() => {
    if (electionId) {
      setSelectedElectionId(electionId);
    }
  }, [electionId]);

  const refreshNomineeLists = async (
    targetElectionId?: string,
    createdNominee?: Record<string, unknown>
  ) => {
    const activeId =
      targetElectionId ||
      electionId ||
      (selectedElectionId !== "all" ? selectedElectionId : "");

    setPage(1);

    if (createdNominee && activeId) {
      queryClient.setQueriesData(
        {
          queryKey: ["/api/nominees"],
          predicate: (query) => {
            const [, eid, search, pg] = query.queryKey as [string, string, string, number];
            if (eid !== "all" && eid !== activeId) return false;
            if (String(search || "").trim()) return false;
            if (pg !== 1) return false;
            return true;
          },
        },
        (old: { data?: unknown[]; pagination?: { total?: number; page?: number; pageSize?: number; totalPages?: number }; count?: number } | undefined) => {
          if (!createdNominee) return old;
          const nomineeId = String(createdNominee._id || createdNominee.id || "");
          if (!old?.data || !Array.isArray(old.data)) {
            return {
              success: true,
              count: 1,
              data: [createdNominee],
              pagination: { total: 1, page: 1, pageSize, totalPages: 1 },
            };
          }
          if (nomineeId && old.data.some((n) => String((n as { _id?: string; id?: string })._id || (n as { id?: string }).id) === nomineeId)) {
            return old;
          }
          const data = [createdNominee, ...old.data].slice(0, pageSize);
          const total = (old.pagination?.total ?? old.data.length) + 1;
          const pageSizeUsed = old.pagination?.pageSize ?? pageSize;
          return {
            ...old,
            count: data.length,
            data,
            pagination: old.pagination
              ? {
                  ...old.pagination,
                  total,
                  page: 1,
                  totalPages: Math.max(Math.ceil(total / pageSizeUsed), 1),
                }
              : undefined,
          };
        }
      );
    }

    if (activeId) {
      queryClient.setQueryData([`/api/nominees/election/${activeId}`], (old: { data?: unknown[]; count?: number } | undefined) => {
        if (!createdNominee) return old;
        const nomineeId = String(createdNominee._id || createdNominee.id || "");
        const existing = Array.isArray(old?.data) ? old.data : [];
        if (nomineeId && existing.some((n) => String((n as { _id?: string; id?: string })._id || (n as { id?: string }).id) === nomineeId)) {
          return old;
        }
        const data = [createdNominee, ...existing];
        return { success: true, count: data.length, data };
      });
    }

    await queryClient.refetchQueries({ queryKey: ["/api/nominees"], type: "active" });
    if (activeId) {
      await queryClient.refetchQueries({
        queryKey: [`/api/nominees/election/${activeId}`],
        type: "active",
      });
    }
  };
  
  // Fetch nominees data (server-side pagination)
  const { 
    data: nomineesData, 
    isLoading: nomineesLoading,
    isError: nomineesError,
    refetch: refetchNominees
  } = useQuery({
    queryKey: ['/api/nominees', selectedElectionId, searchTerm, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(pageSize));
      if (selectedElectionId && selectedElectionId !== 'all') {
        params.append('electionId', selectedElectionId);
      }
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      const response = await apiRequest('GET', `/api/nominees?${params.toString()}`);
      return response.json();
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  
  // Fetch elections data
  const { 
    data: electionsData, 
    isLoading: electionsLoading,
    isError: electionsError 
  } = useQuery({
    queryKey: ['/api/elections'],
    queryFn: async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error('Authentication token not found');
        
        const response = await apiRequest('GET', '/api/elections');
        
        if (!response.ok) throw new Error('Failed to fetch elections');
        
        const data = await response.json();
        console.log("Elections API Response:", data);
        return data;
      } catch (error) {
        console.error("Error fetching elections:", error);
        throw error;
      }
    },
    staleTime: 5000 // Consider data fresh for 5 seconds
  });
  
  const deleteNomineesMutation = useMutation({
    mutationFn: async (ids: string[]) => deleteByIds(ids, (id) => `/api/nominees/${id}`),
    onSuccess: (result, ids) => {
      setPendingDeleteIds(null);
      selection.exitDeleteMode();
      refetchNominees();
      queryClient.invalidateQueries({ queryKey: ["/api/nominees"] });

      if (result.failed.length === 0) {
        toast({
          title: ids.length === 1 ? "Nominee deleted" : "Nominees deleted",
          description:
            ids.length === 1
              ? "Nominee has been deleted successfully."
              : `${result.deleted.length} nominee(s) deleted successfully.`,
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
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete nominee(s)",
        variant: "destructive",
      });
      setPendingDeleteIds(null);
    },
  });

  // Handle election selection change
  const handleElectionChange = (value: string) => {
    setSelectedElectionId(value);
  };
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };
  
  // Handle edit nominee
  const handleEditNominee = (nominee: any) => {
    setCurrentNominee(nominee);
    setIsEditNomineeOpen(true);
  };
  
  const handleDeleteClick = (id: string) => {
    setPendingDeleteIds([String(id)]);
  };

  const handleBulkDeleteClick = () => {
    if (selection.selectedCount > 0) {
      setPendingDeleteIds([...selection.selectedIds]);
    }
  };

  const confirmDelete = () => {
    if (pendingDeleteIds?.length) {
      deleteNomineesMutation.mutate(pendingDeleteIds);
    }
  };

  const getNomineeId = (nominee: { _id?: string; id?: string }) =>
    String(nominee._id || nominee.id || "");
  
  const nominees = nomineesData?.data || [];
  const elections = electionsData?.data || [];
  const nomineesPagination = nomineesData?.pagination;
  const totalNominees = nomineesPagination?.total ?? nominees.length;
  const totalNomineePages = nomineesPagination?.totalPages ?? Math.max(Math.ceil(totalNominees / pageSize), 1);
  const paginatedNominees = nominees;
  const nomineePageIds = paginatedNominees.map(getNomineeId).filter(Boolean);
  const selection = useBulkDeleteMode(nomineePageIds);

  const fetchAllNomineesForExport = async () => {
    const params = new URLSearchParams();
    if (selectedElectionId && selectedElectionId !== 'all') {
      params.append('electionId', selectedElectionId);
    }
    if (searchTerm.trim()) {
      params.append('search', searchTerm.trim());
    }
    const qs = params.toString();
    const response = await apiRequest('GET', `/api/nominees${qs ? `?${qs}` : ''}`);
    const json = await response.json();
    return Array.isArray(json.data) ? json.data : [];
  };

  // Reset to first page when filters/search change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedElectionId]);
  // Export nominee data to PDF
  const exportToPDF = async () => {
    try {
      const displayNominees = await fetchAllNomineesForExport();
      // Get the title for the PDF based on selected election
      let title = "All Nominees";
      if (selectedElectionId && selectedElectionId !== 'all') {
        const election = elections.find((e: any) => {
          const electionId = e._id?.toString() || e.id?.toString();
          return electionId === selectedElectionId;
        });
        if (election) {
          title = `${getElectionLabel(election)} Nominees`;
        }
      }

      // Create a new PDF document with the shared branded letterhead
      const doc = new jsPDF();
      const startY = await drawPdfHeader(doc, title, `${displayNominees.length} nominee(s)`);

      // Prepare data for table
      const tableColumn = ["Name", "Election"];
      const tableRows = displayNominees.map((nominee: any) => {
        const nomineeElectionId =
          nominee.electionId?._id?.toString() ||
          nominee.electionId?.toString() ||
          nominee.electionId;
        const election = elections.find((e: any) => {
          const electionId = e._id?.toString() || e.id?.toString();
          return electionId === nomineeElectionId;
        });
        const fallbackTitle =
          selectedElectionId && selectedElectionId !== "all" ? title.replace(" Nominees", "") : null;

        return [
          String(nominee.name || "Unknown"),
          String(election ? getElectionLabel(election) : fallbackTitle || "Unknown Election"),
        ];
      });

      autoTable(doc, {
        ...brandedTableTheme,
        startY,
        head: [tableColumn],
        body: tableRows,
      });

      drawPdfFooter(doc);
      doc.save(`${title.replace(/\s+/g, "_")}_${new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}.pdf`);

      toast({
        title: "PDF Exported",
        description: "Nominees list has been exported to PDF successfully",
        variant: "success",
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export nominees to PDF",
        variant: "destructive"
      });
    }
  };
  
  // Export nominee data to Excel
  const exportToExcel = async () => {
    try {
      const displayNominees = await fetchAllNomineesForExport();
      // Prepare data for Excel
      const excelData = displayNominees.map((nominee: any) => {
        const election = elections.find((e: any) => {
          const electionId = e._id?.toString() || e.id?.toString();
          const nomineeElectionId = nominee.electionId?._id?.toString() || 
                                nominee.electionId?.toString() || 
                                nominee.electionId;
          return electionId === nomineeElectionId;
        });
        
        return {
          'Name': nominee.name || 'Unknown',
          'Election': election ? getElectionLabel(election) : 'Unknown Election'
        };
      });
      
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Convert data to worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      worksheet["!cols"] = autoSizeColumns(excelData);

      // Get the title for the Excel sheet based on selected election
      let title = "All Nominees";
      if (selectedElectionId && selectedElectionId !== 'all') {
        const election = elections.find((e: any) => {
          const electionId = e._id?.toString() || e.id?.toString();
          return electionId === selectedElectionId;
        });
        if (election) {
          title = `${getElectionLabel(election)} Nominees`;
        }
      }
      
      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Nominees");
      
      // Generate Excel file and trigger download
      XLSX.writeFile(workbook, `${title.replace(/\s+/g, '_')}_${new Date().toLocaleDateString("en-GB").replace(/\//g, '-')}.xlsx`);
      
      toast({
        title: "Excel Exported",
        description: "Nominees list has been exported to Excel successfully",
        variant: "success"
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export nominees to Excel",
        variant: "destructive"
      });
    }
  };

  // Handle add nominee dialog
  const handleAddNominee = () => {
    setIsAddNomineeOpen(true);
  };

  useEffect(() => {
    if (!embedded) document.title = "Nominees | Vote+";
  }, [embedded]);

  // When embedded inside an election workspace, the election is fixed and the
  // nominee form should pre-select it.
  const formElections = embedded
    ? elections.filter((e: any) => (e._id?.toString() || e.id?.toString()) === selectedElectionId)
    : elections;

  // Show the gender column only when a single, gender-based election is selected.
  const selectedElectionGenderBased =
    selectedElectionId !== 'all' &&
    !!elections.find(
      (e: any) =>
        (e._id?.toString() || e.id?.toString()) === selectedElectionId
    )?.genderBasedSelection;

  const selectedElection = elections.find(
    (e: { _id?: string; id?: string; status?: string }) =>
      (e._id?.toString() || e.id?.toString()) === selectedElectionId
  );
  const isReadOnly =
    readOnly ||
    (selectedElectionId !== "all" && isElectionLocked(selectedElection?.status));

  const Wrapper = embedded ? Fragment : MainLayout;

  return (
    <Wrapper>
      {!embedded && (
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Nominees</h1>
          <p className="text-sm text-gray-600">Manage candidates for your elections</p>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:mb-6">
        {!embedded && (
          <Select value={selectedElectionId} onValueChange={handleElectionChange}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Select Election" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Elections</SelectItem>
              {electionsLoading ? (
                <SelectItem value="loading" disabled>Loading elections...</SelectItem>
              ) : (
                elections.map((election: any) => (
                  <SelectItem
                    key={election._id || election.id}
                    value={election._id?.toString() || election.id?.toString()}
                  >
                    {getElectionLabel(election)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search nominees..."
            value={searchInput}
            onChange={handleSearchChange}
            className="min-w-0 flex-1 sm:max-w-md"
          />
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {!isReadOnly && (
              <Button
                size="sm"
                className="w-11 shrink-0 p-0 sm:w-auto sm:px-3"
                onClick={handleAddNominee}
                aria-label="Add nominee"
              >
                <PlusIcon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline sm:ml-2 whitespace-nowrap">Nominee</span>
              </Button>
            )}
            <ExportMenu
              onExportPdf={exportToPDF}
              onExportExcel={exportToExcel}
              disabled={totalNominees === 0}
              iconOnlyOnMobile
            />
            {!isReadOnly && (
              <DeleteModeButton
                active={selection.deleteMode}
                onClick={() =>
                  selection.deleteMode ? selection.exitDeleteMode() : selection.enterDeleteMode()
                }
              />
            )}
          </div>
        </div>
      </div>

      {electionsError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load elections. Please try again later.
          </AlertDescription>
        </Alert>
      )}

      <Card className={embedded ? "border-0 shadow-none" : undefined}>
        {!embedded && (
          <CardHeader className="px-4 py-3 md:px-6">
            <CardTitle>Nominees List</CardTitle>
          </CardHeader>
        )}
        <CardContent className={embedded ? "p-0" : "px-4 md:px-6"}>
          {nomineesLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : nomineesError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to load nominees. Please try again later.
              </AlertDescription>
            </Alert>
          ) : totalNominees === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500">No nominees found. Add some nominees to get started.</p>
            </div>
          ) : (
            <div>
              {!isReadOnly && (
                <DeleteModeBar
                  active={selection.deleteMode}
                  count={selection.selectedCount}
                  entityLabel="nominee"
                  onCancel={selection.exitDeleteMode}
                  onConfirmDelete={handleBulkDeleteClick}
                  deleting={deleteNomineesMutation.isPending}
                />
              )}
              <div className="space-y-3 lg:hidden">
                {paginatedNominees.map((nominee: any) => {
                  const nomineeId = getNomineeId(nominee);
                  const election = elections.find((e: any) => {
                    const electionId = e._id?.toString() || e.id?.toString();
                    const nomineeElectionId = nominee.electionId?._id?.toString() ||
                                          nominee.electionId?.toString() ||
                                          nominee.electionId;
                    return electionId === nomineeElectionId;
                  });

                  return (
                    <div
                      key={nomineeId}
                      className="rounded-lg border border-gray-200 bg-white p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {selection.showSelectors && (
                            <RowSelectCheckbox
                              checked={selection.isSelected(nomineeId)}
                              onCheckedChange={() => selection.toggle(nomineeId)}
                              aria-label={`Select ${nominee.name}`}
                            />
                          )}
                          <NomineeAvatar nominee={nominee} size="md" />
                          <div className="min-w-0">
                            <h3 className="text-sm md:text-base font-medium text-gray-900 truncate">{nominee.name}</h3>
                            {!embedded && (
                              <p className="text-xs text-gray-500 truncate">
                                {election ? getElectionLabel(election) : "Unknown Election"}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {selectedElectionGenderBased && nominee.gender && (
                            <Badge variant="outline" className="capitalize text-xs">
                              {nominee.gender}
                            </Badge>
                          )}
                          {!isReadOnly && !selection.deleteMode && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`Edit ${nominee.name}`}
                                onClick={() => handleEditNominee(nominee)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-900 hover:bg-red-50"
                                aria-label={`Delete ${nominee.name}`}
                                onClick={() => handleDeleteClick(nomineeId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden overflow-auto lg:block">
                <Table>
                <TableHeader>
                  <TableRow>
                    {selection.showSelectors && (
                      <TableHead className="w-6 px-1">
                        <RowSelectCheckbox
                          checked={selection.allSelected ? true : selection.someSelected ? "indeterminate" : false}
                          onCheckedChange={() => selection.toggleAll()}
                          aria-label="Select all nominees on this page"
                        />
                      </TableHead>
                    )}
                    <TableHead className="w-14">
                      <span className="sr-only">Photo</span>
                    </TableHead>
                    <TableHead>Name</TableHead>
                    {selectedElectionGenderBased && <TableHead>Gender</TableHead>}
                    <TableHead>Election</TableHead>
                    {!isReadOnly && !selection.deleteMode && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedNominees.map((nominee: any) => {
                    const nomineeId = getNomineeId(nominee);
                    // Find the associated election
                    const election = elections.find((e: any) => {
                      const electionId = e._id?.toString() || e.id?.toString();
                      const nomineeElectionId = nominee.electionId?._id?.toString() || 
                                            nominee.electionId?.toString() || 
                                            nominee.electionId;
                      return electionId === nomineeElectionId;
                    });
                    
                    return (
                      <TableRow key={nomineeId}>
                        {selection.showSelectors && (
                          <TableCell className="w-6 px-1">
                            <RowSelectCheckbox
                              checked={selection.isSelected(nomineeId)}
                              onCheckedChange={() => selection.toggle(nomineeId)}
                              aria-label={`Select ${nominee.name}`}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <NomineeAvatar nominee={nominee} size="md" />
                        </TableCell>
                        <TableCell className="font-medium">{nominee.name}</TableCell>
                        {selectedElectionGenderBased && (
                          <TableCell className="capitalize">{nominee.gender || '—'}</TableCell>
                        )}
                        <TableCell>{election ? getElectionLabel(election) : 'Unknown Election'}</TableCell>
                        {!isReadOnly && !selection.deleteMode && (
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEditNominee(nominee)}>
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600 hover:text-red-900 hover:bg-red-50"
                              onClick={() => handleDeleteClick(nomineeId)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
                </Table>
              </div>
              <PaginationControls
                page={page}
                totalPages={totalNomineePages}
                total={totalNominees}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Nominee Dialog */}
      <Dialog open={isAddNomineeOpen} onOpenChange={setIsAddNomineeOpen}>
        <DialogContent className="max-w-2xl flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>Add Nominees</DialogTitle>
            <DialogDescription>
              Add nominees to an election. You can add multiple nominees at once.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="px-6 pb-6">
            <NomineeForm 
              defaultElectionId={embedded ? selectedElectionId : undefined}
              onSuccess={async (result) => {
                setIsAddNomineeOpen(false);
                await refreshNomineeLists(result?.electionId, result?.nominee);
              }}
              elections={formElections}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Edit Nominee Dialog */}
      <Dialog open={isEditNomineeOpen} onOpenChange={setIsEditNomineeOpen}>
        <DialogContent className="max-w-2xl flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>Edit Nominee</DialogTitle>
            <DialogDescription>
              Update nominee details.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="px-6 pb-6">
            <NomineeForm 
              initialData={currentNominee}
              isEdit={true}
              elections={elections}
              onSuccess={async (result) => {
                setIsEditNomineeOpen(false);
                await refreshNomineeLists(result?.electionId, result?.nominee);
              }} 
            />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDeleteIds?.length}
        onOpenChange={(open) => !open && setPendingDeleteIds(null)}
        onConfirm={confirmDelete}
        loading={deleteNomineesMutation.isPending}
        title="Are you sure?"
        description={
          pendingDeleteIds && pendingDeleteIds.length > 1
            ? `This will permanently delete ${pendingDeleteIds.length} nominees. This action cannot be undone.`
            : "This action cannot be undone. This will permanently delete the nominee."
        }
        confirmText={
          pendingDeleteIds && pendingDeleteIds.length > 1
            ? `Delete ${pendingDeleteIds.length} nominees`
            : "Delete nominee"
        }
      />
    </Wrapper>
  );
}
