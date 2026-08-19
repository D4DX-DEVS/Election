import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { PlusIcon, Pencil, Trash2, FolderPlus, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompactList, CompactListActions, CompactListPrimary, CompactListRow, CompactListSecondary } from "@/components/ui/compact-list";
import { AddButton } from "@/components/ui/add-button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { extractApiList, normalizeEntityId } from "@/lib/apiHelpers";
import { ElectionMultiPicker } from "@/components/elections/ElectionMultiPicker";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageContent, PageHeader, PageBottom } from "@/components/layout/PageContent";
import { Pagination } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type EntityRef = string | number | { _id?: string; toString: () => string };

interface ElectionGroupRecord {
  _id?: string;
  id?: string | number;
  name: string;
  description?: string;
  franchiseId?: EntityRef;
  createdAt?: string | Date;
  elections?: Array<string | number | { _id?: string; id?: string; title?: string }>;
}

interface FranchiseOption {
  _id?: string;
  id?: string | number;
  name: string;
}

interface ElectionOption {
  _id?: string;
  id?: string | number;
  title?: string;
  organization?: string;
  franchiseId?: EntityRef;
  electionGroupId?: EntityRef;
}

interface AuthUser {
  franchiseId?: string;
  role?: string;
}

function getEntityId(value?: EntityRef): string {
  return normalizeEntityId(value);
}

function getGroupElectionIds(group: ElectionGroupRecord): string[] {
  if (!Array.isArray(group.elections)) return [];
  return group.elections
    .map((e) =>
      typeof e === "object" && e !== null
        ? getEntityId(e._id ?? e.id)
        : getEntityId(e)
    )
    .filter(Boolean);
}

