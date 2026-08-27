import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/apiUrl";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DeleteModeBar } from "@/components/ui/delete-mode-bar";
import { DeleteModeButton } from "@/components/ui/delete-mode-button";
import { RowSelectCheckbox } from "@/components/ui/row-select-checkbox";
import { useBulkDeleteMode } from "@/hooks/useBulkDeleteMode";
import { deleteByIds } from "@/lib/bulkDelete";
import { Pencil, Trash2, Image, Search, Building2, UsersRound } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageContent } from "@/components/layout/PageContent";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Pagination } from "@/lib/types";
import { getStoredUser } from "@/lib/authUser";
import { cn, isLettersOnlyName } from "@/lib/utils";
import { CompactList, CompactListRow, CompactListPrimary, CompactListSecondary, CompactListStatus, CompactListLeading, CompactListActions } from "@/components/ui/compact-list";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { AddButton } from "@/components/ui/add-button";

interface Franchise {
  _id: string;
  name: string;
  logo: {
    url?: string;
    alt?: string;
  };
  websiteUrl?: string;
  contactNumber?: string;
  contactEmail?: string;
  settings?: Record<string, unknown>;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface CreateFranchiseFormData {
  name: string;
  websiteUrl: string;
  contactNumber: string;
  contactEmail: string;
}

interface EditFranchiseFormData {
  id: string;
  name: string;
  websiteUrl: string;
  contactNumber: string;
  contactEmail: string;
  status?: string;
}

interface AdminFormData {
  username: string;
  fullName: string;
  password: string;
  franchiseId: string;
}

function resolveFranchiseContact(franchise: Franchise) {
  const settings = (franchise.settings ?? {}) as {
    websiteUrl?: string;
    contactNumber?: string;
    contactEmail?: string;
  };
  return {
    websiteUrl: franchise.websiteUrl || settings.websiteUrl || "",
    contactNumber: franchise.contactNumber || settings.contactNumber || "",
    contactEmail: franchise.contactEmail || settings.contactEmail || "",
  };
}

export default function Franchises() {
  // Franchise admins only manage their own franchise — the API scopes the list
  // and the update; here we hide the create/delete/admin actions they can't use.
  const [, navigate] = useLocation();
  const currentUser = getStoredUser();
  const isSuperAdmin = currentUser?.role === "super_admin";

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateFranchiseFormData>({
    name: "",
    websiteUrl: "",
    contactNumber: "",
    contactEmail: ""
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Edit franchise state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFranchiseFormData>({
    id: "",
    name: "",
    websiteUrl: "",
    contactNumber: "",
    contactEmail: "",
    status: "active"
  });
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  
  // Admin management state
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [selectedFranchise, setSelectedFranchise] = useState<Franchise | null>(null);
  const [adminFormData, setAdminFormData] = useState<AdminFormData>({
    username: "",
    fullName: "",
    password: "",
    franchiseId: ""
  });
  const [franchiseAdmins, setFranchiseAdmins] = useState<any[]>([]);
  
  // Password reset state
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [resetPasswordAdminId, setResetPasswordAdminId] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Delete confirmation state
  const [pendingDeleteFranchiseIds, setPendingDeleteFranchiseIds] = useState<string[] | null>(null);
  const [pendingDeleteAdminIds, setPendingDeleteAdminIds] = useState<string[] | null>(null);

  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [searchInput, setSearchInput] = useState("");

  // Fetch franchises using react-query (server-side pagination)
  const { data: franchisesResponse, isLoading, error } = useQuery<{ data: Franchise[]; pagination?: Pagination }>({
    queryKey: ['/api/franchises', page],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/franchises?page=${page}&limit=${pageSize}`);
      return res.json();
    },
    placeholderData: (prev) => prev,
  });
  const franchises = franchisesResponse?.data ?? [];
  const franchisesPagination = franchisesResponse?.pagination;
  const visibleFranchises = searchInput.trim()
    ? franchises.filter((f) => f.name.toLowerCase().includes(searchInput.trim().toLowerCase()))
    : franchises;

  // Create franchise mutation
  const createFranchiseMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(apiUrl("/api/franchises"), {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create franchise");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Franchise created",
        description: "The franchise has been created successfully.",
        variant: "success"
      });
      setIsCreateDialogOpen(false);
      resetCreateForm();
      queryClient.invalidateQueries({ queryKey: ['/api/franchises'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating franchise",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const adminPageIds = franchiseAdmins.map((a) => a._id).filter(Boolean);
  const adminSelection = useBulkDeleteMode(adminPageIds);

  const deleteFranchisesMutation = useMutation({
    mutationFn: async (ids: string[]) => deleteByIds(ids, (id) => `/api/franchises/${id}`),
    onSuccess: (result, ids) => {
      setPendingDeleteFranchiseIds(null);
      if (result.failed.length > 0) {
        // Surface the real reason (e.g. franchise still has data to clear first).
        toast({
          title: "Could not delete franchise",
          description: result.failed[0].error.replace(/^\d+:\s*/, ""),
          variant: "destructive",
        });
        return;
      }
      if (page > 1 && result.deleted.length >= franchises.length) {
        setPage(page - 1);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/franchises"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
      toast({
        title: ids.length === 1 ? "Franchise deleted" : "Franchises deleted",
        description: `${result.deleted.length} franchise(s) deleted successfully.`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting franchise(s)", description: error.message, variant: "destructive" });
      setPendingDeleteFranchiseIds(null);
    },
  });

  const deleteAdminsMutation = useMutation({
    mutationFn: async (ids: string[]) => deleteByIds(ids, (id) => `/api/users/${id}`),
    onSuccess: (result, ids) => {
      setPendingDeleteAdminIds(null);
      adminSelection.exitDeleteMode();
      if (selectedFranchise) {
        fetchFranchiseAdmins(selectedFranchise._id);
      }
      toast({
        title: ids.length === 1 ? "Administrator deleted" : "Administrators deleted",
        description:
          result.failed.length === 0
            ? `${result.deleted.length} administrator(s) removed.`
            : `${result.deleted.length} deleted, ${result.failed.length} failed.`,
        variant: result.failed.length ? "destructive" : "success",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting administrator(s)", description: error.message, variant: "destructive" });
      setPendingDeleteAdminIds(null);
    },
  });
  
  // Update franchise mutation
  const updateFranchiseMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const id = formData.get('id') as string;
      const response = await fetch(apiUrl(`/api/franchises/${id}`), {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update franchise");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Franchise updated",
        description: "The franchise has been updated successfully.",
        variant: "success"
      });
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/franchises'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating franchise",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Create franchise admin mutation
  const createFranchiseAdminMutation = useMutation({
    mutationFn: async (data: AdminFormData) => {
      const response = await fetch(apiUrl(`/api/users/franchise-admin`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create franchise administrator");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Admin created",
        description: "Franchise administrator has been created successfully.",
        variant: "success"
      });
      resetAdminForm();
      
      // Refresh the franchise admins list
      if (selectedFranchise) {
        fetchFranchiseAdmins(selectedFranchise._id);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating admin",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const handleCreateFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Handle file input separately
    if (name === "logo" && e.target.files && e.target.files.length > 0) {
      setLogoFile(e.target.files[0]);
    } else {
      // Handle text inputs
      setCreateFormData({
        ...createFormData,
        [name]: value
      });
    }
  };
  
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle file input separately
    if (name === "logo" && 'files' in e.target && e.target.files && e.target.files.length > 0) {
      setEditLogoFile(e.target.files[0]);
    } else {
      // Handle text inputs
      setEditFormData({
        ...editFormData,
        [name]: value
      });
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLettersOnlyName(createFormData.name)) {
      toast({
        title: "Invalid franchise name",
        description: "Name cannot contain numbers.",
        variant: "destructive",
      });
      return;
    }

    // Create FormData object for multipart/form-data submission (for file upload)
    const formData = new FormData();
    
    // Add text fields to form data
    formData.append('name', createFormData.name);
    formData.append('websiteUrl', createFormData.websiteUrl);
    formData.append('contactNumber', createFormData.contactNumber);
    formData.append('contactEmail', createFormData.contactEmail);
    
    // Add logo file if it exists
    if (logoFile) {
      formData.append('logo', logoFile);
    }
    
    // Submit the form data
    createFranchiseMutation.mutate(formData as any);
  };

  const handleDeleteFranchise = (id: string) => {
    setPendingDeleteFranchiseIds([id]);
  };

  const handleDeleteAdmin = (id: string) => {
    setPendingDeleteAdminIds([id]);
  };

  const resetCreateForm = () => {
    setCreateFormData({
      name: "",
      websiteUrl: "",
      contactNumber: "",
      contactEmail: ""
    });
    setLogoFile(null);
  };
  
  const resetEditForm = () => {
    setEditFormData({
      id: "",
      name: "",
      websiteUrl: "",
      contactNumber: "",
      contactEmail: "",
      status: "active"
    });
    setEditLogoFile(null);
  };
  
  const resetAdminForm = () => {
    setAdminFormData({
      username: "",
      fullName: "",
      password: "",
      franchiseId: selectedFranchise?._id || ""
    });
  };
  
  const handleAdminFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAdminFormData({
      ...adminFormData,
      [name]: value
    });
  };
  
  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Always derive franchiseId directly from selectedFranchise so a stale
    // adminFormData closure can never send an empty string to the API.
    createFranchiseAdminMutation.mutate({
      ...adminFormData,
      franchiseId: selectedFranchise?._id || adminFormData.franchiseId,
    });
  };
  
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLettersOnlyName(editFormData.name)) {
      toast({
        title: "Invalid franchise name",
        description: "Name cannot contain numbers.",
        variant: "destructive",
      });
      return;
    }

    // Create FormData object for multipart/form-data submission (for file upload)
    const formData = new FormData();
    
    // Add id field to form data
    formData.append('id', editFormData.id);
    
    // Add text fields to form data
    formData.append('name', editFormData.name);
    formData.append('websiteUrl', editFormData.websiteUrl);
    formData.append('contactNumber', editFormData.contactNumber);
    formData.append('contactEmail', editFormData.contactEmail);
    formData.append('status', editFormData.status || 'active');
    
    // Add logo file if it exists
    if (editLogoFile) {
      formData.append('logo', editLogoFile);
    }
    
    // Submit the form data
    updateFranchiseMutation.mutate(formData as any);
  };
  
  const handleEditFranchise = (franchise: Franchise) => {
    const settings =
      franchise.settings && typeof franchise.settings === "object"
        ? (franchise.settings as { websiteUrl?: string; contactNumber?: string; contactEmail?: string })
        : {};
    setEditFormData({
      id: franchise._id,
      name: franchise.name,
      websiteUrl: franchise.websiteUrl || settings.websiteUrl || "",
      contactNumber: franchise.contactNumber || settings.contactNumber || "",
      contactEmail: franchise.contactEmail || settings.contactEmail || "",
      status: franchise.status
    });
    setIsEditDialogOpen(true);
  };
  
  // Get franchise admins
  const fetchFranchiseAdmins = async (franchiseId: string) => {
    try {
      const response = await fetch(apiUrl(`/api/users/franchise-admins?franchiseId=${franchiseId}`), {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch franchise administrators");
      }
      
      const data = await response.json();
      setFranchiseAdmins(data.data || []);
    } catch (error) {
      console.error("Error fetching franchise admins:", error);
      toast({
        title: "Error",
        description: "Failed to load franchise administrators",
        variant: "destructive"
      });
    }
  };
  
  // Handle admin management dialog
  const handleManageAdmin = (franchise: Franchise) => {
    setSelectedFranchise(franchise);
    setAdminFormData({
      username: "",
      fullName: "",
      password: "",
      franchiseId: franchise._id
    });
    fetchFranchiseAdmins(franchise._id);
    setIsAdminDialogOpen(true);
  };
  
  // Handle resetting admin password
  const handleResetAdminPassword = (adminId: string) => {
    setResetPasswordAdminId(adminId);
    setNewPassword("");
    setIsResetPasswordDialogOpen(true);
  };
  
  // Reset admin password mutation
  const resetAdminPasswordMutation = useMutation({
    mutationFn: async ({ adminId, newPassword }: { adminId: string; newPassword: string }) => {
      const response = await fetch(apiUrl(`/api/users/franchise-admin/${adminId}/reset-password`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ newPassword })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || "Failed to reset administrator password");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password reset",
        description: "Administrator password has been reset successfully.",
        variant: "success"
      });
      setIsResetPasswordDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error resetting password",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB");
  };

  return (
    <MainLayout>
      <PageContent>
            <div className="mb-3 sm:mb-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h1 className="app-page-title">{isSuperAdmin ? "Franchises" : "My Franchise"}</h1>
                    <p className="app-page-description">
                      {isSuperAdmin
                        ? "Manage your franchises and their settings"
                        : "View and manage your franchise settings"}
                    </p>
                  </div>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="sm:max-w-[525px]">
                  <DialogHeader>
                    <DialogTitle>Create New Franchise</DialogTitle>
                    <DialogDescription>
                      Add a new franchise to your election management system.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateSubmit}>
                    <div className="app-form-fields">
                      <div className="grid gap-1">
                        <Label htmlFor="name">Franchise Name</Label>
                        <Input
                          id="name"
                          name="name"
                          value={createFormData.name}
                          onChange={handleCreateFormChange}
                          required
                          placeholder="Enter franchise name"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="logo">Logo Image</Label>
                        <Input
                          id="logo"
                          name="logo"
                          type="file"
                          accept="image/*"
                          onChange={handleCreateFormChange}
                        />
                        <p className="app-helper">Upload a logo image for the franchise (JPG, PNG, SVG, etc.)</p>
                      </div>

                      <div className="grid gap-1">
                        <Label htmlFor="websiteUrl">Website URL</Label>
                        <Input
                          id="websiteUrl"
                          name="websiteUrl"
                          value={createFormData.websiteUrl}
                          onChange={handleCreateFormChange}
                          placeholder="https://example.com"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="contactNumber">Contact Number</Label>
                        <Input
                          id="contactNumber"
                          name="contactNumber"
                          value={createFormData.contactNumber}
                          onChange={handleCreateFormChange}
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="contactEmail">Contact Email</Label>
                        <Input
                          id="contactEmail"
                          name="contactEmail"
                          type="email"
                          value={createFormData.contactEmail}
                          onChange={handleCreateFormChange}
                          placeholder="contact@example.com"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={createFranchiseMutation.isPending}
                      >
                        {createFranchiseMutation.isPending ? "Creating..." : "Create Franchise"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
                </Dialog>
              </div>

              {/* Edit Franchise Dialog */}
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[525px]">
                  <DialogHeader>
                    <DialogTitle>Edit Franchise</DialogTitle>
                    <DialogDescription>
                      Update franchise information and settings.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleEditSubmit}>
                    <div className="app-form-fields">
                      <div className="grid gap-1">
                        <Label htmlFor="edit-name">Franchise Name</Label>
                        <Input
                          id="edit-name"
                          name="name"
                          value={editFormData.name}
                          onChange={handleEditFormChange}
                          required
                          placeholder="Enter franchise name"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="edit-logo">Logo Image</Label>
                        <Input
                          id="edit-logo"
                          name="logo"
                          type="file"
                          accept="image/*"
                          onChange={handleEditFormChange}
                        />
                        <p className="app-helper">Upload a new logo image or leave empty to keep the current one</p>
                      </div>

                      <div className="grid gap-1">
                        <Label htmlFor="edit-websiteUrl">Website URL</Label>
                        <Input
                          id="edit-websiteUrl"
                          name="websiteUrl"
                          value={editFormData.websiteUrl}
                          onChange={handleEditFormChange}
                          placeholder="https://example.com"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="edit-contactNumber">Contact Number</Label>
                        <Input
                          id="edit-contactNumber"
                          name="contactNumber"
                          value={editFormData.contactNumber}
                          onChange={handleEditFormChange}
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="edit-contactEmail">Contact Email</Label>
                        <Input
                          id="edit-contactEmail"
                          name="contactEmail"
                          type="email"
                          value={editFormData.contactEmail}
                          onChange={handleEditFormChange}
                          placeholder="contact@example.com"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="edit-status">Status</Label>
                        <select
                          id="edit-status"
                          name="status"
                          value={editFormData.status}
                          onChange={handleEditFormChange}
                          className="app-input-text flex h-9 w-full rounded-xl border border-input bg-white px-3 py-1.5 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditDialogOpen(false);
                          resetEditForm();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={updateFranchiseMutation.isPending}
                      >
                        {updateFranchiseMutation.isPending ? "Updating..." : "Update Franchise"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              
              {/* Franchise Admin Management Dialog */}
              <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
                <DialogContent className="sm:max-w-[700px]">
                  <DialogHeader>
                    <DialogTitle>Manage Franchise Administrators</DialogTitle>
                    <DialogDescription>
                      {selectedFranchise && (
                        <span>Manage administrators for {selectedFranchise.name}</span>
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Current Admins List */}
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="app-section-title">Current Administrators</h3>
                        <DeleteModeButton
                          active={adminSelection.deleteMode}
                          onClick={() =>
                            adminSelection.deleteMode
                              ? adminSelection.exitDeleteMode()
                              : adminSelection.enterDeleteMode()
                          }
                          compact
                        />
                      </div>
                      <DeleteModeBar
                        active={adminSelection.deleteMode}
                        count={adminSelection.selectedCount}
                        entityLabel="administrator"
                        onCancel={adminSelection.exitDeleteMode}
                        onConfirmDelete={() =>
                          adminSelection.selectedCount > 0 &&
                          setPendingDeleteAdminIds([...adminSelection.selectedIds])
                        }
                        deleting={deleteAdminsMutation.isPending}
                      />
                      {franchiseAdmins.length === 0 ? (
                        <p className="text-gray-500 italic">No administrators found for this franchise.</p>
                      ) : (
                        <CompactList>
                          {franchiseAdmins.map((admin) => (
                            <CompactListRow key={admin._id}>
                              {adminSelection.showSelectors && (
                              <CompactListLeading>
                              <RowSelectCheckbox
                                checked={adminSelection.isSelected(admin._id)}
                                onCheckedChange={() => adminSelection.toggle(admin._id)}
                                aria-label={`Select ${admin.fullName || admin.username}`}
                              />
                              </CompactListLeading>
                              )}
                              <CompactListPrimary>{admin.fullName || admin.username}</CompactListPrimary>
                              <CompactListSecondary>{admin.email}</CompactListSecondary>
                              <CompactListActions>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-blue-500 hover:text-blue-700"
                                  title="Reset password"
                                  aria-label="Reset password"
                                  onClick={() => handleResetAdminPassword(admin._id)}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                  </svg>
                                </Button>
                                {!adminSelection.deleteMode && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-600 hover:text-red-900 hover:bg-red-50"
                                  title="Delete"
                                  aria-label="Delete administrator"
                                  onClick={() => handleDeleteAdmin(admin._id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                )}
                              </CompactListActions>
                            </CompactListRow>
                          ))}
                        </CompactList>
                      )}
                    </div>
                    
                    {/* Add New Admin Form */}
                    <div>
                      <h3 className="app-section-title mb-3">Add New Administrator</h3>
                      <form onSubmit={handleAdminSubmit} className="app-form-fields">
                        <div className="grid gap-1">
                          <Label htmlFor="username">Username</Label>
                          <Input
                            id="username"
                            name="username"
                            value={adminFormData.username}
                            onChange={handleAdminFormChange}
                            required
                            placeholder="admin_username"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor="fullName">Full Name</Label>
                          <Input
                            id="fullName"
                            name="fullName"
                            value={adminFormData.fullName}
                            onChange={handleAdminFormChange}
                            required
                            placeholder="John Doe"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            name="password"
                            type="password"
                            value={adminFormData.password}
                            onChange={handleAdminFormChange}
                            required
                            placeholder="••••••••"
                          />
                        </div>
                        <Button 
                          type="submit"
                          className="w-full"
                          disabled={createFranchiseAdminMutation.isPending}
                        >
                          {createFranchiseAdminMutation.isPending ? "Creating..." : "Create Administrator"}
                        </Button>
                      </form>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsAdminDialogOpen(false)}
                    >
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {/* Password Reset Dialog */}
              <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle>Reset Administrator Password</DialogTitle>
                    <DialogDescription>
                      Enter a new password for this administrator.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    resetAdminPasswordMutation.mutate({
                      adminId: resetPasswordAdminId,
                      newPassword
                    });
                  }}>
                    <div className="app-form-fields">
                      <div className="grid gap-1">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          autoComplete="new-password"
                          required
                          minLength={6}
                        />
                        <p className="app-helper">Password must be at least 6 characters long.</p>
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsResetPasswordDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={resetAdminPasswordMutation.isPending || !newPassword || newPassword.length < 6}
                      >
                        {resetAdminPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="border-0 shadow-none bg-transparent lg:border lg:bg-white lg:shadow-card">
              <CardHeader className="flex flex-col gap-3 border-b border-slate-100 px-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <UsersRound className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle>All Franchises</CardTitle>
                    <CardDescription>
                      View and manage all franchises in your election system
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <SearchInput
                    placeholder="Search franchise..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  {isSuperAdmin && (
                    <AddButton
                      title="Add franchise"
                      label="Add franchise"
                      onClick={() => setIsCreateDialogOpen(true)}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : error ? (
                  <div className="p-4 text-center text-red-500">
                    Failed to load franchises. Please try again.
                  </div>
                ) : franchises && Array.isArray(franchises) && franchises.length > 0 && visibleFranchises.length === 0 ? (
                  <div className="p-5 text-center">
                    <Search className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                    <p className="text-slate-500">No franchises match "{searchInput}".</p>
                  </div>
                ) : franchises && Array.isArray(franchises) && franchises.length > 0 ? (
                  <>
                  <CompactList>
                    {visibleFranchises.map((franchise: Franchise) => {
                      const contact = resolveFranchiseContact(franchise);
                      return (
                      <CompactListRow
                        key={franchise._id}
                        label={`Open ${franchise.name}`}
                        onClick={() => navigate(`/franchises/${franchise._id}`)}
                      >
                        <CompactListLeading>
                          {franchise.logo?.url ? (
                            <img
                              src={franchise.logo.url}
                              alt={franchise.logo.alt || franchise.name}
                              className="h-8 w-8 rounded-lg object-cover ring-1 ring-slate-200"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Image className="h-4 w-4" />
                            </div>
                          )}
                        </CompactListLeading>
                        <CompactListStatus active={franchise.status === "active"} />
                        <CompactListPrimary>{franchise.name}</CompactListPrimary>
                        <CompactListSecondary>
                          {contact.contactNumber || contact.websiteUrl || `Created ${formatDate(franchise.createdAt)}`}
                        </CompactListSecondary>
                        <CompactListActions>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Edit"
                            aria-label={`Edit ${franchise.name}`}
                            onClick={() => handleEditFranchise(franchise)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {isSuperAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                title="Manage Admins"
                                aria-label={`Manage admins for ${franchise.name}`}
                                onClick={() => handleManageAdmin(franchise)}
                              >
                                <UsersRound className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete"
                                aria-label={`Delete ${franchise.name}`}
                                onClick={() => handleDeleteFranchise(franchise._id)}
                                disabled={deleteFranchisesMutation.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </CompactListActions>
                      </CompactListRow>
                      );
                    })}
                  </CompactList>
                  </>
                ) : (
                  <EmptyState
                    title="No franchises found"
                    description="Create one to get started."
                  />
                )}
              </CardContent>
              {franchisesPagination && (franchisesPagination.totalPages ?? 1) > 1 ? (
                <CardFooter className="border-t border-slate-100 p-4 sm:px-6">
                  <PaginationControls
                    page={franchisesPagination.page}
                    totalPages={franchisesPagination.totalPages ?? 1}
                    total={franchisesPagination.total}
                    pageSize={franchisesPagination.pageSize}
                    onPageChange={setPage}
                    className="mt-0 w-full"
                  />
                </CardFooter>
              ) : null}
            </Card>
      </PageContent>

          <ConfirmDialog
            open={!!pendingDeleteFranchiseIds?.length}
            onOpenChange={(open) => !open && setPendingDeleteFranchiseIds(null)}
            onConfirm={() =>
              pendingDeleteFranchiseIds?.length &&
              deleteFranchisesMutation.mutate(pendingDeleteFranchiseIds)
            }
            loading={deleteFranchisesMutation.isPending}
            title="Are you sure?"
            description={
              pendingDeleteFranchiseIds && pendingDeleteFranchiseIds.length > 1
                ? `This will permanently delete ${pendingDeleteFranchiseIds.length} franchises and may affect associated data. This action cannot be undone.`
                : "This will permanently delete the franchise and may affect its associated data. This action cannot be undone."
            }
            confirmText={
              pendingDeleteFranchiseIds && pendingDeleteFranchiseIds.length > 1
                ? `Delete ${pendingDeleteFranchiseIds.length} franchises`
                : "Delete franchise"
            }
          />

          <ConfirmDialog
            open={!!pendingDeleteAdminIds?.length}
            onOpenChange={(open) => !open && setPendingDeleteAdminIds(null)}
            onConfirm={() =>
              pendingDeleteAdminIds?.length && deleteAdminsMutation.mutate(pendingDeleteAdminIds)
            }
            loading={deleteAdminsMutation.isPending}
            title="Are you sure?"
            description={
              pendingDeleteAdminIds && pendingDeleteAdminIds.length > 1
                ? `This will permanently remove ${pendingDeleteAdminIds.length} franchise administrators. This action cannot be undone.`
                : "This will permanently remove this franchise administrator's access. This action cannot be undone."
            }
            confirmText={
              pendingDeleteAdminIds && pendingDeleteAdminIds.length > 1
                ? `Delete ${pendingDeleteAdminIds.length} administrators`
                : "Delete administrator"
            }
          />
    </MainLayout>
  );
}
