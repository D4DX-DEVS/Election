import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AccountShell } from "@/components/account/AccountShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Lock } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    document.title = "Change Password | Vote+";
  }, []);

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
        variant: "success",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => {
      toast({
        title: "Could not update password",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Use at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please re-enter the same password.",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate();
  };

  return (
    <AccountShell title="Change Password">
      <div className="mb-6">
        <h1 className="app-page-title flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          Change Password
        </h1>
        <p className="text-sm text-gray-600">
          Enter your current password, then choose a new one.
        </p>
      </div>

      <div className="space-y-3">
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? "Updating…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AccountShell>
  );
}
