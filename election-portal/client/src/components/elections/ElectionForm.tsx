import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertElectionSchema } from "@shared/schema";
import { Franchise } from "@shared/schema";
import {
  resolveElectionFormDefaults,
  applyElectionLifecycleRules,
  toFormBoolean,
} from "@/lib/electionHelpers";
import { useToast } from "@/hooks/use-toast";

const formBoolean = z.preprocess((value) => toFormBoolean(value, false), z.boolean());

const formSchema = insertElectionSchema.extend({
    organization: z
      .string()
      .min(1, "Organization is required")
      .refine((value) => /[a-zA-Z]/.test(value.trim()), {
        message: "Name must contain at least one letter — numbers only is not allowed.",
      }),
    electionDate: z.string().min(1, "Election date is required"),
    numberToBeElected: z.coerce.number().min(1, "Must elect at least 1 person"),
    ballotSelectionRule: z.enum(["exact", "up_to"]).default("exact"),
    maxVoters: z.coerce.number().int().min(0).optional(),
    maleMinimum: z.coerce.number().int().min(0).optional(),
    femaleMinimum: z.coerce.number().int().min(0).optional(),
    genderBasedSelection: formBoolean.optional(),
    selfRegOpen: formBoolean.optional(),
    votingOpen: formBoolean.optional(),
    adminVotingDetailsEnabled: formBoolean.optional(),
    manualWinnerSelection: formBoolean.optional(),
    file: z.any().optional(),
  });

type FormValues = z.infer<typeof formSchema>;

interface ElectionFormProps {
  initialValues?: Partial<FormValues>;
  franchises?: Franchise[];
  showFranchiseSelect?: boolean;
  onSubmit: (values: FormValues & { title: string }) => void;
  onCancel: () => void;
}

