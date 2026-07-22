import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { AccountShell } from "@/components/account/AccountShell";
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
  Mail,
  Settings,
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

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const franchiseId = user?.franchiseId;
  const { data: franchise } = useQuery<FranchiseSummary>({
    queryKey: franchiseId ? [`/api/franchises/${franchiseId}`] : ["profile-franchise-skip"],
    enabled: !!franchiseId,
  });

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

  return (
    <AccountShell title="Profile">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-600">
          View and update your personal account information.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold truncate">{displayName}</h2>
                <p className="text-sm text-muted-foreground">@{user?.username || "—"}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="gap-1">
                    <Shield className="h-3 w-3" />
                    {formatRoleLabel(user?.role)}
                  </Badge>
                  {user?.status && (
                    <Badge variant={user.status === "active" ? "default" : "secondary"}>
                      {user.status}
                    </Badge>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Account settings
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Edit profile</CardTitle>
              <CardDescription>Update the details shown on your account.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading profile…</p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
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
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" value={user?.username || ""} disabled />
                    <p className="text-xs text-muted-foreground">Username cannot be changed.</p>
                  </div>
                  <Button type="submit" disabled={updateProfileMutation.isPending}>
                    {updateProfileMutation.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account details</CardTitle>
              <CardDescription>Information managed by your organization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p className="font-medium">{formatRoleLabel(user?.role)}</p>
                </div>
              </div>

              {franchiseId && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Franchise</p>
                    <p className="font-medium">{franchise?.name || franchiseId}</p>
                  </div>
                </div>
              )}

              {user?.registrationNumber && (
                <div className="flex items-start gap-3">
                  <Hash className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Registration number</p>
                    <p className="font-medium">{user.registrationNumber}</p>
                  </div>
                </div>
              )}

              {user?.electionAccess && user.electionAccess.length > 0 && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned elections</p>
                    <p className="font-medium">{user.electionAccess.length}</p>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Member since</p>
                  <p className="font-medium">{formatDateTime(user?.createdAt)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Last login</p>
                  <p className="font-medium">{formatDateTime(user?.lastLogin)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AccountShell>
  );
}
