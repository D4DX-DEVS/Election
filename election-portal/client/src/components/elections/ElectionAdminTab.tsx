import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, UserPlus, ShieldCheck } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CompactList, CompactListPrimary, CompactListRow, CompactListSecondary } from "@/components/ui/compact-list";

const schema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

export function ElectionAdminTab({
  electionId,
  franchiseId,
  electionTitle,
}: {
  electionId: string;
  franchiseId?: string;
  electionTitle?: string;
}) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "", fullName: "" },
  });

  // Existing election admins (filtered to this election)
  const { data: adminsResp, isLoading } = useQuery({
    queryKey: ["/api/users/election-admins", electionId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/election-admins");
      return res.json();
    },
  });

  const admins = (Array.isArray(adminsResp?.data) ? adminsResp.data : []).filter(
    (a: any) => {
      const access = Array.isArray(a.electionAccess)
        ? a.electionAccess.map((x: any) => x?._id?.toString() || x?.toString())
        : [];
      return access.includes(electionId);
    },
  );

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("POST", "/api/users/election-admin", {
        ...data,
        franchiseId: franchiseId || undefined,
        electionAccess: [electionId],
      });
    },
    onSuccess: () => {
      toast({
        title: "Election administrator created",
        description: "They can now sign in and manage this election.",
        variant: "success",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/users/election-admins"] });
    },
    onError: (err: unknown) => {
      toast({
        title: "Could not create administrator",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => createMutation.mutate(data);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Create Election Admin
          </CardTitle>
          <CardDescription>
            This administrator will only be able to manage
            {electionTitle ? ` "${electionTitle}"` : " this election"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2.5">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="john_admin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          className="pr-10"
                          placeholder="••••••"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? "Creating..." : "Create Election Admin"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Existing admins */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Election Admins
          </CardTitle>
          <CardDescription>Administrators with access to this election.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : admins.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No election admins yet for this election.
            </div>
          ) : (
            <CompactList className="rounded-none border-0">
              {admins.map((a: any) => (
                <CompactListRow key={a._id}>
                  <CompactListPrimary>{a.fullName || "—"}</CompactListPrimary>
                  <CompactListSecondary>{a.username}</CompactListSecondary>
                </CompactListRow>
              ))}
            </CompactList>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ElectionAdminTab;
