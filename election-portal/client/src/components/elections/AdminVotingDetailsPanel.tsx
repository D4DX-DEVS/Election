import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface VoteDetailNominee {
  _id?: string;
  id?: string;
  name?: string;
}

interface VoteDetailRow {
  _id?: string;
  voter?: {
    fullName?: string | null;
    username?: string | null;
    registrationNumber?: string | null;
  } | null;
  nominees?: (VoteDetailNominee | string)[];
  timestamp?: string | Date | null;
}

interface AdminVotingDetailsPanelProps {
  electionId: string;
  enabled: boolean;
}

function nomineeLabel(n: VoteDetailNominee | string) {
  if (typeof n === "string") return n;
  return n.name || n._id || n.id || "Unknown";
}

export function AdminVotingDetailsPanel({ electionId, enabled }: AdminVotingDetailsPanelProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/vote/details", electionId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vote/details/${electionId}`);
      return res.json();
    },
    enabled: enabled && !!electionId,
  });

  if (!enabled) return null;

  const rows: VoteDetailRow[] = Array.isArray(data?.data) ? data.data : [];

  return (
    <Card className="mb-6 border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Admin Voting Details
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Confidential — shows each voter&apos;s ballot choices. Not shared with voters and excluded from print/export.
            </p>
          </div>
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 shrink-0">
            Admin only
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-gray-500">Loading voting details…</p>}
        {isError && (
          <p className="text-sm text-red-600">Could not load voting details. Ensure you have admin access.</p>
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <p className="text-sm text-gray-500">No votes recorded yet.</p>
        )}
        {!isLoading && !isError && rows.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-amber-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-600">
                  <th className="px-4 py-2 font-medium">Voter</th>
                  <th className="px-4 py-2 font-medium">Username</th>
                  <th className="px-4 py-2 font-medium">Selected Nominee(s)</th>
                  <th className="px-4 py-2 font-medium">Voted At</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const voterName = row.voter?.fullName || row.voter?.username || "Unknown voter";
                  const voterId = row.voter?.registrationNumber || row.voter?.username || "—";
                  const picks = (row.nominees || []).map(nomineeLabel).join(", ") || "—";
                  const votedAt = row.timestamp
                    ? new Date(row.timestamp).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
                    : "—";
                  return (
                    <tr key={row._id} className="border-b last:border-0">
                      <td className="px-4 py-2">{voterName}</td>
                      <td className="px-4 py-2 text-gray-600">{voterId}</td>
                      <td className="px-4 py-2">{picks}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{votedAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
