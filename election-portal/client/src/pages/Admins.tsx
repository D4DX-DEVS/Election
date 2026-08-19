import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageContent";
import { getElectionLabel } from "@/lib/electionHelpers";
import { cn, isValidNameField } from "@/lib/utils";
import { CompactList, CompactListRow, CompactListPrimary, CompactListSecondary, CompactListStatus, CompactListActions } from "@/components/ui/compact-list";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { AddButton } from "@/components/ui/add-button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Pagination } from "@/lib/types";

import { entityIdSchema, selectedEntityIdSchema } from "@shared/entityId";

// Schema for franchise admin creation
const usernameField = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .refine((value) => isValidNameField(value), {
    message: "Username cannot be numbers only — mix in at least one letter.",
  });

const fullNameField = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine((value) => !value || isValidNameField(value), {
    message: "Full name cannot be numbers only — mix in at least one letter.",
  });

const franchiseAdminSchema = z.object({
  username: usernameField,
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: fullNameField,
  franchiseId: selectedEntityIdSchema("Please select a franchise")
});

// Schema for election admin creation
const electionAdminSchema = z.object({
  username: usernameField,
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: fullNameField,
  franchiseId: selectedEntityIdSchema("Please select a franchise"),
  electionAccess: z.array(entityIdSchema).min(1, "Please select at least one election")
});

type FranchiseAdminFormValues = z.infer<typeof franchiseAdminSchema>;
type ElectionAdminFormValues = z.infer<typeof electionAdminSchema>;

type ListResponse<T> = { data: T[]; pagination?: Pagination };

function asList<T>(value: T[] | ListResponse<T> | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  return [];
}

interface AdminFranchiseOption {
  _id: string;
  id?: string | number;
  name: string;
}

interface AdminElectionOption {
  _id: string;
  id?: string | number;
  title: string;
  organization?: string;
  franchiseId: string | { _id?: string; toString: () => string };
}

interface FranchiseAdminUser {
  _id: string;
  username: string;
  fullName?: string;
  status?: string;
  franchiseId?: string;
  franchiseDetails?: { _id?: string; name?: string };
  electionAccess?: (string | { _id?: string; toString: () => string })[];
}

function isUserActive(status?: string | null): boolean {
  return String(status || "active").trim().toLowerCase() === "active";
}

function resolveFranchiseName(
  admin: Pick<FranchiseAdminUser, "franchiseId" | "franchiseDetails">,
  franchises: AdminFranchiseOption[]
): string {
  if (admin.franchiseDetails?.name) return admin.franchiseDetails.name;
  if (!admin.franchiseId) return "-";
  const match = franchises.find(
    (f) => String(f._id) === String(admin.franchiseId) || String(f.id) === String(admin.franchiseId)
  );
  return match?.name || "-";
}

function resolveElectionNames(
  admin: Pick<FranchiseAdminUser, "electionAccess">,
  elections: AdminElectionOption[]
): string {
  const ids = (admin.electionAccess || []).map((id) =>
    typeof id === "object" && id?._id ? id._id.toString() : String(id)
  );
  if (ids.length === 0) return "-";
  const names = ids.map((id) => {
    const match = elections.find(
      (e) => String(e._id) === id || String(e.id) === id
    );
    return match ? getElectionLabel(match) : id;
  });
  return names.join(", ");
}

