import { apiRequest } from "@/lib/queryClient";

export type BulkDeleteResult = {
  deleted: string[];
  failed: Array<{ id: string; error: string }>;
};

export async function deleteByIds(
  ids: string[],
  buildUrl: (id: string) => string
): Promise<BulkDeleteResult> {
  const deleted: string[] = [];
  const failed: BulkDeleteResult["failed"] = [];

  await Promise.all(
    ids.map(async (id) => {
      try {
        const response = await apiRequest("DELETE", buildUrl(id));
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          failed.push({
            id,
            error: body.message || body.error || `HTTP ${response.status}`,
          });
          return;
        }
        deleted.push(id);
      } catch (error) {
        failed.push({
          id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    })
  );

  return { deleted, failed };
}
