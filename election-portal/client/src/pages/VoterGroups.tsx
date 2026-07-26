import { useEffect, useState, Fragment } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SelectCheckbox } from "@/components/ui/row-select-checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getStoredUser } from "@/lib/authUser";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DeleteModeBar } from "@/components/ui/delete-mode-bar";
import { DeleteModeButton } from "@/components/ui/delete-mode-button";
import { RowSelectCheckbox } from "@/components/ui/row-select-checkbox";
import { useBulkDeleteMode } from "@/hooks/useBulkDeleteMode";
import { deleteByIds } from "@/lib/bulkDelete";
import { AlertCircle, Users, PlusCircle, Trash2, ArrowLeft, Settings2, Loader2, Link2, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getElectionLabel, getElectionSubtitle } from "@/lib/electionHelpers";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageContent, PageBottom } from "@/components/layout/PageContent";
import { Pagination, type Election as AppElection } from "@/lib/types";
import { VoterSlipPrinter } from "@/components/voters/VoterSlipPrinter";
import { BulkVoterSlipPrinter } from "@/components/voters/BulkVoterSlipPrinter";
import { ExportMenu } from "@/components/ui/export-menu";
import {
  exportGroupsListToPdf,
  exportGroupsListToExcel,
  exportGroupVotersToPdf,
  exportGroupVotersToExcel,
  fetchAllVoterGroups,
  fetchGroupVoters,
  type VoterGroupExportRow,
} from "@/lib/voterGroupExport";
import {
  shufflePrefix,
  generateRandomPrefix,
  getDisplayUsername,
  buildUsernamePreview,
} from "@/lib/voterPrefix";
import {
  buildVoterGroupUrl,
  buildVoterGroupsListUrl,
  navigateVotersPage,
  useVoterPageParams,
} from "@/lib/voterGroupNav";

interface VoterGroup {
  _id: string;
  name?: string;
  description?: string;
  prefix?: string;
  voters?: string[];
  elections?: Array<string | { _id?: string; id?: string }>;
  createdAt?: string;
}

function getGroupElectionIds(g: Pick<VoterGroup, "elections">): string[] {
  return (g.elections || []).map((e) =>
    String(typeof e === "object" ? e._id || e.id : e)
  );
}

type Election = AppElection & {
  _id: string;
  title: string;
  organization: string;
};

interface GroupVoter {
  _id: string;
  username: string;
  status?: string;
  plainPassword?: string;
  sequenceNumber?: number;
  electionAccess?: string[];
  voterMetadata?: { prefix?: string; sequenceNumber?: number };
}