export default function ElectionGroups() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  // Get the user data to get franchiseId for admins
  const { data: userData } = useQuery<AuthUser>({ queryKey: ['/api/auth/me'] });
  const userFranchiseId = userData?.franchiseId;
  const userRole = userData?.role;

  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    franchiseId: ''
  });
  const [createElectionIds, setCreateElectionIds] = useState<string[]>([]);
  const [editFormData, setEditFormData] = useState({
    id: '',
    name: '',
    description: '',
    elections: [] as string[],
  });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch election groups with proper handling for the API response format
  const {
    data: electionGroupsRawData,
    isLoading: electionGroupsLoading,
    isError: electionGroupsError,
    refetch: refetchElectionGroups
  } = useQuery<{ data: ElectionGroupRecord[]; pagination?: Pagination }>({
    queryKey: ['/api/election-groups', page],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/election-groups?page=${page}&limit=${pageSize}`);
      return res.json();
    },
    placeholderData: (prev) => prev,
  });
  
  const {
    data: franchisesRawData,
    isLoading: franchisesLoading,
    isError: franchisesError
  } = useQuery({
    queryKey: ['/api/franchises'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/franchises');
      return res.json();
    },
  });

  const {
    data: electionsRawData,
    isLoading: electionsLoading,
    isError: electionsError
  } = useQuery({
    queryKey: ['/api/elections'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/elections');
      return res.json();
    },
  });

  const allElectionGroups = extractApiList<ElectionGroupRecord>(electionGroupsRawData);
  const franchises = extractApiList<FranchiseOption>(franchisesRawData);
  const elections = extractApiList<ElectionOption>(electionsRawData);
  const electionGroups = allElectionGroups;

  const electionGroupsPagination = electionGroupsRawData?.pagination;

  const createFranchiseId =
    userRole === 'super_admin'
      ? createFormData.franchiseId
      : userFranchiseId;

  const electionsForCreate = createFranchiseId
    ? elections.filter((e) => getEntityId(e.franchiseId) === createFranchiseId)
    : elections;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      franchiseId?: string;
      elections: string[];
    }) => {
       return await apiRequest('POST', '/api/election-groups', data);
    },
    onSuccess: () => {
      toast({
        title: "Group created",
        description: "New election group has been created successfully",
        variant: "success"
      });
      setOpen(false);
      setCreateFormData({ name: '', description: '', franchiseId: '' });
      setCreateElectionIds([]);
      queryClient.invalidateQueries({ queryKey: ['/api/election-groups'] });
      refetchElectionGroups();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create group: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      name: string;
      description: string;
      elections: string[];
    }) => {
      const { id, ...updateData } = data;
      return await apiRequest('PUT', `/api/election-groups/${id}`, updateData);
    },
    onSuccess: () => {
      toast({
        title: "Group updated",
        description: "Election group has been updated successfully",
        variant: "success"
      });
      setIsEditOpen(false);
      setEditFormData({ id: '', name: '', description: '', elections: [] });
      queryClient.invalidateQueries({ queryKey: ['/api/election-groups'] });
      refetchElectionGroups();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update group: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/election-groups/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Group deleted",
        description: "Election group has been deleted successfully",
        variant: "success"
      });
      setDeleteGroupId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/election-groups'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete group: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
      setDeleteGroupId(null);
    }
  });

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare data to submit
    let dataToSubmit: {
      name: string;
      description: string;
      franchiseId?: string;
      elections: string[];
    } = {
      name: createFormData.name,
      description: createFormData.description,
      elections: createElectionIds,
    };

    // For franchise admin or election admin, use their franchiseId
    if ((userRole === 'franchise_admin' || userRole === 'election_admin') && userFranchiseId) {
      dataToSubmit.franchiseId = userFranchiseId;
    }
    // For super admin, require franchise selection
    else if (userRole === 'super_admin') {
      if (!createFormData.franchiseId) {
        toast({
          title: "Error",
          description: "Please select a franchise",
          variant: "destructive"
        });
        return;
      }
      dataToSubmit.franchiseId = createFormData.franchiseId;
    }
    createMutation.mutate(dataToSubmit);
  };

  const handleEditGroup = (id: string) => {
    // Find the group to edit
    const group = electionGroups.find(g => {
      const groupId = getEntityId(g._id || g.id);
      return groupId === id;
    });

    if (group) {
      setEditFormData({
        id,
        name: group.name,
        description: group.description || '',
        elections: getGroupElectionIds(group),
      });
      setIsEditOpen(true);
    }
  };

  const editFranchiseId = (() => {
    const group = electionGroups.find((g) => getEntityId(g._id ?? g.id) === editFormData.id);
    return group ? getEntityId(group.franchiseId) : userFranchiseId;
  })();

  const electionsForEdit = editFranchiseId
    ? elections.filter((e) => getEntityId(e.franchiseId) === editFranchiseId)
    : elections;

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    editMutation.mutate(editFormData);
  };

  const handleDeleteGroup = (id: string) => {
    setDeleteGroupId(id);
  };

  const confirmDelete = () => {
    if (deleteGroupId) {
      deleteMutation.mutate(deleteGroupId);
    }
  };

  const getElectionCount = (group: ElectionGroupRecord) => getGroupElectionIds(group).length;

  // Get franchise name
  const getFranchiseName = (franchiseId: string) => {
    const franchise = franchises?.find(f => {
      const fId = f._id?.toString() || f.id?.toString();
      return fId === franchiseId;
    });
    return franchise?.name || "Unknown";
  };

  useEffect(() => {
    document.title = "Election Groups | Vote+";
  }, []);

  return (
    <MainLayout>
      <PageContent>
      <PageHeader
        title="Election Groups"
        description="Organize and manage election groups"
        actions={
          <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setCreateElectionIds([]);
              setCreateFormData({ name: '', description: '', franchiseId: '' });
            }
          }}>
            <DialogTrigger asChild>
              <AddButton title="Create group" label="Create group" />
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <form onSubmit={handleCreateGroup}>
                <DialogHeader>
                  <DialogTitle>Create Election Group</DialogTitle>
                  <DialogDescription>
                    Create a group and add elections to it. You can change elections later via Edit.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      placeholder="Group name"
                      className="col-span-3"
                      required
                      value={createFormData.name}
                      onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">
                      Description
                    </Label>
                    <Input
                      id="description"
                      placeholder="Group description (optional)"
                      className="col-span-3"
                      value={createFormData.description}
                      onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                    />
                  </div>

                  {userRole === 'super_admin' && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="franchiseId" className="text-right">
                        Franchise
                      </Label>
                      <Select
                        value={createFormData.franchiseId}
                        onValueChange={(value) => {
                          setCreateFormData({ ...createFormData, franchiseId: value });
                          setCreateElectionIds([]);
                        }}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select a franchise" />
                        </SelectTrigger>
                        <SelectContent>
                          {franchises.map((franchise) => {
                            const id = getEntityId(franchise._id || franchise.id);
                            return (
                              <SelectItem key={id} value={id}>
                                {franchise.name}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Elections in this group</Label>
                    <p className="app-helper">
                      {createElectionIds.length > 0
                        ? `${createElectionIds.length} selected`
                        : "Optional — select elections to include now"}
                    </p>
                    {userRole === 'super_admin' && !createFormData.franchiseId ? (
                      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                        Select a franchise first to see its elections.
                      </p>
                    ) : (
                      <ElectionMultiPicker
                        elections={electionsForCreate}
                        selectedIds={createElectionIds}
                        onChange={setCreateElectionIds}
                      />
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={!createFormData.name || createMutation.isPending}
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Group"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Edit Election Group Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(o) => {
        setIsEditOpen(o);
        if (!o) setEditFormData({ id: '', name: '', description: '', elections: [] });
      }}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Election Group</DialogTitle>
              <DialogDescription>
                Update the group details and manage which elections belong to it.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="edit-name"
                  placeholder="Group name"
                  className="col-span-3"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">
                  Description
                </Label>
                <Input
                  id="edit-description"
                  placeholder="Group description (optional)"
                  className="col-span-3"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Elections in this group</Label>
                <p className="app-helper">
                  {editFormData.elections.length > 0
                    ? `${editFormData.elections.length} selected`
                    : "No elections selected"}
                </p>
                <ElectionMultiPicker
                  elections={electionsForEdit}
                  selectedIds={editFormData.elections}
                  onChange={(ids) => setEditFormData({ ...editFormData, elections: ids })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={editMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!editFormData.name || editMutation.isPending}
              >
                {editMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Group"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteGroupId !== null}
        onOpenChange={(open) => !open && setDeleteGroupId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              election group and remove its association with any elections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Election Groups</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {electionGroupsLoading ? (
            <div className="p-6 text-center">Loading groups...</div>
          ) : electionGroups && electionGroups.length > 0 ? (
            <div>
              <CompactList>
                {electionGroups.map((group) => {
                  const groupId = getEntityId(group._id || group.id);
                  const franchiseId = getEntityId(group.franchiseId);
                  const franchise = franchises.find(f =>
                    getEntityId(f._id || f.id) === franchiseId
                  );
                  const electionCount = getElectionCount(group);

                  return (
                    <CompactListRow key={groupId}>
                      <CompactListPrimary>{group.name}</CompactListPrimary>
                      <CompactListSecondary>
                        {[
                          franchise?.name || "Unknown franchise",
                          `${electionCount} election${electionCount !== 1 ? "s" : ""}`,
                        ].join(" · ")}
                      </CompactListSecondary>
                      <CompactListActions>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditGroup(groupId)} aria-label="Edit group">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-900 hover:bg-red-50"
                          onClick={() => handleDeleteGroup(groupId)}
                          aria-label="Delete group"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CompactListActions>
                    </CompactListRow>
                  );
                })}
              </CompactList>
            </div>
          ) : (
            <div className="p-12 text-center">
              <FolderPlus className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No election groups found</h3>
              <p className="mt-2 text-sm text-gray-500">
                Get started by creating a new election group.
              </p>
              <Button
                onClick={() => setOpen(true)}
                className="mt-4"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {electionGroupsPagination && electionGroupsPagination.total > 0 && (
        <PageBottom>
          <PaginationControls
            page={electionGroupsPagination.page}
            totalPages={electionGroupsPagination.totalPages ?? 1}
            total={electionGroupsPagination.total}
            pageSize={electionGroupsPagination.pageSize}
            onPageChange={setPage}
          />
        </PageBottom>
      )}
      </PageContent>
    </MainLayout>
  );
}