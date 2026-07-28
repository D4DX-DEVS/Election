import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DeleteModeBar } from "@/components/ui/delete-mode-bar";
import { DeleteModeButton } from "@/components/ui/delete-mode-button";
import { RowSelectCheckbox } from "@/components/ui/row-select-checkbox";
import { useBulkDeleteMode } from "@/hooks/useBulkDeleteMode";
import { deleteByIds } from "@/lib/bulkDelete";
import { Plus, Edit, Trash2, Globe, Phone, Image } from "lucide-react";
import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageContent } from "@/components/layout/PageContent";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Pagination } from "@/lib/types";
import { clearAccountSession } from "@/lib/session";
import { isLettersOnlyName } from "@/lib/utils";

interface Franchise {
  _id: string;
  name: string;
  logo: {
    url?: string;
    alt?: string;
  };
  websiteUrl?: string;
  contactNumber?: string;
  settings?: Record<string, unknown>;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface CreateFranchiseFormData {
  name: string;
  websiteUrl: string;
  contactNumber: string;
}

interface EditFranchiseFormData {
  id: string;
  name: string;
  websiteUrl: string;
  contactNumber: string;
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
  };
  return {
    websiteUrl: franchise.websiteUrl || settings.websiteUrl || "",
    contactNumber: franchise.contactNumber || settings.contactNumber || "",
  };
}

