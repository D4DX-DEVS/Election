import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Building2 } from "lucide-react";

interface ElectionHomePanelProps {
  electionId: string;
  election: Record<string, any>;
  editable: boolean;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  try {
    return format(new Date(value), "PPP");
  } catch {
    return "—";
  }
}

/**
 * Label above value on narrow screens — side by side these labels and values are
 * both long enough to wrap, which reads as misaligned on a phone.
 */
function SettingRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 py-2.5 last:border-0 sm:flex sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-xs text-gray-500 sm:shrink-0 sm:text-sm">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900 sm:mt-0 sm:text-right">{value}</dd>
    </div>
  );
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </h3>
      <dl>{children}</dl>
    </div>
  );
}

const VOTER_RESULT_LABELS: Record<string, string> = {
  none: "No result (hidden from voters)",
  result_only: "Winners only",
  percentage: "Result with percentage",
  score: "Result with score",
  full: "Result with score & percentage",
};

export function ElectionHomePanel({ electionId, election, editable }: ElectionHomePanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Election details</h2>
            {editable && (
              <Link href={`/elections/${electionId}/edit`}>
                <Button variant="outline" size="sm">
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              </Link>
            )}
          </div>

          {election.franchise?.name && (
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
                {election.franchise.logo?.url ? (
                  <img
                    src={election.franchise.logo.url}
                    alt={election.franchise.logo.alt || election.franchise.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building2 className="h-4 w-4 text-primary/70" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Franchise</p>
                <p className="truncate text-sm font-semibold text-gray-900">{election.franchise.name}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <SettingGroup title="Schedule">
              <SettingRow label="Election date" value={formatDate(election.electionDate)} />
              {election.endDate && <SettingRow label="End date" value={formatDate(election.endDate)} />}
            </SettingGroup>

            <SettingGroup title="Ballot">
              <SettingRow label="Positions to fill" value={election.numberToBeElected ?? 1} />
              <SettingRow
                label="Voter must select"
                value={
                  election.ballotSelectionRule === "up_to"
                    ? `Up to ${election.numberToBeElected ?? 1}`
                    : `Exactly ${election.numberToBeElected ?? 1}`
                }
              />
              <SettingRow
                label="Nominee order"
                value={
                  election.nomineeDisplayOrder === "VOTE"
                    ? "Vote count"
                    : election.nomineeDisplayOrder === "CUSTOM"
                      ? "Custom order"
                      : "Alphabetical"
                }
              />
              {election.genderBasedSelection && (
                <SettingRow
                  label="Gender minimums"
                  value={`${election.maleMinimum || 0} male, ${election.femaleMinimum || 0} female`}
                />
              )}
            </SettingGroup>

            <SettingGroup title="Voters">
              <SettingRow
                label="Max voters"
                value={election.maxVoters ? election.maxVoters : "Unlimited"}
              />
              <SettingRow label="Self-registration" value={election.selfRegOpen ? "Enabled" : "Disabled"} />
            </SettingGroup>

            <SettingGroup title="Results">
              <SettingRow
                label="Voters see"
                value={VOTER_RESULT_LABELS[election.voterResultDisplay] || "No result (hidden from voters)"}
              />
              <SettingRow
                label="Generation"
                value={election.resultGenerationMode === "auto" ? "Automatic on completion" : "Manual (admin publishes)"}
              />
              <SettingRow
                label="Winner selection"
                value={election.manualWinnerSelection ? "Manual" : "Automatic by vote count"}
              />
              <SettingRow
                label="Admin voting details"
                value={election.adminVotingDetailsEnabled ? "Enabled" : "Disabled"}
              />
            </SettingGroup>
          </div>
        </CardContent>
      </Card>

      {!editable && (
        <p className="text-xs text-gray-400 px-1">
          <Badge variant="outline" className="mr-2 bg-gray-100 text-gray-600 border-gray-200">
            Locked
          </Badge>
          Completed or archived elections can't be edited.
        </p>
      )}
    </div>
  );
}
