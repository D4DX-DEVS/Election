import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { AccountShell } from "@/components/account/AccountShell";
import { PageHeader } from "@/components/layout/PageContent";
import { FranchiseSettingsCard } from "@/components/account/FranchiseSettingsCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AuthUser,
  formatDateTime,
  formatRoleLabel,
  syncAuthUserToStorage,
} from "@/lib/authUser";
import {
  Building2,
  Calendar,
  Hash,
  Lock,
  Mail,
  Shield,
} from "lucide-react";

interface FranchiseSummary {
  name?: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

export default function Profile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    document.title = "Profile | Vote+";
  }, []);

  const { data: user, isLoading, isError, error } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    if (isError && /^401:/.test((error as Error)?.message || "")) {
      navigate("/login");
    }
  }, [isError, error, navigate]);

  // Profile management is an admin-tier feature — plain voters have no
  // account settings to manage here, so send them back to their ballot list.
  useEffect(() => {
    if (user?.role === "voter") {
      navigate("/voting");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const franchiseId = user?.franchiseId;
  const isFranchiseAdmin = user?.role === "franchise_admin";
  // Franchise admins get the full "My Franchise" card below, so this lookup is
  // only for the other roles' read-only summary line.
  const { data: franchiseResp } = useQuery<{ data?: FranchiseSummary } | FranchiseSummary>({
    queryKey: franchiseId ? [`/api/franchises/${franchiseId}`] : ["profile-franchise-skip"],
    enabled: !!franchiseId && !isFranchiseAdmin,
  });
  // The API wraps the record in { success, data } — read through the envelope
  // so this shows the name instead of falling back to the raw id.
  const franchiseName =
    (franchiseResp as { data?: FranchiseSummary })?.data?.name ??
    (franchiseResp as FranchiseSummary)?.name;

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/auth/me", { fullName, email });
      return res.json();
    },
    onSuccess: (body) => {
      const updated = body.user as AuthUser;
      syncAuthUserToStorage(updated);
      queryClient.setQueryData(["/api/auth/me"], updated);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Profile updated",
        description: "Your account details were saved.",
        variant: "success",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not update profile",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({
        title: "Full name required",
        description: "Please enter your full name.",
        variant: "destructive",
      });
      return;
    }
    updateProfileMutation.mutate();
  };

  const displayName = user?.fullName || user?.username || "User";

  // Voters are redirected away (effect above) — render nothing in the
  // meantime instead of flashing admin-only account fields.
  if (user?.role === "voter") {
    return null;
  }

  return (
    <AccountShell title="Profile">
      <PageHeader
        title="Profile"
        description="View and update your personal account information."
      />

      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <Avatar className="h-16 w-16 shrink-0">
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="app-page-title min-w-0 truncate">{displayName}</p>
                    {user?.status && (
                      <Badge
                        variant={user.status === "active" ? "outline" : "secondary"}
                        className={
                          user.status === "active"
                            ? "shrink-0 bg-green-100 text-green-800 hover:bg-green-100"
                            : "shrink-0 bg-gray-100 text-gray-800 hover:bg-primary/10"
                        }
                      >
                        {user.status}
                      </Badge>
                    )}
                  </div>
                  <p className="app-muted truncate">@{user?.username || "—"}</p>
                </div>
                <Button variant="outline" size="sm" className="mt-2 shrink-0 self-start sm:mt-0 sm:self-auto" asChild>
                  <Link href="/settings">
                    <Lock className="h-4 w-4 mr-1.5" />
                    Change password
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Franchise admins manage their own organisation's details here — full
            width so it doesn't leave a gap beside the two-column grid below. */}
        {user?.role === "franchise_admin" && franchiseId && (
          <FranchiseSettingsCard franchiseId={String(franchiseId)} />
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="p-4 pb-0 md:p-5 md:pb-0">
              <CardTitle>Edit profile</CardTitle>
              <CardDescription>Update the details shown on your account.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-3 md:p-5 md:pt-3">
              {isLoading ? (
                <p className="app-muted">Loading profile…</p>
              ) : (
                <form onSubmit={handleSubmit} className="app-form-fields">
                  <div className="grid gap-1">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                      autoComplete="name"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={user?.username || ""}
                      disabled
                      className="disabled:opacity-100 disabled:text-gray-900 disabled:bg-gray-50"
                    />
                    <p className="app-helper">Username cannot be changed.</p>
                  </div>
                  <Button type="submit" disabled={updateProfileMutation.isPending}>
                    {updateProfileMutation.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-0 md:p-5 md:pb-0">
              <CardTitle>Account details</CardTitle>
              <CardDescription>Information managed by your organization.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-3 md:p-5 md:pt-3 space-y-4">
              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="app-helper">Role</p>
                  <p className="app-body font-medium">{formatRoleLabel(user?.role)}</p>
                </div>
              </div>

              {/* Franchise admins see their organisation in the card below. */}
              {franchiseId && !isFranchiseAdmin && franchiseName && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="app-helper">Franchise</p>
                    <p className="app-body font-medium truncate">{franchiseName}</p>
                  </div>
                </div>
              )}

              {user?.registrationNumber && (
                <div className="flex items-start gap-3">
                  <Hash className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="app-helper">Registration number</p>
                    <p className="app-body font-medium">{user.registrationNumber}</p>
                  </div>
                </div>
              )}

              {user?.electionAccess && user.electionAccess.length > 0 && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="app-helper">Assigned elections</p>
                    <p className="app-body font-medium">{user.electionAccess.length}</p>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="app-helper">Member since</p>
                  <p className="app-body font-medium">{formatDateTime(user?.createdAt)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="app-helper">Last login</p>
                  <p className="app-body font-medium">{formatDateTime(user?.lastLogin)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AccountShell>
  );
}
