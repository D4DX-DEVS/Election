import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PaginationControls } from "@/components/ui/pagination-controls";

import { MainLayout } from "@/components/layout/MainLayout";
import { PageContent } from "@/components/layout/PageContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CompactList,
  CompactListRow,
  CompactListPrimary,
  CompactListSecondary,
  CompactListActions,
} from "@/components/ui/compact-list";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ElectionCard } from "@/components/elections/ElectionCard";

import {
  ArrowLeft,
  Building2,
  Globe,
  Phone,
  Mail,
  Pencil,
  Trash2,
  KeyRound,
  UsersRound,
  Vote,
} from "lucide-react";
import { getStoredUser } from "@/lib/authUser";
import { isLettersOnlyName } from "@/lib/utils";
import { ElectionWithDetails } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Franchise {
  _id: string;
  name: string;
  logo?: { url?: string; alt?: string };
  websiteUrl?: string;
  contactNumber?: string;
  contactEmail?: string;
  settings?: Record<string, unknown>;
  status: "active" | "inactive";
  createdAt: string;
}

interface FranchiseAdmin {
  _id: string;
  username: string;
  fullName?: string;
  email?: string;
}

interface EditFormData {
  id: string;
  name: string;
  websiteUrl: string;
  contactNumber: string;
  contactEmail: string;
  status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FranchiseDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const currentUser = getStoredUser();
  const isSuperAdmin = currentUser?.role === "super_admin";

  // ── Elections pagination ──────────────────────────────────────────────
  const [electionsPage, setElectionsPage] = useState(1);
  const ELECTIONS_PAGE_SIZE = 10;

