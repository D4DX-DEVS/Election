import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NomineeCard } from "@/components/nominees/NomineeCard";
import { Progress } from "@/components/ui/progress";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ElectionWithDetails, VoteValidationError } from "@/lib/types";
import { getElectionLabel } from "@/lib/electionHelpers";
import { Nominee } from "@shared/schema";

interface BallotFormProps {
  election: ElectionWithDetails;
  nominees: Nominee[];
  onSubmit: (selectedNomineeIds: number[]) => void;
}

export function BallotForm({ election, nominees, onSubmit }: BallotFormProps) {
  const [selectedNominees, setSelectedNominees] = useState<number[]>([]);
  const [validationError, setValidationError] = useState<VoteValidationError | null>(null);

  // Count selected by gender
  const maleNominees = nominees.filter(n => n.gender === 'male');
  const femaleNominees = nominees.filter(n => n.gender === 'female');
  
  const selectedMaleCount = selectedNominees.filter(
    id => maleNominees.some(n => n.id === id)
  ).length;
  
  const selectedFemaleCount = selectedNominees.filter(
    id => femaleNominees.some(n => n.id === id)
  ).length;

  // Handle nominee selection
  const handleNomineeSelection = (nomineeId: number, isSelected: boolean) => {
    if (isSelected) {
      // Check if adding this would exceed maximum
      if (selectedNominees.length >= election.numberToBeElected) {
        setValidationError({
          message: `You can only select up to ${election.numberToBeElected} nominees`,
          type: 'max'
        });
        return;
      }
      setSelectedNominees([...selectedNominees, nomineeId]);
    } else {
      setSelectedNominees(selectedNominees.filter(id => id !== nomineeId));
    }
  };

  // Validate form before submission
  const handleSubmit = () => {
    // Validate male minimum
    if (election.maleMinimum && selectedMaleCount < election.maleMinimum) {
      setValidationError({
        message: `You must select at least ${election.maleMinimum} male nominees`,
        type: 'male'
      });
      return;
    }
    
    // Validate female minimum
    if (election.femaleMinimum && selectedFemaleCount < election.femaleMinimum) {
      setValidationError({
        message: `You must select at least ${election.femaleMinimum} female nominees`,
        type: 'female'
      });
      return;
    }
    
    // All checks passed, submit the vote
    onSubmit(selectedNominees);
  };

  // Clear validation error when selection changes
  useEffect(() => {
    if (validationError) {
      setValidationError(null);
    }
  }, [selectedNominees]);

  return (
    <Card className="mb-6">
      <div className="bg-primary text-white px-6 py-4 rounded-t-lg">
        <h2 className="text-xl font-bold">{getElectionLabel(election)}</h2>
        <p className="text-sm">{new Date(election.electionDate).toLocaleDateString("en-GB")}</p>
      </div>
      <CardContent className="p-6">
        <div className="mb-6">
          <p className="text-gray-700">
            Please select <span className="font-bold">up to {election.numberToBeElected}</span> candidates from the list below.
          </p>
          {(election.maleMinimum > 0 || election.femaleMinimum > 0) && (
            <p className="text-sm text-gray-500 mt-1">
              You must select at least 
              {election.maleMinimum > 0 && ` ${election.maleMinimum} male`}
              {election.maleMinimum > 0 && election.femaleMinimum > 0 && ' and'}
              {election.femaleMinimum > 0 && ` ${election.femaleMinimum} female`} candidates.
            </p>
          )}
        </div>

        {validationError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError.message}</AlertDescription>
          </Alert>
        )}

        <div className="w-full h-48 bg-gray-100 rounded-lg mb-6 flex items-center justify-center">
          <svg
            className="w-16 h-16 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {nominees.map((nominee) => (
            <NomineeCard
              key={nominee.id}
              nominee={nominee}
              isSelectable
              isSelected={selectedNominees.includes(nominee.id)}
              onSelect={handleNomineeSelection}
              showDetailsOnClick={false}
            />
          ))}
        </div>

        <div className="bg-white p-4 rounded-lg mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Selection Summary</p>
              <p className="text-xs text-gray-500 mt-1">
                Selected: <span className="font-medium">{selectedNominees.length}</span>/{election.numberToBeElected}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">
                Male: <span className="font-medium">{selectedMaleCount}</span>
                {election.maleMinimum > 0 && `/${election.maleMinimum} required`}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Female: <span className="font-medium">{selectedFemaleCount}</span>
                {election.femaleMinimum > 0 && `/${election.femaleMinimum} required`}
              </p>
            </div>
          </div>
          
          <div className="mt-2">
            <Progress
              value={(selectedNominees.length / election.numberToBeElected) * 100}
              className="h-2"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={
              selectedNominees.length === 0 ||
              (election.maleMinimum > 0 && selectedMaleCount < election.maleMinimum) ||
              (election.femaleMinimum > 0 && selectedFemaleCount < election.femaleMinimum)
            }
          >
            Submit Vote
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