export default function Franchises() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateFranchiseFormData>({
    name: "",
    websiteUrl: "",
    contactNumber: ""
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  // Edit franchise state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFranchiseFormData>({
    id: "",
    name: "",
    websiteUrl: "",
    contactNumber: "",
    status: "active"
  });
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  
  // Admin management state
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [selectedFranchise, setSelectedFranchise] = useState<Franchise | null>(null);
  const [expandedFranchiseIds, setExpandedFranchiseIds] = useState<Set<string>>(new Set());
  const toggleFranchiseExpanded = (id: string) => {
    setExpandedFranchiseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
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
  const [location, navigate] = useLocation();

  const [page, setPage] = useState(1);
  const pageSize = 10;

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

  // Create franchise mutation
  const createFranchiseMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/franchises", {
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
      const response = await fetch(`/api/franchises/${id}`, {
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
      const response = await fetch(`/api/users/franchise-admin`, {
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
      contactNumber: ""
    });
    setLogoFile(null);
  };
  
  const resetEditForm = () => {
    setEditFormData({
      id: "",
      name: "",
      websiteUrl: "",
      contactNumber: "",
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
        ? (franchise.settings as { websiteUrl?: string; contactNumber?: string })
        : {};
    setEditFormData({
      id: franchise._id,
      name: franchise.name,
      websiteUrl: franchise.websiteUrl || settings.websiteUrl || "",
      contactNumber: franchise.contactNumber || settings.contactNumber || "",
      status: franchise.status
    });
    setIsEditDialogOpen(true);
  };
  
  // Get franchise admins
  const fetchFranchiseAdmins = async (franchiseId: string) => {
    try {
      const response = await fetch(`/api/users/franchise-admins?franchiseId=${franchiseId}`, {
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
      const response = await fetch(`/api/users/franchise-admin/${adminId}/reset-password`, {
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

  // Handle logout
  const handleLogout = () => {
    clearAccountSession();
    queryClient.clear();
    navigate("/login");
  };

  return (
    <MainLayout>
      <PageContent>
            <div className="mb-5 sm:mb-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Franchises</h1>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full shrink-0 sm:w-auto">
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add franchise
                    </Button>
                  </DialogTrigger>
                <DialogContent className="sm:max-w-[525px]">
                  <DialogHeader>
                    <DialogTitle>Create New Franchise</DialogTitle>
                    <DialogDescription>
                      Add a new franchise to your election management system.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateSubmit}>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
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
                      <div className="grid gap-2">
                        <Label htmlFor="logo">Logo Image</Label>
                        <Input
                          id="logo"
                          name="logo"
                          type="file"
                          accept="image/*"
                          onChange={handleCreateFormChange}
                        />
                        <p className="text-xs text-gray-500">Upload a logo image for the franchise (JPG, PNG, SVG, etc.)</p>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="websiteUrl">Website URL</Label>
                        <Input
                          id="websiteUrl"
                          name="websiteUrl"
                          value={createFormData.websiteUrl}
                          onChange={handleCreateFormChange}
                          placeholder="https://example.com"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="contactNumber">Contact Number</Label>
                        <Input
                          id="contactNumber"
                          name="contactNumber"
                          value={createFormData.contactNumber}
                          onChange={handleCreateFormChange}
                          placeholder="+1 (555) 123-4567"
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
              <p className="text-sm text-gray-600 mt-1">
                Manage your franchises and their settings
              </p>

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
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
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
                      <div className="grid gap-2">
                        <Label htmlFor="edit-logo">Logo Image</Label>
                        <Input
                          id="edit-logo"
                          name="logo"
                          type="file"
                          accept="image/*"
                          onChange={handleEditFormChange}
                        />
                        <p className="text-xs text-gray-500">Upload a new logo image or leave empty to keep the current one</p>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="edit-websiteUrl">Website URL</Label>
                        <Input
                          id="edit-websiteUrl"
                          name="websiteUrl"
                          value={editFormData.websiteUrl}
                          onChange={handleEditFormChange}
                          placeholder="https://example.com"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-contactNumber">Contact Number</Label>
                        <Input
                          id="edit-contactNumber"
                          name="contactNumber"
                          value={editFormData.contactNumber}
                          onChange={handleEditFormChange}
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-status">Status</Label>
                        <select
                          id="edit-status"
                          name="status"
                          value={editFormData.status}
                          onChange={handleEditFormChange}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Admins List */}
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="font-medium text-lg">Current Administrators</h3>
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
                        <div className="space-y-3">
                          {franchiseAdmins.map((admin) => (
                            <div 
                              key={admin._id} 
                              className="flex items-center justify-between bg-white p-3 rounded-md gap-2"
                            >
                              {adminSelection.showSelectors && (
                              <RowSelectCheckbox
                                checked={adminSelection.isSelected(admin._id)}
                                onCheckedChange={() => adminSelection.toggle(admin._id)}
                                aria-label={`Select ${admin.fullName || admin.username}`}
                              />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium">{admin.fullName}</div>
                                <div className="text-sm text-gray-500">{admin.email}</div>
                                <div className="text-xs text-gray-400">Username: {admin.username}</div>
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-blue-500 hover:text-blue-700"
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
                                  size="sm"
                                  className="text-red-600 hover:text-red-900 hover:bg-red-50"
                                  onClick={() => handleDeleteAdmin(admin._id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Add New Admin Form */}
                    <div>
                      <h3 className="font-medium text-lg mb-3">Add New Administrator</h3>
                      <form onSubmit={handleAdminSubmit} className="space-y-4">
                        <div className="grid gap-2">
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
                        <div className="grid gap-2">
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
                        <div className="grid gap-2">
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
                  
                  <DialogFooter className="mt-6">
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
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
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
                        <p className="text-xs text-gray-500">Password must be at least 6 characters long.</p>
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

            <Card className="border-0 shadow-none bg-transparent lg:border lg:bg-white lg:shadow-sm">
              <CardHeader className="hidden lg:block lg:px-6 lg:py-4 lg:border-b lg:border-gray-200">
                <CardTitle className="text-lg font-medium text-gray-900">All Franchises</CardTitle>
                <CardDescription>
                  View and manage all franchises in your election system
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : error ? (
                  <div className="p-6 text-center text-red-500">
                    Failed to load franchises. Please try again.
                  </div>
                ) : franchises && Array.isArray(franchises) && franchises.length > 0 ? (
                  <>
                  <div className="space-y-3 lg:space-y-4 lg:hidden">
                    {franchises.map((franchise: Franchise) => {
                      const contact = resolveFranchiseContact(franchise);
                      const expanded = expandedFranchiseIds.has(franchise._id);
                      return (
                      <div
                        key={franchise._id}
                        className="rounded-lg border border-gray-200 bg-white p-5 space-y-4 cursor-pointer"
                        onClick={() => toggleFranchiseExpanded(franchise._id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            {franchise.logo?.url ? (
                              <img
                                src={franchise.logo.url}
                                alt={franchise.logo.alt || franchise.name}
                                className="h-10 w-10 rounded-sm object-cover shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-sm bg-gray-200 flex items-center justify-center shrink-0">
                                <Image className="h-5 w-5 text-gray-500" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <h3 className="text-sm md:text-base font-medium text-gray-900 truncate">{franchise.name}</h3>
                              <p className="text-xs text-gray-500">Created {formatDate(franchise.createdAt)}</p>
                            </div>
                          </div>
                          <Badge
                            variant={franchise.status === 'active' ? 'outline' : 'secondary'}
                            className={
                              franchise.status === 'active'
                                ? 'bg-green-100 text-green-800 hover:bg-green-100'
                                : 'bg-gray-100 text-gray-800 hover:bg-primary/10'
                            }
                          >
                            {franchise.status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                          {contact.websiteUrl && (
                            <a
                              href={contact.websiteUrl.startsWith("http") ? contact.websiteUrl : `https://${contact.websiteUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center font-medium text-blue-600 hover:underline"
                            >
                              <Globe className="h-4 w-4 mr-1" /> Website
                            </a>
                          )}
                          {contact.contactNumber && (
                            <span className="inline-flex items-center font-medium text-gray-700">
                              <Phone className="h-4 w-4 mr-1" /> {contact.contactNumber}
                            </span>
                          )}
                        </div>

                        {expanded && (
                        <div
                          className="flex items-center gap-1 border-t border-gray-100 pt-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="ghost" size="sm" onClick={() => handleEditFranchise(franchise)}>
                            <Edit className="h-4 w-4 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleManageAdmin(franchise)}
                          >
                            Admins
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
                            onClick={() => handleDeleteFranchise(franchise._id)}
                            disabled={deleteFranchisesMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </div>
                        )}
                      </div>
                    );
                    })}
                  </div>
                  <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Website</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {franchises.map((franchise: Franchise) => {
                        const contact = resolveFranchiseContact(franchise);
                        return (
                        <TableRow key={franchise._id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center">
                              {franchise.logo?.url ? (
                                <img
                                  src={franchise.logo.url}
                                  alt={franchise.logo.alt || franchise.name}
                                  className="w-8 h-8 mr-3 rounded-sm object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 mr-3 rounded-sm bg-gray-200 flex items-center justify-center">
                                  <Image className="h-4 w-4 text-gray-500" />
                                </div>
                              )}
                              {franchise.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            {contact.websiteUrl ? (
                              <a 
                                href={contact.websiteUrl.startsWith("http") ? contact.websiteUrl : `https://${contact.websiteUrl}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center text-blue-600 hover:underline"
                              >
                                <Globe className="h-4 w-4 mr-1" />
                                Website
                              </a>
                            ) : (
                              <span className="text-gray-400">Not available</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {contact.contactNumber ? (
                              <div className="flex items-center">
                                <Phone className="h-4 w-4 mr-1" />
                                {contact.contactNumber}
                              </div>
                            ) : (
                              <span className="text-gray-400">Not available</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={franchise.status === 'active' ? 'default' : 'secondary'}>
                              {franchise.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(franchise.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditFranchise(franchise)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mr-2"
                                onClick={() => handleManageAdmin(franchise)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1">
                                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                                  <circle cx="9" cy="7" r="4"></circle>
                                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                                Admins
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteFranchise(franchise._id)}
                                disabled={deleteFranchisesMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                  </>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-gray-500">No franchises found. Create one to get started.</p>
                  </div>
                )}
              </CardContent>
              {franchisesPagination && (franchisesPagination.totalPages ?? 1) > 1 ? (
                <CardFooter className="border-t border-gray-200 p-4">
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
