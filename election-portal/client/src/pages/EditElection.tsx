import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { ElectionForm } from "@/components/elections/ElectionForm";
import { useToast } from "@/hooks/use-toast";
import { getElectionLabel, isElectionLocked, buildElectionSubmitPayload } from "@/lib/electionHelpers";
import { apiRequest, apiFormRequest, queryClient } from "@/lib/queryClient";
import { PageContent, PageHeader } from "@/components/layout/PageContent";

export default function EditElection() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: election, isLoading: isElectionLoading } = useQuery({
    queryKey: [`/api/elections/${id}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/elections/${id}`);
      const json = await res.json();
      return json.data ?? json;
    },
    enabled: !!id,
  });

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (!id) return;
    try {
      const { payload, logoFile } = buildElectionSubmitPayload(formData);

      if (logoFile) {
        const body = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== undefined && value !== null) body.append(key, String(value));
        });
        body.append("logo", logoFile);
        await apiFormRequest("PUT", `/api/elections/${id}`, body);
      } else {
        await apiRequest("PUT", `/api/elections/${id}`, payload);
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/elections"] });
      await queryClient.invalidateQueries({ queryKey: [`/api/elections/${id}`] });

      toast({
        title: "Election updated",
        description: "The election has been successfully updated.",
        variant: "success",
      });

      navigate(`/elections/${id}`);
    } catch (error) {
      console.error("Error updating election:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "There was a problem updating the election. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => navigate("/elections");

  useEffect(() => {
    document.title = election
      ? `Edit ${getElectionLabel(election)} | Vote+`
      : "Edit Election | Vote+";
  }, [election]);

  useEffect(() => {
    if (!election || isElectionLoading) return;
    const status = election?.status;
    if (isElectionLocked(status)) {
      toast({
        title: "Election is locked",
        description: "Completed elections cannot be edited. View results instead.",
        variant: "destructive",
      });
      navigate(`/elections/${id}?tab=results`);
    }
  }, [election, id, isElectionLoading, navigate, toast]);

  if (isElectionLoading) {
    return (
      <MainLayout>
        <div>Loading...</div>
      </MainLayout>
    );
  }

  if (!election) {
    return (
      <MainLayout>
        <div>Election not found.</div>
      </MainLayout>
    );
  }

  const electionData = election;
  if (isElectionLocked(electionData?.status)) {
    return null;
  }

  return (
    <MainLayout>
      <PageContent>
      <PageHeader
        title="Edit Election"
        description={getElectionLabel(election)}
      />

      <ElectionForm
        key={id}
        initialValues={electionData}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
      </PageContent>
    </MainLayout>
  );
}
