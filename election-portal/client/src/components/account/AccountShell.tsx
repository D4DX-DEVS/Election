import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import VoterLayout from "@/components/layouts/VoterLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthUser } from "@/lib/authUser";
import { PageContent } from "@/components/layout/PageContent";

interface AccountShellProps {
  children: ReactNode;
  title?: string;
  voterShowBack?: boolean;
}

function LoadingShell() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="space-y-3 w-full max-w-md px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

export function AccountShell({ children, title, voterShowBack = true }: AccountShellProps) {
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
  });

  if (isLoading) return <LoadingShell />;

  const isVoter = user?.role === "voter" || user?.isVoter;

  if (isVoter) {
    return (
      <VoterLayout title={title} showBack={voterShowBack}>
        <div className="px-4 pt-4 pb-4 max-w-lg mx-auto w-full">{children}</div>
      </VoterLayout>
    );
  }

  return (
    <MainLayout>
      <PageContent>{children}</PageContent>
    </MainLayout>
  );
}
