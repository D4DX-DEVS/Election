import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { ElectionAnalytic } from "@shared/schema";

interface VotingStatsProps {
  analytics: ElectionAnalytic;
  electionDate?: Date;
  onSendReminder?: () => void;
  sendReminderPending?: boolean;
  votingOpen?: boolean;
}

export function VotingStats({
  analytics,
  electionDate,
  onSendReminder,
  sendReminderPending = false,
  votingOpen = true,
}: VotingStatsProps) {
  const totalVoters = analytics.totalVoters ?? 0;
  const totalVotesCast = analytics.totalVotesCast ?? 0;
  // Calculate participation percentage
  const participationPercentage = totalVoters > 0
    ? Math.round((totalVotesCast / totalVoters) * 100)
    : 0;
  const pendingVoters = analytics.pendingVoters ?? Math.max(totalVoters - totalVotesCast, 0);

  return (
    <Card>
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <CardTitle>Voting Statistics</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-2 md:hidden">
            <div className="rounded-md bg-white p-3">
              <p className="text-[11px] font-medium leading-tight text-gray-500">Turnout</p>
              <p className="mt-1 text-lg font-semibold leading-none text-gray-900">{participationPercentage}%</p>
            </div>
            <div className="rounded-md bg-white p-3">
              <p className="text-[11px] font-medium leading-tight text-gray-500">Votes</p>
              <p className="mt-1 text-lg font-semibold leading-none text-gray-900">{totalVotesCast}</p>
            </div>
            <div className="rounded-md bg-white p-3">
              <p className="text-[11px] font-medium leading-tight text-gray-500">Pending</p>
              <p className="mt-1 text-lg font-semibold leading-none text-gray-900">{pendingVoters}</p>
            </div>
          </div>

          <div className="hidden md:block">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Voter Participation</h3>
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block text-primary">
                    {participationPercentage}%
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-primary">
                    {totalVotesCast}/{totalVoters}
                  </span>
                </div>
              </div>
              <Progress value={participationPercentage} className="h-2.5 mb-4" />
            </div>
          </div>

          <div className="hidden bg-white rounded-lg p-4 md:block">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Total Votes Cast</h3>
            <p className="text-3xl font-bold text-gray-900">{totalVotesCast}</p>
          </div>

          <div className="hidden md:block">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Pending Voters</h3>
            <p className="text-3xl font-bold text-gray-900">{pendingVoters}</p>
            <div className="mt-2">
              {onSendReminder && (
                <Button 
                  variant="outline" 
                  className="w-full text-sm" 
                  onClick={onSendReminder}
                  disabled={sendReminderPending || !votingOpen || pendingVoters === 0}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {sendReminderPending ? "Sending…" : "Send Reminder"}
                </Button>
              )}
              {!votingOpen && (
                <p className="text-xs text-gray-500 mt-2 text-center">Voting must be open to send reminders.</p>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">Election Status</h3>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                {analytics.isFinalized ? 'Completed' : 'Active'}
              </div>
            </div>
            {electionDate && (
              <div className="mt-2 text-sm text-gray-500">
                Election date: {formatDate(electionDate)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };
  
  return new Date(date).toLocaleString('en-GB', options);
}
