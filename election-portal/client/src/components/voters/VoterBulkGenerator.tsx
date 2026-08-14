import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Shuffle } from "lucide-react";
import { BulkVoterGenerationOptions } from "@/lib/types";
import { getElectionLabel } from "@/lib/electionHelpers";
import { SelectCheckbox } from "@/components/ui/row-select-checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { shufflePrefix, generateRandomPrefix, buildUsernamePreview } from "@/lib/voterPrefix";

interface VoterBulkGeneratorProps {
  elections: Array<{
    _id: string;
    id?: string;
    title?: string;
    organization: string;
  }>;
  voterGroups?: Array<{
    _id: string;
    name?: string;
    description?: string;
    voters?: string[];
  }>;
  onGenerate: (options: BulkVoterGenerationOptions) => void;
  onCancel?: () => void;
  isGenerating?: boolean;
  fixedElectionId?: string;
}

export function VoterBulkGenerator({
  elections,
  voterGroups = [],
  onGenerate,
  onCancel,
  isGenerating = false,
  fixedElectionId,
}: VoterBulkGeneratorProps) {
  const [prefix, setPrefix] = useState<string>(() => generateRandomPrefix());
  const [startingNumber, setStartingNumber] = useState<number>(1001);
  const [count, setCount] = useState<number>(10);
  const [selectedElections, setSelectedElections] = useState<string[]>(fixedElectionId ? [fixedElectionId] : []);
  const [selectedVoterGroupId, setSelectedVoterGroupId] = useState<string>("");
  const [assignmentType, setAssignmentType] = useState<"election" | "voterGroup">("election");

  useEffect(() => {
    if (fixedElectionId) {
      setAssignmentType("election");
      setSelectedElections([fixedElectionId]);
    }
  }, [fixedElectionId]);

  const usernamePreview = buildUsernamePreview(prefix, startingNumber, count);

  const toggleElectionId = (electionId: string) => {
    setSelectedElections((prev) =>
      prev.includes(electionId)
        ? prev.filter((id) => id !== electionId)
        : [...prev, electionId]
    );
  };

  const handleSubmit = () => {
    if (count > 100) {
      // Show warning for large number of voters
      if (!confirm(`Are you sure you want to generate ${count} voters? This may take some time.`)) {
        return;
      }
    }

    // Prepare generation options
    const options: BulkVoterGenerationOptions = {
      prefix,
      shuffledPrefix: prefix.trim(),
      startingNumber,
      count,
      assignmentType: assignmentType
    };

    // Add election-specific options
    if (assignmentType === "election" && selectedElections.length > 0) {
      options.electionIds = selectedElections;
    } else if (assignmentType === "voterGroup" && selectedVoterGroupId) {
      options.voterGroupId = selectedVoterGroupId;
    }

    onGenerate(options);
  };

  // Form validation
  const isValid = 
    prefix.trim().length > 0 && 
    startingNumber > 0 && 
    count > 0 && 
    count <= 1000 && // Reasonable limit
    (
      (assignmentType === "election" && selectedElections.length > 0) ||
      (assignmentType === "voterGroup" && selectedVoterGroupId !== "")
    );

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="prefix">Prefix</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                placeholder="e.g. KXRM"
                className="flex-1 font-mono"
                disabled={isGenerating}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                title="Generate new random prefix"
                disabled={isGenerating}
                onClick={() => setPrefix((current) => shufflePrefix(current))}
              >
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="startingNumber">Starting Number</Label>
            <Input
              id="startingNumber"
              type="number"
              value={startingNumber}
              onChange={(e) => setStartingNumber(parseInt(e.target.value) || 0)}
              min={1}
              placeholder="e.g. 1001"
              className="mt-1"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500 mt-1">
              First sequential number to use
            </p>
          </div>
          <div>
            <Label htmlFor="userCount">Number of Voters</Label>
            <Input
              id="userCount"
              type="number"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 0)}
              min={1}
              max={1000}
              placeholder="e.g. 10"
              className="mt-1"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum 1000 voters at once
            </p>
          </div>
        </div>

        <p className="text-xs text-blue-600 bg-blue-50 rounded p-2">
          Usernames: <strong>{usernamePreview.from}</strong> to <strong>{usernamePreview.to}</strong> —
          unique random passwords.
        </p>

        {!fixedElectionId && (
          <div>
            <Label>Assignment Type</Label>
            <Tabs
              defaultValue="election"
              className="mt-2"
              onValueChange={(value) => setAssignmentType(value as "election" | "voterGroup")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="election">Single Election</TabsTrigger>
                <TabsTrigger value="voterGroup">Voter Group</TabsTrigger>
              </TabsList>

              <TabsContent value="election" className="mt-4">
                <Label htmlFor="electionAccess">Assign to Election</Label>
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-1 border rounded-md p-3">
                  {elections && elections.map((election) => {
                    const id = election?._id?.toString() || election?.id?.toString() || "";

                    if (!id) return null;
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <SelectCheckbox
                          checked={selectedElections.includes(id)}
                          onCheckedChange={() => !isGenerating && toggleElectionId(id)}
                          aria-label={`Select ${getElectionLabel(election)}`}
                        />
                        <span className="text-sm">{getElectionLabel(election)}</span>
                      </div>
                    );
                  })}
                </div>

                {selectedElections.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">
                      Voters will be assigned to {selectedElections.length} election(s)
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="voterGroup" className="mt-4">
                <Label>Select Voter Group</Label>
                <p className="text-xs text-gray-500 mb-3">New voters will be placed in the selected group and inherit its election access.</p>
                {voterGroups && voterGroups.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                    {voterGroups.map((group) => {
                      const id = group?._id?.toString();
                      if (!id) return null;
                      const isSelected = selectedVoterGroupId === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={isGenerating}
                          onClick={() => setSelectedVoterGroupId(id)}
                          className={cn(
                            "flex flex-col items-start gap-0.5 p-3 rounded-lg border-2 text-left transition-colors w-full",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-gray-200 hover:border-primary/50 hover:bg-primary/5"
                          )}
                        >
                          <span className="text-sm font-medium text-gray-800 truncate w-full">{group?.name || 'Untitled Group'}</span>
                          <span className="text-xs text-gray-400">{group?.voters?.length || 0} voters</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 py-4 text-center border rounded-md">No voter groups available. Create one first.</p>
                )}
                {selectedVoterGroupId && voterGroups.find(g => g._id === selectedVoterGroupId) && (
                  <p className="text-xs text-green-600 mt-2 font-medium">
                    ✓ Voters will be added to <strong>{voterGroups.find(g => g._id === selectedVoterGroupId)?.name}</strong>
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}



        <div className="bg-blue-50 p-4 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> Generated voter accounts will have usernames in the format 
            <code className="mx-1 px-1 bg-blue-100 rounded">{prefix}XXXX</code> 
            and unique randomly generated passwords. Passwords will be printed on voter credential slips.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isGenerating}>
              Cancel
            </Button>
          )}
          <Button 
            onClick={handleSubmit} 
            disabled={!isValid || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Voters'
            )}
          </Button>
        </div>

    </div>
  );
}