export default function VoterGroups({
  embedded = false,
  electionId,
  suppressTitle = false,
}: { embedded?: boolean; electionId?: string; suppressTitle?: boolean } = {}) {
  const assignOnly = embedded && !!electionId;
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const voterPageParams = useVoterPageParams();
  const syncUrl = !assignOnly;
  const [isOpen, setIsOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [pendingDeleteGroupVoterIds, setPendingDeleteGroupVoterIds] = useState<string[] | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [groupVotersPage, setGroupVotersPage] = useState(1);
  const groupVotersPageSize = 10;

  // Selected group for management view
  const [selectedGroup, setSelectedGroup] = useState<VoterGroup | null>(null);

  // Group management state
  const [selectedElectionIds, setSelectedElectionIds] = useState<string[]>([]);
  const [singleVoterUsername, setSingleVoterUsername] = useState("");
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkStart, setBulkStart] = useState(1001);
  const [bulkCount, setBulkCount] = useState(10);
  const [singleVoterOpen, setSingleVoterOpen] = useState(false);
  const [bulkVoterOpen, setBulkVoterOpen] = useState(false);
  const [printSlipsOpen, setPrintSlipsOpen] = useState(false);
  const [slipPrintVoters, setSlipPrintVoters] = useState<GroupVoter[]>([]);
  const [isExportingList, setIsExportingList] = useState(false);
  const [exportingGroupId, setExportingGroupId] = useState<string | null>(null);

  // Create dialog extended state
  const [groupDescription, setGroupDescription] = useState("");

  useEffect(() => {
    if (!embedded) document.title = "Voter Groups | Vote+";
  }, [embedded]);

  useEffect(() => {
    if (!bulkVoterOpen) return;
    setBulkPrefix(generateRandomPrefix());
  }, [bulkVoterOpen]);

  useEffect(() => {
    setGroupVotersPage(1);
  }, [selectedGroup?._id]);

  const bulkUsernamePreview = buildUsernamePreview(bulkPrefix, bulkStart, bulkCount);

  const userData = getStoredUser();
  const franchiseId = userData?.franchiseId;

  // --- Queries ---
  const { data, isLoading, error } = useQuery<{ data: VoterGroup[]; pagination?: Pagination }>({
    queryKey: ["/api/voter-groups", page],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/voter-groups?page=${page}&limit=${pageSize}`);
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  const { data: electionsData } = useQuery<{ data: Election[] }>({
    queryKey: ["/api/elections/all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/elections?limit=200");
      return res.json();
    },
  });

  const { data: groupVotersData, isLoading: votersLoading, refetch: refetchVoters } = useQuery<{
    data: GroupVoter[];
    pagination?: Pagination;
  }>({
    queryKey: ["/api/voter-groups/voters", selectedGroup?._id, groupVotersPage],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/voter-groups/${selectedGroup!._id}/voters?page=${groupVotersPage}&limit=${groupVotersPageSize}`
      );
      return res.json();
    },
    enabled: !!selectedGroup,
  });

  const { data: groupFromUrlData } = useQuery<{ data: VoterGroup }>({
    queryKey: ["/api/voter-groups", voterPageParams.groupId, "from-url"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/voter-groups/${voterPageParams.groupId}`);
      return res.json();
    },
    enabled: syncUrl && !!voterPageParams.groupId,
  });

  const elections = electionsData?.data || [];
  const assignableElections =
    assignOnly && electionId
      ? elections.filter((el) => String(el._id) === String(electionId))
      : elections;
  const groupVoters = groupVotersData?.data || [];
  const groupVotersPagination = groupVotersData?.pagination;
  const groupVotersTotal = groupVotersPagination?.total ?? groupVoters.length;
  const groups = Array.isArray(data?.data) ? data!.data : [];
  const pagination = data?.pagination;

  const applyGroupSelection = (g: VoterGroup | null, view?: "voters" | "elections") => {
    if (g) {
      setSelectedGroup(g);
      setSelectedElectionIds(getGroupElectionIds(g));
      if (view) setGroupDetailTab(view);
    } else {
      setSelectedGroup(null);
      setSelectedElectionIds([]);
      setSingleVoterUsername("");
      setGroupDetailTab("elections");
    }
  };

  const [groupDetailTab, setGroupDetailTab] = useState<"elections" | "voters">("elections");

  // When entering a group, seed election selection from group data
  const openGroup = (g: VoterGroup, view?: "voters" | "elections") => {
    applyGroupSelection(g, view);
    if (syncUrl) {
      navigateVotersPage(buildVoterGroupUrl(g._id, view), navigate);
    }
  };

  const closeGroup = () => {
    applyGroupSelection(null);
    if (syncUrl) {
      navigateVotersPage(buildVoterGroupsListUrl(), navigate);
    }
  };

  // Restore selected group from URL (?tab=groups&group=...)
  useEffect(() => {
    if (!syncUrl) return;
    const { groupId, view } = voterPageParams;
    if (!groupId) {
      if (selectedGroup) applyGroupSelection(null);
      return;
    }
    const match =
      groups.find((g) => g._id === groupId) || groupFromUrlData?.data || null;
    if (!match) return;
    if (selectedGroup?._id !== groupId) {
      applyGroupSelection(match, view || undefined);
    } else if (view && groupDetailTab !== view) {
      setGroupDetailTab(view);
    }
  }, [
    syncUrl,
    voterPageParams.groupId,
    voterPageParams.view,
    groups,
    groupFromUrlData?.data,
    selectedGroup?._id,
    groupDetailTab,
  ]);

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/voter-groups", {
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        franchiseId: franchiseId || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Voter group created", variant: "success" });
      setIsOpen(false);
      setGroupName("");
      setGroupDescription("");
      queryClient.invalidateQueries({ queryKey: ["/api/voter-groups"] });
    },
    onError: (err: Error) => {
      toast({ title: "Could not create group", description: err.message, variant: "destructive" });
    },
  });

  const groupPageIds = groups.map((g) => g._id).filter(Boolean);
  const selection = useBulkDeleteMode(groupPageIds);

  const exportList = async (format: "pdf" | "excel") => {
    setIsExportingList(true);
    try {
      const allGroups = await fetchAllVoterGroups();
      if (allGroups.length === 0) {
        toast({ title: "Nothing to export", description: "No voter groups found.", variant: "destructive" });
        return;
      }
      if (format === "pdf") {
        const result = await exportGroupsListToPdf(allGroups);
        if (result.saved) {
          toast({
            title: "PDF exported",
            description: `${allGroups.length} group(s) exported.`,
            variant: "success",
          });
        }
      } else {
        const result = await exportGroupsListToExcel(allGroups);
        if (result.saved) {
          toast({
            title: "Excel exported",
            description: `${allGroups.length} group(s) exported.`,
            variant: "success",
          });
        }
      }
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsExportingList(false);
    }
  };

  const exportGroupVoters = async (
    group: VoterGroupExportRow,
    format: "pdf" | "excel"
  ) => {
    setExportingGroupId(group._id);
    try {
      const voters = await fetchGroupVoters(group._id);
      if (voters.length === 0) {
        toast({
          title: "Nothing to export",
          description: "This group has no voters yet.",
          variant: "destructive",
        });
        return;
      }
      const name = group.name || "Voter Group";
      const result =
        format === "pdf"
          ? await exportGroupVotersToPdf(name, voters, elections)
          : await exportGroupVotersToExcel(name, voters, elections);
      if (result.saved) {
        toast({
          title: format === "pdf" ? "PDF exported" : "Excel exported",
          description: `${voters.length} voter(s) from "${name}" exported.`,
          variant: "success",
        });
      }
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setExportingGroupId(null);
    }
  };

  const openGroupPrintSlips = async (group: VoterGroupExportRow) => {
    setExportingGroupId(group._id);
    try {
      const voters = await fetchGroupVoters(group._id);
      if (voters.length === 0) {
        toast({
          title: "No voters to print",
          description: "This group has no voters yet.",
          variant: "destructive",
        });
        return;
      }
      setSlipPrintVoters(voters);
      setPrintSlipsOpen(true);
    } catch (err) {
      toast({
        title: "Could not load voters",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setExportingGroupId(null);
    }
  };

  const deleteGroupsMutation = useMutation({
    mutationFn: async (ids: string[]) => deleteByIds(ids, (id) => `/api/voter-groups/${id}`),
    onSuccess: (result, ids) => {
      setPendingDeleteIds(null);
      selection.exitDeleteMode();
      if (selectedGroup && ids.includes(selectedGroup._id)) closeGroup();
      queryClient.invalidateQueries({ queryKey: ["/api/voter-groups"] });

      toast({
        title: ids.length === 1 ? "Voter group deleted" : "Voter groups deleted",
        description:
          result.failed.length === 0
            ? ids.length === 1
              ? "The voter group has been deleted."
              : `${result.deleted.length} group(s) deleted successfully.`
            : `${result.deleted.length} deleted, ${result.failed.length} failed.`,
        variant: result.failed.length ? "destructive" : "success",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Could not delete group(s)", description: err.message, variant: "destructive" });
      setPendingDeleteIds(null);
    },
  });

  const groupVoterPageIds = groupVoters.map((v) => v._id).filter(Boolean);
  const groupVoterSelection = useBulkDeleteMode(groupVoterPageIds);

  const deleteGroupVotersMutation = useMutation({
    mutationFn: async (ids: string[]) => deleteByIds(ids, (id) => `/api/users/voters/${id}`),
    onSuccess: (result, ids) => {
      setPendingDeleteGroupVoterIds(null);
      groupVoterSelection.exitDeleteMode();
      queryClient.invalidateQueries({ queryKey: ["/api/voter-groups/voters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voter-groups"] });

      toast({
        title: ids.length === 1 ? "Voter deleted" : "Voters deleted",
        description:
          result.failed.length === 0
            ? ids.length === 1
              ? "The voter has been deleted."
              : `${result.deleted.length} voter(s) deleted successfully.`
            : `${result.deleted.length} deleted, ${result.failed.length} failed.`,
        variant: result.failed.length ? "destructive" : "success",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Could not delete voter(s)", description: err.message, variant: "destructive" });
      setPendingDeleteGroupVoterIds(null);
    },
  });

  const assignElectionsMutation = useMutation({
    mutationFn: async (electionIds: string[]) => {
      const res = await apiRequest("PUT", `/api/voter-groups/${selectedGroup!._id}/elections`, { electionIds });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Elections saved", description: "Voter access updated for all group members.", variant: "success" });
      if (data?.data) setSelectedGroup(data.data);
      queryClient.invalidateQueries({ queryKey: ["/api/voter-groups"] });
      if (assignOnly) closeGroup();
    },
    onError: (err: Error) => {
      toast({ title: "Could not save elections", description: err.message, variant: "destructive" });
    },
  });

  const addSingleVoterMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/voter-groups/${selectedGroup!._id}/voter`, {
        username: singleVoterUsername.trim(),
      });
      return res.json();
    },
    onSuccess: (data) => {
      const credential = data?.data?.plainPassword
        ? [{
            _id: data.data.id,
            username: data.data.username,
            plainPassword: data.data.plainPassword,
          }]
        : [];
      toast({
        title: "Voter created",
        description: `${data.data.username} created. Print or save the credential now.`,
        variant: "success",
      });
      setSlipPrintVoters(credential);
      setPrintSlipsOpen(credential.length > 0);
      setSingleVoterUsername("");
      setSingleVoterOpen(false);
      refetchVoters();
      queryClient.invalidateQueries({ queryKey: ["/api/voter-groups"] });
    },
    onError: (err: Error) => {
      toast({ title: "Could not create voter", description: err.message, variant: "destructive" });
    },
  });

  const bulkGenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/voter-groups/${selectedGroup!._id}/generate`, {
        prefix: bulkPrefix.trim(),
        shuffledPrefix: bulkPrefix.trim(),
        startingNumber: bulkStart,
        count: bulkCount,
        franchiseId: franchiseId || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      const generatedCredentials = Array.isArray(data?.data) ? data.data : [];
      toast({
        title: `${data.count} voters created`,
        description: "Print them now or reprint them later from the voter group.",
        variant: "success",
      });
      setSlipPrintVoters(generatedCredentials);
      setPrintSlipsOpen(generatedCredentials.length > 0);
      setBulkVoterOpen(false);
      refetchVoters();
      queryClient.invalidateQueries({ queryKey: ["/api/voter-groups"] });
    },
    onError: (err: Error) => {
      toast({ title: "Bulk creation failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleElection = (id: string) => {
    const idStr = String(id);
    setSelectedElectionIds((prev) =>
      prev.map(String).includes(idStr)
        ? prev.filter((e) => String(e) !== idStr)
        : [...prev, idStr]
    );
  };

  const Wrapper = embedded ? Fragment : MainLayout;

  // Group detail / assign view
  if (selectedGroup) {
    const electionAssignCard = (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {assignOnly ? "Assign Election to Group" : "Assign Elections to this Group"}
          </CardTitle>
          <p className="text-sm text-gray-500">
            {assignOnly
              ? "Voters in this group will get access to this election when assigned."
              : "Voters in this group will have access to the selected elections."}
          </p>
        </CardHeader>
        <CardContent>
          {assignableElections.length === 0 ? (
            <p className="text-sm text-gray-500">No elections available.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {assignableElections.map((el) => {
                const subtitle = getElectionSubtitle(el);
                return (
                  <div
                    key={el._id}
                    className="flex items-center gap-2 rounded-md p-2 hover:bg-primary/5"
                  >
                    <SelectCheckbox
                      checked={selectedElectionIds.map(String).includes(String(el._id))}
                      onCheckedChange={() => toggleElection(el._id)}
                      aria-label={`Assign ${getElectionLabel(el)}`}
                    />
                    <div className="min-w-0 text-sm">
                      <span className="font-medium text-gray-900">{getElectionLabel(el)}</span>
                      {subtitle ? (
                        <span className="ml-1 text-xs text-gray-500">({subtitle})</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Button
            className="mt-4"
            onClick={() => assignElectionsMutation.mutate(selectedElectionIds)}
            disabled={assignElectionsMutation.isPending}
          >
            {assignElectionsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : assignOnly ? (
              "Assign Election"
            ) : (
              "Save Elections"
            )}
          </Button>
        </CardContent>
      </Card>
    );

    if (assignOnly) {
      return (
        <Wrapper>
          <div className="mb-4 flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={closeGroup} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> All Groups
            </Button>
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {selectedGroup.name || "Voter Group"}
            </h2>
          </div>
          {electionAssignCard}
        </Wrapper>
      );
    }

    return (
      <Wrapper>
        <div className="mb-4 space-y-3">
          <Button variant="ghost" size="sm" onClick={closeGroup} className="gap-1 -ml-2 w-fit">
            <ArrowLeft className="h-4 w-4" /> All Groups
          </Button>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold leading-tight text-gray-900 sm:text-xl">
                {selectedGroup.name || "Voter Group"}
              </h1>
              <Badge variant="outline" className="h-6 text-xs font-medium">
                {groupVotersTotal} voter{groupVotersTotal === 1 ? "" : "s"}
              </Badge>
            </div>
            <ExportMenu
              iconOnly
              onExportPdf={() => exportGroupVoters(selectedGroup, "pdf")}
              onExportExcel={() => exportGroupVoters(selectedGroup, "excel")}
              onPrintSlips={async () => {
                const voters = await fetchGroupVoters(selectedGroup._id);
                if (voters.length === 0) {
                  toast({
                    title: "No voters to print",
                    description: "Add voters to this group first.",
                    variant: "destructive",
                  });
                  return;
                }
                setSlipPrintVoters(voters);
                setPrintSlipsOpen(true);
              }}
              disabled={
                exportingGroupId === selectedGroup._id ||
                (groupVotersTotal === 0 && !votersLoading)
              }
            />
          </div>
        </div>

        <Tabs
          value={groupDetailTab}
          onValueChange={(v) => {
            const tab = v as "elections" | "voters";
            setGroupDetailTab(tab);
            if (syncUrl && selectedGroup) {
              navigateVotersPage(buildVoterGroupUrl(selectedGroup._id, tab), navigate);
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="elections">Elections</TabsTrigger>
            <TabsTrigger value="voters">Voters</TabsTrigger>
          </TabsList>

          <TabsContent value="elections" className="mt-4">
            {electionAssignCard}
          </TabsContent>
          <TabsContent value="voters" className="mt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-800">Group Voters</h2>
              <div className="flex items-center gap-2">
                {/* Single voter */}
                <Dialog open={singleVoterOpen} onOpenChange={(open) => {
                    setSingleVoterOpen(open);
                    if (!open) setSingleVoterUsername("");
                  }}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 justify-center gap-1.5 px-3 text-xs font-medium"
                    >
                      <PlusCircle className="h-4 w-4 shrink-0" />
                      <span className="truncate">Add Voter</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Voter</DialogTitle>
                      <DialogDescription>
                        Create a new voter account and add them to this group.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-1">
                      <div className="space-y-1">
                        <Label>Username *</Label>
                        <Input
                          value={singleVoterUsername}
                          onChange={(e) => setSingleVoterUsername(e.target.value)}
                          placeholder="e.g. VOTE1001"
                          autoFocus
                        />
                      </div>
                      <p className="text-xs text-gray-500">A unique random password will be generated automatically.</p>
                    </div>

                    <DialogFooter>
                      <Button
                        onClick={() => addSingleVoterMutation.mutate()}
                        disabled={!singleVoterUsername.trim() || addSingleVoterMutation.isPending}
                      >
                        {addSingleVoterMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : 'Create Voter'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Bulk voters */}
                <Dialog open={bulkVoterOpen} onOpenChange={setBulkVoterOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="h-9 justify-center gap-1.5 px-3 text-xs font-medium"
                    >
                      <Users className="h-4 w-4 shrink-0" />
                      <span className="truncate">Bulk Create</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Bulk Create Voters</DialogTitle>
                      <DialogDescription>
                        Generating for <strong>{selectedGroup?.name}</strong>.
                        {selectedGroup?.description && <span className="block text-xs text-gray-400 mt-0.5">{selectedGroup.description}</span>}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <div className="space-y-1">
                        <Label>Prefix</Label>
                        <div className="flex gap-2">
                          <Input
                            value={bulkPrefix}
                            onChange={(e) => setBulkPrefix(e.target.value.toUpperCase())}
                            placeholder="e.g. KXRM"
                            className="font-mono"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            title="Generate new random prefix"
                            onClick={() =>
                              setBulkPrefix((current) => shufflePrefix(current))
                            }
                          >
                            <Shuffle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Starting #</Label>
                          <Input type="number" value={bulkStart} onChange={(e) => setBulkStart(parseInt(e.target.value) || 1)} min={1} />
                        </div>
                        <div className="space-y-1">
                          <Label>Count</Label>
                          <Input type="number" value={bulkCount} onChange={(e) => setBulkCount(Math.min(parseInt(e.target.value) || 1, 1000))} min={1} max={1000} />
                        </div>
                      </div>
                      <p className="text-xs text-blue-600 bg-blue-50 rounded p-2">
                        Usernames: <strong>{bulkUsernamePreview.from}</strong> to{" "}
                        <strong>{bulkUsernamePreview.to}</strong> ? unique random passwords.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => bulkGenerateMutation.mutate()}
                        disabled={bulkGenerateMutation.isPending}
                      >
                        {bulkGenerateMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : `Generate ${bulkCount} Voters`}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <DeleteModeButton
                  active={groupVoterSelection.deleteMode}
                  onClick={() =>
                    groupVoterSelection.deleteMode
                      ? groupVoterSelection.exitDeleteMode()
                      : groupVoterSelection.enterDeleteMode()
                  }
                />
              </div>
            </div>

            {votersLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : groupVotersTotal === 0 ? (
              <Card><CardContent className="py-10 text-center text-gray-500">No voters in this group yet. Add voters above.</CardContent></Card>
            ) : (
              <div className="space-y-3">
              <DeleteModeBar
                active={groupVoterSelection.deleteMode}
                count={groupVoterSelection.selectedCount}
                entityLabel="voter"
                onCancel={groupVoterSelection.exitDeleteMode}
                onConfirmDelete={() =>
                  groupVoterSelection.selectedCount > 0 &&
                  setPendingDeleteGroupVoterIds([...groupVoterSelection.selectedIds])
                }
                deleting={deleteGroupVotersMutation.isPending}
              />
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white border-b">
                    <tr>
                      {groupVoterSelection.showSelectors && (
                        <th className="w-7 px-1 py-2">
                          <RowSelectCheckbox
                            checked={
                              groupVoterSelection.allSelected
                                ? true
                                : groupVoterSelection.someSelected
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={() => groupVoterSelection.toggleAll()}
                            aria-label="Select all voters on this page"
                          />
                        </th>
                      )}
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Username</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Password</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {groupVoters.map((v) => (
                      <tr key={v._id} className="hover:bg-primary/5">
                        {groupVoterSelection.showSelectors && (
                          <td className="w-7 px-1 py-2">
                            <RowSelectCheckbox
                              checked={groupVoterSelection.isSelected(v._id)}
                              onCheckedChange={() => groupVoterSelection.toggle(v._id)}
                              aria-label={`Select ${getDisplayUsername(v)}`}
                            />
                          </td>
                        )}
                        <td className="px-4 py-2 font-mono">{getDisplayUsername(v)}</td>
                        <td className="px-4 py-2 font-mono text-gray-600">{(v as any).plainPassword || <span className="text-gray-400 italic">hidden</span>}</td>
                        <td className="px-4 py-2">
                          <Badge variant={v.status === "active" ? "default" : "secondary"}>{v.status || "active"}</Badge>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            <VoterSlipPrinter voter={v as any} electionNames={elections.filter(e => (v.electionAccess || []).includes(e._id)).map(e => getElectionLabel(e))} />
                            {!groupVoterSelection.deleteMode && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setPendingDeleteGroupVoterIds([v._id])}
                                title="Delete voter"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {groupVotersPagination && groupVotersPagination.total > 0 && (
                <PaginationControls
                  page={groupVotersPagination.page}
                  totalPages={groupVotersPagination.totalPages ?? 1}
                  total={groupVotersPagination.total}
                  pageSize={groupVotersPagination.pageSize}
                  onPageChange={setGroupVotersPage}
                />
              )}
              </div>
            )}
          </TabsContent>
        </Tabs>
        <BulkVoterSlipPrinter
          voters={slipPrintVoters}
          elections={elections}
          open={printSlipsOpen}
          onOpenChange={setPrintSlipsOpen}
          hideTrigger
          title={selectedGroup ? `${selectedGroup.name} · Print Slips` : undefined}
        />
        <ConfirmDialog
          open={!!pendingDeleteGroupVoterIds?.length}
          onOpenChange={(open) => !open && setPendingDeleteGroupVoterIds(null)}
          onConfirm={() =>
            pendingDeleteGroupVoterIds?.length &&
            deleteGroupVotersMutation.mutate(pendingDeleteGroupVoterIds)
          }
          loading={deleteGroupVotersMutation.isPending}
          title="Are you sure?"
          description={
            pendingDeleteGroupVoterIds && pendingDeleteGroupVoterIds.length > 1
              ? `This will permanently delete ${pendingDeleteGroupVoterIds.length} voter accounts. This action cannot be undone.`
              : "This will permanently delete this voter account. This action cannot be undone."
          }
          confirmText={
            pendingDeleteGroupVoterIds && pendingDeleteGroupVoterIds.length > 1
              ? `Delete ${pendingDeleteGroupVoterIds.length} voters`
              : "Delete voter"
          }
        />
      </Wrapper>
    );
  }

  // ?? Group list view ????????????????????????????????????????????????????????
  return (
    <Wrapper>
      <PageContent>
      <div className={cn("mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between", suppressTitle && "sm:justify-end")}>
        {!suppressTitle && (
        <div>
          <h1 className={embedded ? "text-lg font-semibold text-gray-900 flex items-center gap-2" : "text-2xl font-bold text-gray-900 flex items-center gap-2"}>
            <Users className={embedded ? "h-5 w-5 text-primary" : "h-6 w-6 text-primary"} />
            Voter Groups
          </h1>
          <p className="text-sm text-gray-500 mt-1">Create groups, assign elections, and manage voters inside each group.</p>
        </div>
        )}
        <div className={cn(
          "flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end",
          suppressTitle && "w-full"
        )}>
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
              setIsOpen(false);
              setGroupName("");
              setGroupDescription("");
            } else {
              setIsOpen(true);
            }
          }}>
          <DialogTrigger asChild>
            <Button size="sm" className="flex-1 justify-center gap-1.5 sm:flex-none">
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">Add group</span>
                <span className="hidden sm:inline">New Group</span>
              </span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Voter Group</DialogTitle>
              <DialogDescription>Set up the group details. You can add voters after creation.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (groupName.trim()) createMutation.mutate(); }} className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="gname">Group Name *</Label>
                <Input id="gname" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Block A Voters" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gdesc">Description <span className="text-gray-400 text-xs font-normal">(optional)</span></Label>
                <Input id="gdesc" value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} placeholder="e.g. Voters from Ward 3" />
              </div>
              <DialogFooter className="pt-2">
                <Button type="submit" disabled={!groupName.trim() || createMutation.isPending}>
                  {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : "Create Group"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <div className="flex items-center gap-2">
          {!selection.deleteMode && !assignOnly && (
            <ExportMenu
              onExportPdf={() => exportList("pdf")}
              onExportExcel={() => exportList("excel")}
              disabled={isExportingList || groups.length === 0}
              iconOnly
            />
          )}
          <DeleteModeButton
            active={selection.deleteMode}
            onClick={() =>
              selection.deleteMode ? selection.exitDeleteMode() : selection.enterDeleteMode()
            }
          />
        </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load voter groups</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
      ) : groups.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-500">No voter groups yet. Create one to get started.</CardContent></Card>
      ) : (
        <>
          <DeleteModeBar
            active={selection.deleteMode}
            count={selection.selectedCount}
            entityLabel="group"
            onCancel={selection.exitDeleteMode}
            onConfirmDelete={() => selection.selectedCount > 0 && setPendingDeleteIds([...selection.selectedIds])}
            deleting={deleteGroupsMutation.isPending}
          />
          {selection.showSelectors && groups.length > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-md border bg-white px-3 py-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary"
                onClick={() => selection.toggleAll()}
                aria-label="Select all groups on this page"
              >
                <RowSelectCheckbox
                  checked={
                    selection.allSelected
                      ? true
                      : selection.someSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={() => selection.toggleAll()}
                  aria-label="Select all groups on this page"
                />
                <span>{selection.allSelected ? "Clear selection" : "Select all on this page"}</span>
              </button>
              <span className="text-xs text-gray-500">{groups.length} shown</span>
            </div>
          )}
          <div className="space-y-3 md:space-y-4 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
          {groups.map((g) => {
            const voterCount = g.voters?.length ?? 0;
            const canExport = !selection.deleteMode && !assignOnly && voterCount > 0;

            return (
            <div key={g._id} className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {selection.showSelectors && (
                    <RowSelectCheckbox
                      checked={selection.isSelected(g._id)}
                      onCheckedChange={() => selection.toggle(g._id)}
                      aria-label={`Select ${g.name || "group"}`}
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-base font-medium text-gray-900 truncate">
                      {g.name || "Untitled"}
                    </h3>
                    {g.description && (
                      <p className="text-xs text-gray-500 truncate">
                        {g.description}
                      </p>
                    )}
                  </div>
                </div>
                {!selection.deleteMode && (
                  <div className="flex shrink-0 items-center gap-1">
                    {canExport && (
                      <ExportMenu
                        iconOnly
                        onExportPdf={() => exportGroupVoters(g, "pdf")}
                        onExportExcel={() => exportGroupVoters(g, "excel")}
                        onPrintSlips={() => openGroupPrintSlips(g)}
                        disabled={exportingGroupId === g._id}
                      />
                    )}
                    {assignOnly ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openGroup(g)}
                            aria-label={`Assign ${g.name || "group"}`}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Assign elections</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openGroup(g)}
                            aria-label={`Manage ${g.name || "group"}`}
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Manage group</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setPendingDeleteIds([g._id])}
                          aria-label={`Delete ${g.name || "group"}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete group</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="inline-flex items-center font-medium text-gray-700">
                  {voterCount} voter{voterCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center font-medium text-gray-700">
                  {getGroupElectionIds(g).length} election{getGroupElectionIds(g).length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            );
          })}
        </div>
        </>
      )}

      {pagination && pagination.total > 0 && (
        <PageBottom>
          <PaginationControls
            page={pagination.page}
            totalPages={pagination.totalPages ?? 1}
            total={pagination.total}
            pageSize={pagination.pageSize}
            onPageChange={setPage}
          />
        </PageBottom>
      )}

      <ConfirmDialog
        open={!!pendingDeleteIds?.length}
        onOpenChange={(open) => !open && setPendingDeleteIds(null)}
        onConfirm={() => pendingDeleteIds?.length && deleteGroupsMutation.mutate(pendingDeleteIds)}
        loading={deleteGroupsMutation.isPending}
        title="Are you sure?"
        description={
          pendingDeleteIds && pendingDeleteIds.length > 1 ? (
            <>This will permanently delete {pendingDeleteIds.length} voter groups. Voters inside will not be deleted.</>
          ) : (
            <>
              This will permanently delete{" "}
              <span className="font-semibold">
                {groups.find((g) => g._id === pendingDeleteIds?.[0])?.name || "this group"}
              </span>
              . Voters inside will not be deleted.
            </>
          )
        }
        confirmText={
          pendingDeleteIds && pendingDeleteIds.length > 1
            ? `Delete ${pendingDeleteIds.length} groups`
            : "Delete group"
        }
      />
      <BulkVoterSlipPrinter
        voters={slipPrintVoters}
        elections={elections}
        open={printSlipsOpen}
        onOpenChange={setPrintSlipsOpen}
        hideTrigger
      />
      </PageContent>
    </Wrapper>
  );
}
