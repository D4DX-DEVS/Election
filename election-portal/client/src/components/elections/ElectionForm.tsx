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
      .min(1, "Election title is required")
      .refine((value) => !/\d/.test(value.trim()) && /[a-zA-Z]/.test(value.trim()), {
        message: "Name cannot contain numbers.",
      }),
    electionDate: z.string().min(1, "Election date is required"),
    endDate: z.string().optional(),
    numberToBeElected: z.coerce.number().min(1, "Must elect at least 1 person"),
    ballotSelectionRule: z.enum(["exact", "up_to"]).default("exact"),
    resultGenerationMode: z.enum(["auto", "manual"]).default("manual"),
    maxVoters: z.coerce.number().int().min(0).optional(),
    maleMinimum: z.coerce.number().int().min(0).optional(),
    femaleMinimum: z.coerce.number().int().min(0).optional(),
    genderBasedSelection: formBoolean.optional(),
    selfRegOpen: formBoolean.optional(),
    votingOpen: formBoolean.optional(),
    adminVotingDetailsEnabled: formBoolean.optional(),
    allowRevote: formBoolean.optional(),
    manualWinnerSelection: formBoolean.optional(),
    file: z.any().optional(),
  })
  .refine((values) => !values.endDate || values.endDate >= values.electionDate, {
    message: "End date cannot be before the election date.",
    path: ["endDate"],
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
  const [logoPreview, setLogoPreview] = useState<string>("");

  // Logo already saved on the election (edit mode).
  const existingLogoUrl = useMemo(() => {
    const src = initialValues as Record<string, any> | undefined;
    return String(src?.logo?.url || src?.logoUrl || "");
  }, [initialValues]);

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
  const endDateValue = watch("endDate");
  const votingOpenValue = watch("votingOpen");
  const numberToBeElected = watch("numberToBeElected");
  const nomineeDisplayOrder = watch("nomineeDisplayOrder");
  const voterResultDisplay = watch("voterResultDisplay");
  const resultGenerationMode = watch("resultGenerationMode");
  const ballotSelectionRule = watch("ballotSelectionRule");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setLogoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    }
  };

  // Release the object URL when the form unmounts.
  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

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
              <Label htmlFor="organization">Election Title</Label>
              <Input
                id="organization"
                placeholder="e.g. 2026 Board Elections"
                {...register("organization")}
                className="mt-1"
              />
              {formState.errors.organization && (
                <p className="app-error mt-1">{formState.errors.organization.message}</p>
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
                <p className="app-error mt-1">{formState.errors.electionDate.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="endDate">End Date (optional)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDateValue || ""}
                onChange={(e) =>
                  setValue("endDate", e.target.value, { shouldValidate: true, shouldDirty: true })
                }
                className="mt-1"
              />
              <p className="app-helper mt-1">Set this to run voting across multiple days</p>
              {formState.errors.endDate && (
                <p className="app-error mt-1">{formState.errors.endDate.message}</p>
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
              <p className="app-helper mt-1">
                Number of positions to be elected
              </p>
              {formState.errors.numberToBeElected && (
                <p className="app-error mt-1">{formState.errors.numberToBeElected.message}</p>
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
              <p className="mt-1 app-helper">
                {ballotSelectionRule === "up_to"
                  ? `A voter may select up to ${numberToBeElected || 1} nominee${(numberToBeElected || 1) !== 1 ? "s" : ""}, but not more.`
                  : `A voter must select exactly ${numberToBeElected || 1} nominee${(numberToBeElected || 1) !== 1 ? "s" : ""} to submit.`}
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
                <p className="app-error mt-1">{formState.errors.nomineeDisplayOrder.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="voterResultDisplay">Voter Result Display</Label>
              <Select
                value={voterResultDisplay || "none"}
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
              <p className="app-helper mt-1">Controls how much detail published results show to voters</p>
            </div>
            <div>
              <Label htmlFor="resultGenerationMode">Result Generation</Label>
              <Select
                value={resultGenerationMode || "manual"}
                onValueChange={(value) => setValue("resultGenerationMode", value as "auto" | "manual")}
              >
                <SelectTrigger id="resultGenerationMode" className="mt-1">
                  <SelectValue placeholder="Select how results are generated" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (admin publishes results)</SelectItem>
                  <SelectItem value="auto">Automatic (publish as soon as election completes)</SelectItem>
                </SelectContent>
              </Select>
              <p className="app-helper mt-1">
                Manual requires the admin to click Publish after the election ends
              </p>
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
              <p className="app-helper mt-1">
                How many voters can vote in this election, not your total voter list (0 = no limit)
              </p>
              {formState.errors.maxVoters && (
                <p className="app-error mt-1">{formState.errors.maxVoters.message}</p>
              )}
            </div>
          </div>

          {/* Gender-based selection owns its minimums, so they stay grouped with the toggle */}
          <div className="mb-5 md:mb-6">
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
                <Label htmlFor="genderBasedSelection" className="cursor-pointer">
                  Gender-based selection
                </Label>
                <p className="app-helper">Collect and enforce male/female requirements for this election</p>
              </div>
            </div>

            {watch("genderBasedSelection") === true && (
              <div className="mt-4 ml-6 grid grid-cols-1 gap-4 border-l-2 border-gray-100 pl-4 md:grid-cols-2 md:gap-6">
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
                  <p className="app-helper mt-1">Minimum male nominees that must be elected</p>
                  {formState.errors.maleMinimum && (
                    <p className="app-error mt-1">{formState.errors.maleMinimum.message}</p>
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
                  <p className="app-helper mt-1">Minimum female nominees that must be elected</p>
                  {formState.errors.femaleMinimum && (
                    <p className="app-error mt-1">{formState.errors.femaleMinimum.message}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mb-5 grid grid-cols-1 gap-4 md:mb-6 md:grid-cols-2 md:gap-6">
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
                <Label htmlFor="selfRegOpen" className="cursor-pointer">
                  Allow Self Registration
                </Label>
                <p className="app-helper">Enable voters to self-register for this election</p>
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
                <Label htmlFor="votingOpen" className="cursor-pointer">
                  Open Voting
                </Label>
                <p className="app-helper">
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
                <Label htmlFor="adminVotingDetailsEnabled" className="cursor-pointer">
                  Admin Voting Details
                </Label>
                <p className="app-helper">
                  Let admins see who each voter selected. Never shown to voters or included in printed results.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Controller
                name="allowRevote"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="allowRevote"
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <div>
                <Label htmlFor="allowRevote" className="cursor-pointer">
                  Allow Revote
                </Label>
                <p className="app-helper">
                  Let voters change their vote while voting is still open. The new vote replaces the old one.
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
                <Label htmlFor="manualWinnerSelection" className="cursor-pointer">
                  Manual Winner Selection
                </Label>
                <p className="app-helper">
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
                <p className="app-error mt-1">{formState.errors.franchiseId.message}</p>
              )}
            </div>
          )}

          <div className="mb-6">
            <Label htmlFor="logo">Election Logo (Optional)</Label>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {/* Preview: the newly picked file, else the logo already saved. */}
              {(logoPreview || existingLogoUrl) && (
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  <img
                    src={logoPreview || existingLogoUrl}
                    alt="Election logo"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
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
                {existingLogoUrl || logoPreview ? "Change File" : "Choose File"}
              </Label>
              <span className="min-w-0 break-all text-sm text-gray-500">
                {selectedFile
                  ? selectedFile.name
                  : existingLogoUrl
                    ? "Current logo"
                    : "No file chosen"}
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
