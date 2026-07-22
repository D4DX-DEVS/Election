import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { ElectionForm } from "@/components/elections/ElectionForm";
import { useToast } from "@/hooks/use-toast";
import { buildElectionSubmitPayload } from "@/lib/electionHelpers";
import { queryClient } from "@/lib/queryClient";

export default function CreateElection() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: user, isLoading: isLoadingUser, isError: isUserError } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  const userRole = user?.role || "";
  const franchiseId = user?.franchiseId || "";

  const { data: franchises, isLoading: isLoadingFranchises, isError: isFranchisesError } = useQuery({
    queryKey: ["/api/franchises"],
    enabled: userRole === "super_admin",
  });

  const handleSubmit = async (formData: Record<string, unknown>) => {
    try {
      const { payload, logoFile } = buildElectionSubmitPayload(formData);

      if (userRole === "franchise_admin" && franchiseId) {
        payload.franchiseId = franchiseId;
      }

      let response: Response;
      if (logoFile) {
        const body = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== undefined && value !== null) body.append(key, String(value));
        });
        body.append("logo", logoFile);
        response = await fetch("/api/elections", {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
          body,
        });
      } else {
        response = await fetch("/api/elections", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create election");
      }

      toast({
        title: "Election created",
        description: "The election has been successfully created.",
        variant: "success",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/elections"] });
      navigate("/elections");
    } catch (error) {
      console.error("Error creating election:", error);
      toast({
        title: "Error",
        description: "There was a problem creating the election. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => navigate("/elections");

  useEffect(() => {
    document.title = "Create Election | Vote+";
  }, []);

  const isLoading = isLoadingUser || (userRole === "super_admin" && isLoadingFranchises);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-3">Loading...</span>
        </div>
      </MainLayout>
    );
  }

  if (isUserError || isFranchisesError) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64 text-sm text-red-600">
          Failed to load account details. Please refresh the page.
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New Election</h1>
        <p className="text-sm text-gray-600">Configure your election parameters</p>
      </div>

      <ElectionForm
        franchises={userRole === "super_admin" ? franchises || [] : []}
        showFranchiseSelect={userRole === "super_admin"}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </MainLayout>
  );
}