  // ── Edit dialog ──────────────────────────────────────────────────────────
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
    id: "",
    name: "",
    websiteUrl: "",
    contactNumber: "",
    contactEmail: "",
    status: "active",
  });

  // ── Reset password dialog ────────────────────────────────────────────────
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetAdminId, setResetAdminId] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // ── Delete admin confirm ─────────────────────────────────────────────────
  const [pendingDeleteAdminId, setPendingDeleteAdminId] = useState<string | null>(null);

  // ── Fetch franchise ──────────────────────────────────────────────────────
  const {
    data: franchise,
    isLoading,
    error,
  } = useQuery<Franchise>({
    queryKey: ["/api/franchises", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/franchises/${id}`);
      const json = await res.json();
      return json.data ?? json;
    },
    enabled: !!id,
  });

  // ── Fetch admins ─────────────────────────────────────────────────────────
  const { data: adminsData, isLoading: isLoadingAdmins } = useQuery<{ data: FranchiseAdmin[] }>({
    queryKey: ["/api/franchises", id, "admins"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/franchises/${id}/admins`);
      return res.json();
    },
    enabled: !!id,
  });
  const admins: FranchiseAdmin[] = adminsData?.data ?? [];

  // ── Fetch elections for this franchise (paginated) ──────────────────────
  const { data: electionsData, isLoading: isLoadingElections } = useQuery<{
    data: ElectionWithDetails[];
    pagination?: { total: number; page: number; pageSize: number; totalPages: number };
  }>({
    queryKey: ["/api/elections", { franchiseId: id }, electionsPage, ELECTIONS_PAGE_SIZE],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/elections?franchiseId=${id}&page=${electionsPage}&limit=${ELECTIONS_PAGE_SIZE}`,
      );
      return res.json();
    },
    enabled: !!id,
    placeholderData: (prev) => prev,
  });
  const elections: ElectionWithDetails[] = electionsData?.data ?? [];
  const electionsPagination = electionsData?.pagination;

  // ── Update franchise mutation ────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const fid = formData.get("id") as string;
      const res = await fetch(`/api/franchises/${fid}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update franchise");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Franchise updated", variant: "success" });
      setIsEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/franchises", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/franchises"] });
    },
    onError: (err: Error) =>
      toast({ title: "Error updating franchise", description: err.message, variant: "destructive" }),
  });

  // ── Delete admin mutation ────────────────────────────────────────────────
  const deleteAdminMutation = useMutation({
    mutationFn: async (adminId: string) => {
      const res = await apiRequest("DELETE", `/api/users/${adminId}`);
      if (!res.ok) throw new Error("Failed to delete administrator");
      return res.json();
    },
    onSuccess: () => {
      setPendingDeleteAdminId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/franchises", id, "admins"] });
      toast({ title: "Administrator deleted", variant: "success" });
    },
    onError: (err: Error) =>
      toast({ title: "Error deleting administrator", description: err.message, variant: "destructive" }),
  });

  // ── Reset admin password mutation ────────────────────────────────────────
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ adminId, password }: { adminId: string; password: string }) => {
      const res = await fetch(`/api/users/franchise-admin/${adminId}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({ newPassword: password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.message || "Failed to reset password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password reset successfully", variant: "success" });
      setIsResetOpen(false);
      setNewPassword("");
    },
    onError: (err: Error) =>
      toast({ title: "Error resetting password", description: err.message, variant: "destructive" }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openEdit = () => {
    if (!franchise) return;
    const contact = resolveFranchiseContact(franchise);
    setEditForm({
      id: franchise._id,
      name: franchise.name,
      websiteUrl: contact.websiteUrl,
      contactNumber: contact.contactNumber,
      contactEmail: contact.contactEmail,
      status: franchise.status,
    });
    setEditLogoFile(null);
    setIsEditOpen(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "logo" && "files" in e.target && e.target.files?.[0]) {
      setEditLogoFile(e.target.files[0]);
    } else {
      setEditForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLettersOnlyName(editForm.name)) {
      toast({ title: "Invalid franchise name", description: "Name cannot contain numbers.", variant: "destructive" });
      return;
    }
    const formData = new FormData();
    formData.append("id", editForm.id);
    formData.append("name", editForm.name);
    formData.append("websiteUrl", editForm.websiteUrl);
    formData.append("contactNumber", editForm.contactNumber);
    formData.append("contactEmail", editForm.contactEmail);
    formData.append("status", editForm.status);
    if (editLogoFile) formData.append("logo", editLogoFile);
    updateMutation.mutate(formData as any);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <MainLayout>
        <PageContent>
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </PageContent>
      </MainLayout>
    );
  }

  if (error || !franchise) {
    return (
      <MainLayout>
        <PageContent>
          <EmptyState
            title="Franchise not found"
            description="This franchise does not exist or could not be loaded."
          />
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.history.back()}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          </div>
        </PageContent>
      </MainLayout>
    );
  }

  const contact = resolveFranchiseContact(franchise);

  return (
    <MainLayout>
      <PageContent>
        {/* ── Back + Edit header ─────────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 pl-0 text-gray-500 hover:text-gray-800"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          {isSuperAdmin && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={openEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>

        {/* ── Franchise info card ────────────────────────────────────────── */}
        <div className="mb-4 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {/* Header row */}
          <div className="flex items-start gap-3 px-4 pt-4 pb-3">
            {/* Logo */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
              {franchise.logo?.url ? (
                <img
                  src={franchise.logo.url}
                  alt={franchise.logo.alt || franchise.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Building2 className="h-5 w-5 text-gray-300" />
              )}
            </div>

            {/* Title + status */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                {/* Name: break-words so long names wrap naturally, never truncate */}
                <h1 className="break-words text-base font-semibold leading-snug text-gray-900">
                  {franchise.name}
                </h1>
                <Badge variant={franchise.status === "active" ? "active" : "inactive"} className="shrink-0">
                  {franchise.status.charAt(0).toUpperCase() + franchise.status.slice(1)}
                </Badge>
              </div>
              <p className="mt-0.5 text-[11px] text-gray-400">
                Created {new Date(franchise.createdAt).toLocaleDateString("en-GB")}
              </p>
            </div>
          </div>

          {/* Contact row */}
          {(contact.contactNumber || contact.contactEmail || contact.websiteUrl) && (
            <div className="border-t border-gray-100 px-4 py-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {contact.contactNumber && (
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    {contact.contactNumber}
                  </span>
                )}
                {contact.contactEmail && (
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    {contact.contactEmail}
                  </span>
                )}
                {contact.websiteUrl && (
                  <a
                    href={contact.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    {contact.websiteUrl}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Elections card ─────────────────────────────────────────────── */}
        <Card className="mb-4 border-gray-100 shadow-sm">
          <CardHeader className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Vote className="h-3.5 w-3.5" />
              </div>
              <div>
                <CardTitle className="text-sm">Elections</CardTitle>
                <CardDescription className="text-[11px]">
                  Elections managed under this franchise
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingElections ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : elections.length === 0 ? (
              <EmptyState
                title="No elections"
                description="No elections are assigned to this franchise yet."
              />
            ) : (
              <div className="flex flex-col gap-1.5 p-3">
                {elections.map((election) => (
                  <ElectionCard
                    key={election._id}
                    election={election}
                    onClick={() => navigate(`/elections/${election._id}`)}
                  />
                ))}
                {electionsPagination && electionsPagination.totalPages > 1 && (
                  <PaginationControls
                    page={electionsPagination.page}
                    totalPages={electionsPagination.totalPages}
                    total={electionsPagination.total}
                    pageSize={electionsPagination.pageSize}
                    onPageChange={setElectionsPage}
                    className="mt-1 px-1"
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Administrators card ────────────────────────────────────────── */}
        <Card className="border-gray-100 shadow-sm">
          <CardHeader className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UsersRound className="h-3.5 w-3.5" />
              </div>
              <div>
                <CardTitle className="text-sm">Administrators</CardTitle>
                <CardDescription className="text-[11px]">
                  Users who manage this franchise
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingAdmins ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : admins.length === 0 ? (
              <EmptyState
                title="No administrators"
                description="No administrators are assigned to this franchise."
              />
            ) : (
              <div className="p-3">
                <CompactList>
                  {admins.map((admin) => (
                    <CompactListRow key={admin._id}>
                      <CompactListPrimary>{admin.fullName || admin.username}</CompactListPrimary>
                      <CompactListSecondary>{admin.email || admin.username}</CompactListSecondary>
                      {isSuperAdmin && (
                        <CompactListActions>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-blue-500 hover:text-blue-700"
                            title="Reset password"
                            aria-label={`Reset password for ${admin.fullName || admin.username}`}
                            onClick={() => {
                              setResetAdminId(admin._id);
                              setNewPassword("");
                              setIsResetOpen(true);
                            }}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-600 hover:bg-red-50 hover:text-red-700"
                            title="Delete"
                            aria-label={`Delete ${admin.fullName || admin.username}`}
                            onClick={() => setPendingDeleteAdminId(admin._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </CompactListActions>
                      )}
                    </CompactListRow>
                  ))}
                </CompactList>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Edit Franchise Dialog ──────────────────────────────────────── */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Franchise</DialogTitle>
              <DialogDescription>Update franchise information and settings.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit}>
              <div className="app-form-fields">
                <div className="grid gap-1">
                  <Label htmlFor="ef-name">Franchise Name</Label>
                  <Input
                    id="ef-name"
                    name="name"
                    value={editForm.name}
                    onChange={handleEditChange}
                    required
                    placeholder="Enter franchise name"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="ef-logo">Logo Image</Label>
                  <Input
                    id="ef-logo"
                    name="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleEditChange}
                  />
                  <p className="app-helper">Leave empty to keep the current logo.</p>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="ef-website">Website URL</Label>
                  <Input
                    id="ef-website"
                    name="websiteUrl"
                    value={editForm.websiteUrl}
                    onChange={handleEditChange}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="ef-phone">Contact Number</Label>
                  <Input
                    id="ef-phone"
                    name="contactNumber"
                    value={editForm.contactNumber}
                    onChange={handleEditChange}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="ef-email">Contact Email</Label>
                  <Input
                    id="ef-email"
                    name="contactEmail"
                    type="email"
                    value={editForm.contactEmail}
                    onChange={handleEditChange}
                    placeholder="contact@example.com"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="ef-status">Status</Label>
                  <select
                    id="ef-status"
                    name="status"
                    value={editForm.status}
                    onChange={handleEditChange}
                    className="flex h-9 w-full rounded-xl border border-input bg-white px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Update Franchise"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Reset Password Dialog ──────────────────────────────────────── */}
        <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Administrator Password</DialogTitle>
              <DialogDescription>Enter a new password for this administrator.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                resetPasswordMutation.mutate({ adminId: resetAdminId, password: newPassword });
              }}
            >
              <div className="app-form-fields">
                <div className="grid gap-1">
                  <Label htmlFor="np">New Password</Label>
                  <Input
                    id="np"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                  <p className="app-helper">Password must be at least 6 characters.</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsResetOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resetPasswordMutation.isPending || !newPassword || newPassword.length < 6}
                >
                  {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Delete admin confirm ───────────────────────────────────────── */}
        <ConfirmDialog
          open={!!pendingDeleteAdminId}
          onOpenChange={(open) => !open && setPendingDeleteAdminId(null)}
          onConfirm={() => pendingDeleteAdminId && deleteAdminMutation.mutate(pendingDeleteAdminId)}
          loading={deleteAdminMutation.isPending}
          title="Delete administrator?"
          description="This will permanently remove this administrator's access. This action cannot be undone."
          confirmText="Delete administrator"
        />
      </PageContent>
    </MainLayout>
  );
}