export function ElectionForm({
  initialValues,
  franchises = [],
  showFranchiseSelect = false,
  onSubmit,
  onCancel,
}: ElectionFormProps) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const formDefaults = useMemo(
    () => resolveElectionFormDefaults(initialValues as Record<string, unknown> | undefined),
    [initialValues]
  );

  const { register, handleSubmit, formState, setValue, watch, reset, control } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: formDefaults,
  });

  useEffect(() => {
    reset(resolveElectionFormDefaults(initialValues as Record<string, unknown> | undefined), {
      keepDefaultValues: false,
    });
  }, [initialValues, reset]);

  const electionDateValue = watch("electionDate");
  const votingOpenValue = watch("votingOpen");
  const nomineeDisplayOrder = watch("nomineeDisplayOrder");
  const voterResultDisplay = watch("voterResultDisplay");
  const ballotSelectionRule = watch("ballotSelectionRule");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <form
          onSubmit={handleSubmit(
            (values) => {
              const withLifecycle = applyElectionLifecycleRules({
                ...values,
                title: values.organization.trim(),
                maxNominees: values.numberToBeElected,
              });
              onSubmit({
                ...withLifecycle,
                logoFile: selectedFile,
              } as FormValues & { title: string; logoFile: File | null });
            },
            (errors) => {
              const message =
                Object.values(errors)
                  .map((err) => err?.message)
                  .filter(Boolean)
                  .join(". ") || "Please check the form and try again.";
              toast({
                title: "Could not save election",
                description: String(message),
                variant: "destructive",
              });
            }
          )}
        >
          <div className="mb-5 grid grid-cols-1 gap-4 md:mb-6 md:grid-cols-2 md:gap-6">
            <div>
              <Label htmlFor="organization">Organization Name</Label>
              <Input
                id="organization"
                placeholder="e.g. Global Technologies Corp"
                {...register("organization")}
                className="mt-1"
              />
              {formState.errors.organization && (
                <p className="text-sm text-red-500 mt-1">{formState.errors.organization.message}</p>
              )}
            </div>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-4 md:mb-6 md:grid-cols-3 md:gap-6">
            <div>
              <Label htmlFor="electionDate">Election Date</Label>
              <Input
                id="electionDate"
                type="date"
                value={electionDateValue || ""}
                onChange={(e) =>
                  setValue("electionDate", e.target.value, { shouldValidate: true, shouldDirty: true })
                }
                className="mt-1"
              />
              {formState.errors.electionDate && (
                <p className="text-sm text-red-500 mt-1">{formState.errors.electionDate.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="numberToBeElected">Number of Positions</Label>
              <Input
                id="numberToBeElected"
                type="number"
                min="1"
                placeholder="e.g. 5"
                {...register("numberToBeElected", { valueAsNumber: true })}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                How many nominees each voter selects and how many can be elected
              </p>
              {formState.errors.numberToBeElected && (
                <p className="text-sm text-red-500 mt-1">{formState.errors.numberToBeElected.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="ballotSelectionRule">Required Voter Selection</Label>
              <Select
                value={ballotSelectionRule || "exact"}
                onValueChange={(value: "exact" | "up_to") =>
                  setValue("ballotSelectionRule", value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="ballotSelectionRule" className="mt-1">
                  <SelectValue placeholder="Select ballot rule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Exactly the number of positions</SelectItem>
                  <SelectItem value="up_to">Up to the number of positions</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-gray-500">
                {ballotSelectionRule === "up_to"
                  ? "A voter may submit fewer selections, but never more."
                  : "A voter must fill every available position before submitting."}
              </p>
            </div>
            <div>
              <Label htmlFor="nomineeDisplayOrder">Nominee Display Order</Label>
              <Select
                value={nomineeDisplayOrder || "ALPHA"}
                onValueChange={(value) => setValue("nomineeDisplayOrder", value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALPHA">Alphabetical</SelectItem>
                  <SelectItem value="VOTE">Vote Count</SelectItem>
                  <SelectItem value="CUSTOM">Custom Order</SelectItem>
                </SelectContent>
              </Select>
              {formState.errors.nomineeDisplayOrder && (
                <p className="text-sm text-red-500 mt-1">{formState.errors.nomineeDisplayOrder.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="voterResultDisplay">Voter Result Display</Label>
              <Select
                value={voterResultDisplay || "full"}
                onValueChange={(value) => setValue("voterResultDisplay", value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select what voters see" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Result (hide from voters)</SelectItem>
                  <SelectItem value="result_only">Only Result (winners)</SelectItem>
                  <SelectItem value="percentage">Result with Percentage</SelectItem>
                  <SelectItem value="score">Result with Score (votes)</SelectItem>
                  <SelectItem value="full">Result with Score &amp; Percentage</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">Controls how much detail published results show to voters</p>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-4 md:mb-6 md:grid-cols-2 md:gap-6">
            <div>
              <Label htmlFor="maxVoters">Max Voters to Participate</Label>
              <Input
                id="maxVoters"
                type="number"
                min="0"
                placeholder="e.g. 500"
                {...register("maxVoters", { valueAsNumber: true })}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                How many voters can vote in this election, not your total voter list (0 = no limit)
              </p>
              {formState.errors.maxVoters && (
                <p className="text-sm text-red-500 mt-1">{formState.errors.maxVoters.message}</p>
              )}
            </div>
            {watch("genderBasedSelection") === true && (
              <>
                <div>
                  <Label htmlFor="maleMinimum">Male Minimum</Label>
                  <Input
                    id="maleMinimum"
                    type="number"
                    min="0"
                    placeholder="e.g. 2"
                    {...register("maleMinimum", { valueAsNumber: true })}
                    className="mt-1"
                  />
                  {formState.errors.maleMinimum && (
                    <p className="text-sm text-red-500 mt-1">{formState.errors.maleMinimum.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="femaleMinimum">Female Minimum</Label>
                  <Input
                    id="femaleMinimum"
                    type="number"
                    min="0"
                    placeholder="e.g. 2"
                    {...register("femaleMinimum", { valueAsNumber: true })}
                    className="mt-1"
                  />
                  {formState.errors.femaleMinimum && (
                    <p className="text-sm text-red-500 mt-1">{formState.errors.femaleMinimum.message}</p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="mb-5 grid grid-cols-1 gap-4 md:mb-6 md:grid-cols-2 md:gap-6">
            <div className="flex items-center space-x-2">
              <Controller
                name="genderBasedSelection"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="genderBasedSelection"
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <div>
                <Label htmlFor="genderBasedSelection" className="font-medium text-gray-700 cursor-pointer">
                  Gender-based selection
                </Label>
                <p className="text-xs text-gray-500">Collect and enforce male/female requirements for this election</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Controller
                name="selfRegOpen"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="selfRegOpen"
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <div>
                <Label htmlFor="selfRegOpen" className="font-medium text-gray-700 cursor-pointer">
                  Allow Self Registration
                </Label>
                <p className="text-xs text-gray-500">Enable voters to self-register for this election</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Controller
                name="votingOpen"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="votingOpen"
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <div>
                <Label htmlFor="votingOpen" className="font-medium text-gray-700 cursor-pointer">
                  Open Voting
                </Label>
                <p className="text-xs text-gray-500">
                  {votingOpenValue
                    ? "Election will be marked Active while voting is open."
                    : "Enable voting as soon as election is created"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Controller
                name="adminVotingDetailsEnabled"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="adminVotingDetailsEnabled"
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <div>
                <Label htmlFor="adminVotingDetailsEnabled" className="font-medium text-gray-700 cursor-pointer">
                  Admin Voting Details
                </Label>
                <p className="text-xs text-gray-500">
                  Let admins see who each voter selected. Never shown to voters or included in printed results.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Controller
                name="manualWinnerSelection"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="manualWinnerSelection"
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <div>
                <Label htmlFor="manualWinnerSelection" className="font-medium text-gray-700 cursor-pointer">
                  Manual Winner Selection
                </Label>
                <p className="text-xs text-gray-500">
                  Choose winners manually after voting ends instead of auto-calculating from vote counts.
                </p>
              </div>
            </div>
          </div>

          {showFranchiseSelect && (
            <div className="mb-6">
              <Label htmlFor="franchiseId">Franchise</Label>
              <Select
                onValueChange={(value) => {
                  if (value) setValue("franchiseId", value);
                  else setValue("franchiseId", undefined);
                }}
                defaultValue={watch("franchiseId") ? String(watch("franchiseId")) : ""}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select franchise" />
                </SelectTrigger>
                <SelectContent>
                  {franchises?.map((franchise) => {
                    if (!franchise) return null;
                    const franchiseId = franchise._id ? String(franchise._id) : franchise.id ? String(franchise.id) : "";
                    const name = franchise.name || "";
                    if (!franchiseId) return null;
                    return (
                      <SelectItem key={franchiseId} value={franchiseId}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {formState.errors.franchiseId && (
                <p className="text-sm text-red-500 mt-1">{formState.errors.franchiseId.message}</p>
              )}
            </div>
          )}

          <div className="mb-6">
            <Label htmlFor="logo">Election Logo (Optional)</Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Label
                htmlFor="logo"
                className="cursor-pointer inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-primary/5 transition"
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose File
              </Label>
              <span className="min-w-0 break-all text-sm text-gray-500">
                {selectedFile ? selectedFile.name : "No file chosen"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting} className="w-full sm:w-auto">
              {initialValues ? "Update Election" : "Create Election"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