export default function Admins() {
  const [createOpen, setCreateOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [adminType, setAdminType] = useState<'franchise' | 'election'>('election');
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>("");
  const { toast } = useToast();
  
  // Get user data from localStorage to check permissions
  const userDataString = localStorage.getItem('user');
  const userData = userDataString ? JSON.parse(userDataString) : null;
  const userRole = userData?.role || '';
  const userFranchiseId = userData?.franchiseId || '';
  // Only super admins may create franchise administrators
  const canCreateFranchiseAdmin = userRole === 'super_admin';
  const canDeleteAdmin = userRole === 'super_admin';
  const canDeleteElectionAdmin = userRole === 'super_admin' || userRole === 'franchise_admin';
  const currentUserId = String(userData?.id || userData?._id || '');
  const [franchiseAdminsPage, setFranchiseAdminsPage] = useState(1);
  const [pendingDeleteAdminId, setPendingDeleteAdminId] = useState<string | null>(null);
  const [pendingDeleteAdminName, setPendingDeleteAdminName] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTargetAdminId, setResetTargetAdminId] = useState<string | null>(null);
  const [resetTargetAdminName, setResetTargetAdminName] = useState('');
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const franchiseAdminsPageSize = 10;
  const [electionAdminsPage, setElectionAdminsPage] = useState(1);
  const [electionAdminsFranchiseFilter, setElectionAdminsFranchiseFilter] = useState<string>(
    userRole === 'franchise_admin' ? userFranchiseId : 'all'
  );
  const electionAdminsPageSize = 10;
  
  // --- Fetch data ---
  
  const { 
    data: franchisesRaw, 
    isLoading: franchisesLoading,
    isError: franchisesError
  } = useQuery<AdminFranchiseOption[] | ListResponse<AdminFranchiseOption>>({
    queryKey: ['/api/franchises']
  });
  const franchiseList = asList(franchisesRaw);
  
  // Fetch franchise admins
  const {
    data: franchiseAdminsRaw,
    isLoading: franchiseAdminsLoading,
    isError: franchiseAdminsError
  } = useQuery<ListResponse<FranchiseAdminUser>>({
    queryKey: ['/api/users/franchise-admins', franchiseAdminsPage],
    queryFn: async () => {
      const res = await apiRequest(
        'GET',
        `/api/users/franchise-admins?page=${franchiseAdminsPage}&limit=${franchiseAdminsPageSize}`
      );
      return res.json();
    },
    enabled: canCreateFranchiseAdmin,
  });
  const franchiseAdminList = asList(franchiseAdminsRaw);
  const franchiseAdminsPagination = franchiseAdminsRaw?.pagination;

  // Fetch election admins
  // Super admins manage franchise admins only — election admins are created and
  // owned by franchise admins for their own elections, and stay invisible to super admin.
  const canViewElectionAdmins = userRole === 'franchise_admin';
  const {
    data: electionAdminsRaw,
    isLoading: electionAdminsLoading,
    isError: electionAdminsListError
  } = useQuery<ListResponse<FranchiseAdminUser>>({
    queryKey: ['/api/users/election-admins', electionAdminsPage, electionAdminsFranchiseFilter],
    queryFn: async () => {
      const franchiseParam =
        electionAdminsFranchiseFilter && electionAdminsFranchiseFilter !== 'all'
          ? `&franchiseId=${electionAdminsFranchiseFilter}`
          : '';
      const res = await apiRequest(
        'GET',
        `/api/users/election-admins?page=${electionAdminsPage}&limit=${electionAdminsPageSize}${franchiseParam}`
      );
      return res.json();
    },
    enabled: canViewElectionAdmins,
  });
  const electionAdminList = asList(electionAdminsRaw);
  const electionAdminsPagination = electionAdminsRaw?.pagination;

  // Client-side search over the currently loaded page, same convention used
  // on the Elections/Franchises list pages.
  const matchesSearch = (admin: FranchiseAdminUser) => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return true;
    return (
      admin.username?.toLowerCase().includes(q) ||
      (admin.fullName || "").toLowerCase().includes(q)
    );
  };
  const visibleFranchiseAdmins = franchiseAdminList.filter(matchesSearch);
  const visibleElectionAdmins = electionAdminList.filter(matchesSearch);

  // Fetch elections (for election admin creation)
  const {
    data: electionsRaw,
    isLoading: electionsLoading,
  } = useQuery<AdminElectionOption[] | ListResponse<AdminElectionOption>>({
    queryKey: ['/api/elections'],
    enabled: true // Always fetch elections, we'll filter them in the component
  });
  const electionList = asList(electionsRaw);
  
  // --- Form handling ---
  
  // Franchise admin form
  const franchiseAdminForm = useForm<FranchiseAdminFormValues>({
    resolver: zodResolver(franchiseAdminSchema),
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
      franchiseId: ""
    }
  });
  
  // Election admin form
  const electionAdminForm = useForm<ElectionAdminFormValues>({
    resolver: zodResolver(electionAdminSchema),
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
      franchiseId: userRole === 'franchise_admin' ? userFranchiseId : "",
      electionAccess: []
    }
  });
  
  // Update available elections when franchise changes or when component mounts for franchise admin
  useEffect(() => {
    // For franchise admin, pre-select their franchise ID
    if (userRole === 'franchise_admin' && userFranchiseId) {
      setSelectedFranchiseId(userFranchiseId);
      electionAdminForm.setValue('franchiseId', userFranchiseId);
    } else if (selectedFranchiseId) {
      // Clear previous election selection
      electionAdminForm.setValue('electionAccess', []);
    }
  }, [selectedFranchiseId, electionAdminForm, userRole, userFranchiseId]);
  
  // --- Mutations ---
  
  // Create franchise admin
  const createFranchiseAdminMutation = useMutation({
    mutationFn: async (data: FranchiseAdminFormValues) => {
      console.log("Creating franchise admin with data:", {...data, password: "******"});
      return await apiRequest('POST', '/api/users/franchise-admin', data);
    },
    onSuccess: (data) => {
      console.log("Admin created successfully:", data);
      toast({
        title: "Administrator created",
        description: "Franchise administrator has been created successfully",
        variant: "success"
      });
      setCreateOpen(false);
      franchiseAdminForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/users/franchise-admins'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create administrator: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });
  
  // Create election admin
  const createElectionAdminMutation = useMutation({
    mutationFn: async (data: ElectionAdminFormValues) => {
      return await apiRequest('POST', '/api/users/election-admin', data);
    },
    onSuccess: () => {
      toast({
        title: "Administrator created",
        description: "Election administrator has been created successfully",
        variant: "success"
      });
      setCreateOpen(false);
      electionAdminForm.reset();
      setSelectedFranchiseId("");
      queryClient.invalidateQueries({ queryKey: ['/api/users/election-admins'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create administrator: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });
  
  // Form submission handlers
  const onSubmitFranchiseAdmin = (data: FranchiseAdminFormValues) => {
    createFranchiseAdminMutation.mutate(data);
  };
  
  const onSubmitElectionAdmin = (data: ElectionAdminFormValues) => {
    createElectionAdminMutation.mutate(data);
  };
  
  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string, password: string }) => {
      return await apiRequest('POST', `/api/users/${id}/reset-password`, { newPassword: password });
    },
    onSuccess: () => {
      toast({
        title: "Password reset",
        description: "Administrator password has been reset successfully",
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users/franchise-admins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/election-admins'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to reset password: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });

  const deleteAdminMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/users/${id}`);
      return id;
    },
    onSuccess: (deletedId) => {
      setPendingDeleteAdminId(null);
      setPendingDeleteAdminName('');
      if (franchiseAdminsPage > 1 && franchiseAdminList.length === 1 && franchiseAdminList[0]._id === deletedId) {
        setFranchiseAdminsPage(franchiseAdminsPage - 1);
      } else if (electionAdminsPage > 1 && electionAdminList.length === 1 && electionAdminList[0]._id === deletedId) {
        setElectionAdminsPage(electionAdminsPage - 1);
      }
      toast({
        title: 'Administrator deleted',
        description: 'The administrator has been removed successfully.',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users/franchise-admins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/election-admins'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete administrator: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
      setPendingDeleteAdminId(null);
    },
  });

  const handleDeleteAdminClick = (admin: FranchiseAdminUser) => {
    setPendingDeleteAdminId(admin._id);
    setPendingDeleteAdminName(admin.username);
  };

  const handleOpenResetDialog = (admin: FranchiseAdminUser) => {
    setResetTargetAdminId(admin._id);
    setResetTargetAdminName(admin.username);
    setResetPasswordInput("");
    setResetDialogOpen(true);
  };
  
  const pageTitle = canCreateFranchiseAdmin ? "Administrators" : "Election Admins";

  useEffect(() => {
    document.title = `${pageTitle} | Vote+`;
  }, [pageTitle]);

  return (
    <MainLayout>
      <PageHeader
        title={pageTitle}
        description={canCreateFranchiseAdmin ? "Manage system administrators" : "Manage election admins for your franchise"}
      />

      <div className="mb-4">
        <div className="flex items-center gap-2">
          <SearchInput
            placeholder="Search administrators..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="min-w-0 flex-1 sm:max-w-xs"
          />

          {/* Single unified create flow: asks for the administrator type, then shows matching fields */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <AddButton
                title="Add administrator"
                label="Add administrator"
                onClick={() => setAdminType(canCreateFranchiseAdmin ? 'franchise' : 'election')}
              />
            </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Administrator</DialogTitle>
              <DialogDescription>
                Choose which type of administrator to create, then fill in their details.
              </DialogDescription>
            </DialogHeader>

            {/* Administrator type selector */}
            <div className="space-y-2">
              <label className="app-label">Administrator Type</label>
              <Select value={adminType} disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canCreateFranchiseAdmin ? (
                    <SelectItem value="franchise">Franchise Administrator</SelectItem>
                  ) : (
                    <SelectItem value="election">Election Administrator</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="app-helper">
                {adminType === 'franchise'
                  ? 'Can manage an entire franchise and its elections.'
                  : 'Can manage only the elections assigned to them.'}
              </p>
            </div>

            {adminType === 'franchise' ? (
              <Form {...franchiseAdminForm}>
                <form onSubmit={franchiseAdminForm.handleSubmit(onSubmitFranchiseAdmin)} className="space-y-2.5">
                  <FormField
                    control={franchiseAdminForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={franchiseAdminForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={franchiseAdminForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={franchiseAdminForm.control}
                    name="franchiseId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Franchise</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a franchise" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {franchisesLoading ? (
                              <SelectItem value="__loading" disabled>
                                Loading franchises…
                              </SelectItem>
                            ) : franchisesError ? (
                              <SelectItem value="__error" disabled>
                                Failed to load franchises
                              </SelectItem>
                            ) : franchiseList.length === 0 ? (
                              <SelectItem value="__empty" disabled>
                                No franchises found — create one first
                              </SelectItem>
                            ) : (
                              franchiseList.map((franchise) => (
                                <SelectItem
                                  key={franchise._id || `franchise-${franchise.id}`}
                                  value={String(franchise._id || franchise.id)}
                                >
                                  {franchise.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createFranchiseAdminMutation.isPending}>
                      {createFranchiseAdminMutation.isPending ? "Creating..." : "Create Admin"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            ) : (
              <Form {...electionAdminForm}>
                <form onSubmit={electionAdminForm.handleSubmit(onSubmitElectionAdmin)} className="space-y-2.5">
                  <FormField
                    control={electionAdminForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={electionAdminForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={electionAdminForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {/* Only show franchise selector if user is not a franchise admin */}
                  {userRole !== 'franchise_admin' ? (
                    <FormField
                      control={electionAdminForm.control}
                      name="franchiseId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Franchise</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedFranchiseId(value);
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a franchise" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {franchisesLoading ? (
                                <SelectItem value="__loading" disabled>
                                  Loading franchises…
                                </SelectItem>
                              ) : franchiseList.length === 0 ? (
                                <SelectItem value="__empty" disabled>
                                  No franchises found
                                </SelectItem>
                              ) : (
                                franchiseList.map((franchise) => (
                                  <SelectItem
                                    key={franchise._id || `franchise-${franchise.id}`}
                                    value={String(franchise._id || franchise.id)}
                                  >
                                    {franchise.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Select a franchise to see available elections
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                  {selectedFranchiseId && (
                    <FormField
                      control={electionAdminForm.control}
                      name="electionAccess"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Elections</FormLabel>
                          <div className="border rounded-md p-3 space-y-2">
                            {electionsLoading ? (
                              <Skeleton className="h-20 w-full" />
                            ) : electionList.length > 0 ? (
                              electionList
                                .filter(election => {
                                  const electionFranchiseId =
                                    typeof election.franchiseId === 'object' && election.franchiseId?._id
                                      ? election.franchiseId._id.toString()
                                      : (typeof election.franchiseId === 'object'
                                          ? election.franchiseId.toString()
                                          : String(election.franchiseId));
                                  return electionFranchiseId === selectedFranchiseId;
                                })
                                .map(election => {
                                  const electionId = String(election._id || election.id);
                                  return (
                                  <div key={electionId} className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id={`election-${electionId}`}
                                      value={electionId}
                                      checked={field.value.includes(electionId)}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        const value = e.target.value;
                                        if (checked) {
                                          field.onChange([...field.value, value]);
                                        } else {
                                          field.onChange(field.value.filter(v => v !== value));
                                        }
                                      }}
                                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <label htmlFor={`election-${electionId}`} className="text-sm font-medium text-gray-700">
                                      {getElectionLabel(election)}
                                    </label>
                                  </div>
                                );
                                })
                            ) : (
                              <p className="text-sm text-gray-500">
                                No elections found for this franchise
                              </p>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createElectionAdminMutation.isPending}>
                      {createElectionAdminMutation.isPending ? "Creating..." : "Create Admin"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            )}
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        {/* Franchise Administrators (super admins only) */}
        {canCreateFranchiseAdmin && (
          <Card className="border-0 shadow-none bg-transparent lg:border lg:bg-white lg:shadow-sm">
            <CardHeader className="hidden lg:block">
              <div>
                <CardTitle>Franchise Administrators</CardTitle>
                <CardDescription>
                  Manage administrators who can control franchises
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0 lg:p-4">
              {franchiseAdminsError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    Failed to fetch administrators. Please try again.
                  </AlertDescription>
                </Alert>
              )}
              
              {franchiseAdminsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : franchiseAdminList.length > 0 ? (
                <>
                {visibleFranchiseAdmins.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    No administrators match "{searchInput}".
                  </div>
                ) : (
                <CompactList>
                  {visibleFranchiseAdmins.map((admin) => (
                    <CompactListRow key={admin._id}>
                      <CompactListPrimary>{admin.username}</CompactListPrimary>
                      <CompactListSecondary>
                        {[admin.fullName || "-", resolveFranchiseName(admin, franchiseList)].filter(Boolean).join(" · ")}
                      </CompactListSecondary>
                      <CompactListStatus active={isUserActive(admin.status)} />
                      <CompactListActions>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Administrator actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenResetDialog(admin)}>
                            Reset Password
                          </DropdownMenuItem>
                          {canDeleteAdmin && String(admin._id) !== currentUserId && (
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => handleDeleteAdminClick(admin)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </CompactListActions>
                    </CompactListRow>
                  ))}
                </CompactList>
                )}
                {franchiseAdminsPagination && (franchiseAdminsPagination.totalPages ?? 1) > 1 && (
                  <PaginationControls
                    page={franchiseAdminsPagination.page}
                    totalPages={franchiseAdminsPagination.totalPages ?? 1}
                    total={franchiseAdminsPagination.total}
                    pageSize={franchiseAdminsPagination.pageSize}
                    onPageChange={setFranchiseAdminsPage}
                  />
                )}
                </>
              ) : (
                <div className="py-6 text-center text-sm text-gray-500">No franchise administrators found</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Election Administrators */}
        {canViewElectionAdmins && (
          <Card className="border-0 shadow-none bg-transparent lg:border lg:bg-white lg:shadow-sm">
            <CardHeader className="hidden lg:block">
              <div>
                <CardTitle>Election Administrators</CardTitle>
                <CardDescription>
                  Manage administrators who can control individual elections
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0 lg:p-4">
              {electionAdminsListError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    Failed to fetch administrators. Please try again.
                  </AlertDescription>
                </Alert>
              )}

              {electionAdminsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : electionAdminList.length > 0 ? (
                <>
                {visibleElectionAdmins.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    No administrators match "{searchInput}".
                  </div>
                ) : (
                <CompactList>
                  {visibleElectionAdmins.map((admin) => (
                    <CompactListRow key={admin._id}>
                      <CompactListPrimary>{admin.username}</CompactListPrimary>
                      <CompactListSecondary>
                        {[admin.fullName || "-", resolveElectionNames(admin, electionList)].filter(Boolean).join(" · ")}
                      </CompactListSecondary>
                      <CompactListStatus active={isUserActive(admin.status)} />
                      <CompactListActions>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Administrator actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenResetDialog(admin)}>
                            Reset Password
                          </DropdownMenuItem>
                          {canDeleteElectionAdmin && String(admin._id) !== currentUserId && (
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => handleDeleteAdminClick(admin)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </CompactListActions>
                    </CompactListRow>
                  ))}
                </CompactList>
                )}
                {electionAdminsPagination && (electionAdminsPagination.totalPages ?? 1) > 1 && (
                  <PaginationControls
                    page={electionAdminsPagination.page}
                    totalPages={electionAdminsPagination.totalPages ?? 1}
                    total={electionAdminsPagination.total}
                    pageSize={electionAdminsPagination.pageSize}
                    onPageChange={setElectionAdminsPage}
                  />
                )}
                </>
              ) : (
                <div className="py-6 text-center text-sm text-gray-500">No election administrators found</div>
              )}
            </CardContent>
          </Card>
        )}

      </div>

      <ConfirmDialog
        open={!!pendingDeleteAdminId}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteAdminId(null);
            setPendingDeleteAdminName('');
          }
        }}
        onConfirm={() => {
          if (pendingDeleteAdminId) {
            deleteAdminMutation.mutate(pendingDeleteAdminId);
          }
        }}
        loading={deleteAdminMutation.isPending}
        title="Delete administrator"
        description={
          pendingDeleteAdminName
            ? `Remove "${pendingDeleteAdminName}" permanently? This cannot be undone.`
            : 'Remove this administrator permanently? This cannot be undone.'
        }
        confirmText="Delete"
      />

      <Dialog
        open={resetDialogOpen}
        onOpenChange={(open) => {
          setResetDialogOpen(open);
          if (!open) {
            setResetTargetAdminId(null);
            setResetTargetAdminName('');
            setResetPasswordInput('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset administrator password</DialogTitle>
            <DialogDescription>
              {resetTargetAdminName
                ? `Set a new password for "${resetTargetAdminName}".`
                : "Set a new password for this administrator."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reset-admin-password">New password</Label>
            <Input
              id="reset-admin-password"
              type="password"
              autoComplete="new-password"
              placeholder="Minimum 6 characters"
              value={resetPasswordInput}
              onChange={(e) => setResetPasswordInput(e.target.value)}
            />
            <p className="app-helper">
              Use at least 6 characters.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              disabled={resetPasswordMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={resetPasswordMutation.isPending || !resetTargetAdminId || resetPasswordInput.length < 6}
              onClick={() => {
                if (!resetTargetAdminId) return;
                resetPasswordMutation.mutate(
                  { id: resetTargetAdminId, password: resetPasswordInput },
                  {
                    onSuccess: () => {
                      setResetDialogOpen(false);
                      setResetTargetAdminId(null);
                      setResetTargetAdminName('');
                      setResetPasswordInput('');
                    },
                  }
                );
              }}
            >
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
