import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Election } from '@/lib/types';
import { getElectionLabel } from '@/lib/electionHelpers';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, apiFormRequest } from '@/lib/queryClient';
import { prepareImageForUpload, validateImageFile, fileToDataUrl } from '@/lib/imageUpload';
import { hasNomineePhoto } from '@/lib/nomineeHelpers';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload } from 'lucide-react';

import { selectedEntityIdSchema } from '@shared/entityId';

// Form schema for single nominee
const singleNomineeSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  electionId: selectedEntityIdSchema('Please select an election'),
  gender: z.enum(['male', 'female']).optional(),
  description: z.string().max(2000).optional(),
});

// Form schema for bulk nominees
const bulkNomineeSchema = z.object({
  namesWithGender: z.string().min(2, { message: 'Please enter comma-separated nominee names with gender (e.g., John Doe-male, Jane Smith-female)' }),
  electionId: selectedEntityIdSchema('Please select an election'),
});

// Form schema for import from previous election
const importPreviousSchema = z.object({
  sourceElectionId: selectedEntityIdSchema('Please select a source election'),
  targetElectionId: selectedEntityIdSchema('Please select a target election'),
});

type SingleNomineeFormValues = z.infer<typeof singleNomineeSchema>;
type BulkNomineeFormValues = {
  namesWithGender: string;
  electionId: string;
};
type ImportPreviousFormValues = z.infer<typeof importPreviousSchema>;

interface NomineeFormProps {
  elections: Election[];
  initialData?: any;
  isEdit?: boolean;
  /** When opened from an election workspace, lock the target election. */
  defaultElectionId?: string;
  /**
   * Full election list used only as import sources. `elections` is narrowed to
   * the current election when embedded, which would leave nothing to import from.
   */
  sourceElections?: Election[];
  onSuccess?: (result?: { electionId: string; nominee?: Record<string, unknown> }) => void;
}

export function NomineeForm({
  onSuccess,
  elections,
  initialData,
  isEdit = false,
  defaultElectionId,
  sourceElections,
}: NomineeFormProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>(isEdit ? 'single' : 'single');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initialData?.photo?.url || initialData?.photoUrl || null
  );

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  // Resolve whether a given election uses gender-based selection.
  const isGenderBased = (electionId?: string) => {
    if (!electionId) return false;
    const found = (elections || []).find(
      (e) => (e._id?.toString() || (e as any).id?.toString()) === electionId
    );
    return !!(found as any)?.genderBasedSelection;
  };

  // Single nominee form
  const singleForm = useForm<SingleNomineeFormValues>({
    resolver: zodResolver(singleNomineeSchema),
    defaultValues: {
      name: initialData?.name || '',
      electionId:
        initialData?.electionId?._id?.toString() ||
        initialData?.electionId?.toString() ||
        defaultElectionId ||
        '',
      gender: initialData?.gender || 'male',
      description: initialData?.description || initialData?.bio || '',
    },
  });

  // Bulk nominees form
  const bulkForm = useForm<BulkNomineeFormValues>({
    resolver: zodResolver(bulkNomineeSchema),
    defaultValues: {
      namesWithGender: '',
      electionId: defaultElectionId || '',
    },
  });

  // Import from previous election form
  const importPreviousForm = useForm<ImportPreviousFormValues>({
    resolver: zodResolver(importPreviousSchema),
    defaultValues: {
      sourceElectionId: '',
      targetElectionId: defaultElectionId || '',
    },
  });

  const resolveElectionId = (election: Election) =>
    election._id?.toString() || (election as { id?: string | number }).id?.toString() || '';

  const targetElectionId = importPreviousForm.watch('targetElectionId');
  const targetElection = (sourceElections || elections).find(
    (e) => resolveElectionId(e) === String(targetElectionId)
  );
  // An election can't import from itself, so keep it out of the source list.
  const importSourceElections = (sourceElections || elections).filter(
    (e) => resolveElectionId(e) !== String(targetElectionId)
  );

  // Pre-select election when adding from a specific election context.
  useEffect(() => {
    if (isEdit) return;

    const soleElectionId =
      elections.length === 1 ? resolveElectionId(elections[0]) : '';
    const targetElectionId = defaultElectionId || soleElectionId;
    if (!targetElectionId) return;

    if (!singleForm.getValues('electionId')) {
      singleForm.setValue('electionId', targetElectionId, { shouldValidate: true });
    }
    if (!bulkForm.getValues('electionId')) {
      bulkForm.setValue('electionId', targetElectionId, { shouldValidate: true });
    }
    if (!importPreviousForm.getValues('targetElectionId')) {
      importPreviousForm.setValue('targetElectionId', targetElectionId, { shouldValidate: true });
    }
  }, [
    isEdit,
    defaultElectionId,
    elections,
    singleForm,
    bulkForm,
    importPreviousForm,
  ]);

  // File import handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      toast({
        title: 'Invalid file',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }
    if (photoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhotoSelection = () => {
    if (photoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const renderOptionalDetailsFields = (form: typeof singleForm) => (
    <>
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Description{' '}
              <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Short bio or platform summary for voters"
                className="min-h-[88px] resize-y"
                {...field}
              />
            </FormControl>
            <FormDescription>Shown on the ballot when provided.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormItem>
        <FormLabel>
          Image{' '}
          <span className="text-gray-400 font-normal text-xs">(optional)</span>
        </FormLabel>
        <div className="space-y-3">
          {photoPreview && (
            <div className="flex items-center gap-3">
              <img
                src={photoPreview}
                alt="Nominee preview"
                className="h-16 w-16 rounded-full object-cover border border-gray-200"
              />
              <Button type="button" variant="outline" size="sm" onClick={clearPhotoSelection}>
                Remove image
              </Button>
            </div>
          )}
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-white px-4 py-6 hover:bg-primary/5">
            <Upload className="mb-2 h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">
              {photoPreview ? 'Replace image' : 'Upload image'}
            </span>
            <span className="mt-1 text-xs text-gray-500">PNG, JPG up to 5MB</span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handlePhotoChange}
            />
          </label>
        </div>
      </FormItem>
    </>
  );

  // Single nominee submission handler
  const onSubmitSingle = async (data: SingleNomineeFormValues) => {
    try {
      const nomineeId = initialData?._id || initialData?.id;
      const resolvedElectionId = (defaultElectionId || data.electionId || "").trim();
      if (!resolvedElectionId) {
        toast({
          title: "Election required",
          description: "Select an election before creating a nominee.",
          variant: "destructive",
        });
        return;
      }

      const trimmedName = data.name.trim();
      const existingRes = await apiRequest('GET', `/api/nominees/election/${resolvedElectionId}`);
      const existingBody = await existingRes.json();
      const existingNominees = (existingBody.data || []) as Array<{ _id?: string; id?: string; name?: string }>;
      const isDuplicate = existingNominees.some(
        (n) =>
          String(n._id || n.id) !== String(nomineeId) &&
          String(n.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDuplicate) {
        toast({
          title: 'Duplicate nominee',
          description: `A nominee named "${trimmedName}" already exists for this election.`,
          variant: 'destructive',
        });
        return;
      }

      const descriptionValue = data.description?.trim() || '';
      let createdNominee: Record<string, unknown> | undefined;
      let photoUploadFailed = false;

      const jsonBody: Record<string, unknown> = {
        name: data.name,
        electionId: resolvedElectionId,
        gender: data.gender,
      };
      if (descriptionValue || isEdit) {
        jsonBody.description = descriptionValue || null;
      }

      const uploadPhotoForNominee = async (targetId: string) => {
        if (!photoFile) return undefined;
        const uploadFile = await prepareImageForUpload(photoFile);

        const readNominee = (body: Record<string, unknown>) =>
          (body.data || body.nominee) as Record<string, unknown> | undefined;

        const dataUrl = await fileToDataUrl(photoFile);

        // Multipart keeps binary size (no base64 bloat) — works through 1MB gateways.
        try {
          const formData = new FormData();
          formData.append('name', data.name);
          formData.append('electionId', resolvedElectionId);
          if (data.gender) formData.append('gender', data.gender);
          if (descriptionValue) formData.append('description', descriptionValue);
          formData.append('photo', uploadFile, uploadFile.name);

          const res = await apiFormRequest('PUT', `/api/nominees/${targetId}`, formData);
          const updated = readNominee(await res.json());
          if (hasNomineePhoto(updated)) return updated;
        } catch {
          // Fall through to JSON photo upload.
        }

        // Compact data URL in JSON when multipart upload is unavailable.
        try {
          const res = await apiRequest('PUT', `/api/nominees/${targetId}`, {
            name: data.name,
            electionId: resolvedElectionId,
            photo: { url: dataUrl, alt: data.name },
          });
          const updated = readNominee(await res.json());
          if (hasNomineePhoto(updated)) return updated;
        } catch {
          // Fall through to CDN base64 upload on newer APIs.
        }

        const res = await apiRequest('PUT', `/api/nominees/${targetId}`, {
          photoBase64: dataUrl,
        });
        const updated = readNominee(await res.json());
        if (!hasNomineePhoto(updated)) {
          throw new Error('Photo was not saved on the server');
        }
        return updated;
      };

      if (isEdit && nomineeId) {
        const res = await apiRequest('PUT', `/api/nominees/${nomineeId}`, jsonBody);
        const responseBody = await res.json();
        createdNominee = responseBody.data || responseBody.nominee;

        if (photoFile) {
          try {
            const withPhoto = await uploadPhotoForNominee(String(nomineeId));
            if (withPhoto) createdNominee = withPhoto;
          } catch {
            photoUploadFailed = true;
          }
        }
      } else {
        // Create nominee first with a small JSON body (avoids HTTP 413).
        const res = await apiRequest('POST', '/api/nominees', jsonBody);
        const responseBody = await res.json();
        createdNominee = responseBody.nominee || responseBody.data;

        const newId = createdNominee?._id || createdNominee?.id;
        if (photoFile && newId) {
          try {
            const withPhoto = await uploadPhotoForNominee(String(newId));
            if (withPhoto) createdNominee = withPhoto;
          } catch {
            photoUploadFailed = true;
          }
        }
      }

      if (photoFile && !hasNomineePhoto(createdNominee)) {
        photoUploadFailed = true;
      }

      if (isEdit) {
        toast({
          title: 'Nominee updated',
          description: photoUploadFailed
            ? 'Details saved, but the photo could not be uploaded. Try again or redeploy the API with image upload support.'
            : 'The nominee has been updated successfully',
          variant: photoUploadFailed ? 'destructive' : 'success',
        });
      } else {
        toast({
          title: 'Nominee created',
          description: photoUploadFailed
            ? 'Nominee saved to the election, but the photo could not be uploaded. You can edit the nominee to retry.'
            : 'The nominee has been successfully created',
          variant: photoUploadFailed ? 'destructive' : 'success',
        });
      }

      singleForm.reset({
        name: '',
        electionId: defaultElectionId || resolvedElectionId,
        gender: 'male',
        description: '',
      });
      clearPhotoSelection();
      onSuccess?.({ electionId: resolvedElectionId, nominee: createdNominee });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isNetworkError = /failed to fetch|networkerror|load failed|backend service unavailable/i.test(message);
      toast({
        title: 'Error',
        description: isNetworkError
          ? `Could not reach the API while uploading the image. Restart election-api (port 8000) and election-portal, then try again. (${message})`
          : `Failed to ${isEdit ? 'update' : 'create'} nominee: ${message}`,
        variant: 'destructive',
      });
    }
  };

  // Bulk nominees submission handler
  const onSubmitBulk = async (data: BulkNomineeFormValues) => {
    try {
      const resolvedElectionId = (defaultElectionId || data.electionId || "").trim();
      if (!resolvedElectionId) {
        toast({
          title: "Election required",
          description: "Select an election before creating nominees.",
          variant: "destructive",
        });
        return;
      }

      const genderBased = isGenderBased(resolvedElectionId);
      // First, normalize the input by combining both commas and newlines as separators
      const input = data.namesWithGender.replace(/\n/g, ',');
      
      const entries = input.split(',');
      const nominees = [];
      const errors = [];
      
      for (const entry of entries) {
        const trimmed = entry.trim();
        if (!trimmed) continue;

        if (!genderBased) {
          // Neutral selection: each entry is simply a nominee name.
          nominees.push({
            name: trimmed,
            electionId: resolvedElectionId,
            status: 'active'
          });
          continue;
        }

        // Parse the name-gender format (e.g., "John Doe-m" or "Jane Smith-f")
        const parts = trimmed.split('-');
        
        if (parts.length !== 2) {
          errors.push(`"${trimmed}" doesn't follow the required format "Name-m" or "Name-f"`);
          continue;
        }
        
        const name = parts[0].trim();
        const genderCode = parts[1].trim().toLowerCase();
        
        // Validate gender code is either m or f
        if (genderCode !== 'm' && genderCode !== 'f') {
          errors.push(`Gender code for "${name}" must be "m" or "f", not "${genderCode}"`);
          continue;
        }
        
        nominees.push({
          name,
          electionId: resolvedElectionId,
          gender: genderCode === 'm' ? 'male' : 'female',
          status: 'active'
        });
      }
      
      // Report any validation errors
      if (errors.length > 0) {
        toast({
          title: 'Format errors detected',
          description: errors.slice(0, 3).join('; ') + (errors.length > 3 ? ` and ${errors.length - 3} more errors` : ''),
          variant: 'destructive'
        });
        return;
      }
      
      if (nominees.length === 0) {
        toast({
          title: 'No valid nominees',
          description: 'Please enter nominee names with gender using format: "Name-m" or "Name-f", separated by commas',
          variant: 'destructive'
        });
        return;
      }

      const existingRes = await apiRequest('GET', `/api/nominees/election/${resolvedElectionId}`);
      const existingBody = await existingRes.json();
      const existingNames = new Set(
        ((existingBody.data || []) as Array<{ name?: string }>).map((n) =>
          String(n.name || '').trim().toLowerCase()
        )
      );
      const seenInBatch = new Set<string>();
      const duplicates: string[] = [];
      for (const n of nominees) {
        const key = n.name.trim().toLowerCase();
        if (existingNames.has(key) || seenInBatch.has(key)) {
          duplicates.push(n.name);
        }
        seenInBatch.add(key);
      }
      if (duplicates.length > 0) {
        toast({
          title: 'Duplicate nominee names',
          description: `Already exists or repeated: ${duplicates.slice(0, 5).join(', ')}${duplicates.length > 5 ? ` and ${duplicates.length - 5} more` : ''}`,
          variant: 'destructive',
        });
        return;
      }

      // Log the nominees being sent to help with debugging
      console.log('Sending nominees to API:', nominees);
      
      await apiRequest(
        'POST',
        '/api/nominees/bulk',
        {
          nominees,
          electionId: resolvedElectionId
        }
      );

      toast({
        title: 'Nominees created',
        description: `Successfully created ${nominees.length} nominees`,
        variant: 'success'
      });

      bulkForm.reset({
        namesWithGender: '',
        electionId: defaultElectionId || resolvedElectionId,
      });
      onSuccess?.({ electionId: resolvedElectionId });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to create nominees: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    }
  };

  // Import from previous election submission handler
  const onSubmitImportPrevious = async (data: ImportPreviousFormValues) => {
    try {
      await apiRequest(
        'POST',
        '/api/nominees/import-previous',
        {
          sourceElectionId: data.sourceElectionId,
          targetElectionId: data.targetElectionId
        }
      );

      toast({
        title: 'Nominees imported',
        description: 'Successfully imported nominees from the selected election',
        variant: 'success'
      });

      importPreviousForm.reset();
      onSuccess?.({ electionId: data.targetElectionId });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to import nominees: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    }
  };

  // File import submission handler
  const onSubmitFileImport = async () => {
    if (!importFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to import',
        variant: 'destructive'
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', importFile);

      // Use fetch directly for file upload
      const response = await fetch('/api/nominees/import-file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      toast({
        title: 'File uploaded',
        description: 'The nominees are being processed and will be added shortly',
        variant: 'success'
      });

      setImportFile(null);
      onSuccess?.(defaultElectionId ? { electionId: defaultElectionId } : undefined);
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to import file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isEdit ? 'Edit Nominee' : 'Add Nominees'}</CardTitle>
      </CardHeader>
      <CardContent>
        {isEdit ? (
          <Form {...singleForm}>
            <form onSubmit={singleForm.handleSubmit(onSubmitSingle)} className="space-y-6">
              <div className="space-y-4">
                {/* Election selection (disabled in edit mode) */}
                <FormField
                  control={singleForm.control}
                  name="electionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Election</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={true} // Can't change election in edit mode
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an election" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.isArray(elections) && elections.map((election) => {
                                const electionId = election._id?.toString() || election.id?.toString();
                                if (!electionId) return null;
                                return (
                                  <SelectItem key={electionId} value={electionId}>
                                    {getElectionLabel(election)}
                                  </SelectItem>
                                );
                              })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Nominee name */}
                <FormField
                  control={singleForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter nominee name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Nominee gender */}
                {isGenderBased(singleForm.watch('electionId')) && (
                <FormField
                  control={singleForm.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                          >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                )}
                {renderOptionalDetailsFields(singleForm)}
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onSuccess?.()}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={singleForm.formState.isSubmitting}>
                  {singleForm.formState.isSubmitting ? 'Updating...' : 'Update Nominee'}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <Tabs defaultValue="single" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 gap-1 h-auto mb-6">
              <TabsTrigger value="single" className="text-xs sm:text-sm px-2">Single</TabsTrigger>
              <TabsTrigger value="bulk" className="text-xs sm:text-sm px-2">Bulk</TabsTrigger>
              <TabsTrigger value="previous" className="text-xs sm:text-sm px-2">From Previous</TabsTrigger>
              <TabsTrigger value="file" className="text-xs sm:text-sm px-2">Excel Import</TabsTrigger>
            </TabsList>

            {/* Single nominee tab */}
            <TabsContent value="single">
              <Form {...singleForm}>
                <form onSubmit={singleForm.handleSubmit(onSubmitSingle)} className="space-y-6">
                  <div className="space-y-4">
                    {!defaultElectionId && (
                    <FormField
                      control={singleForm.control}
                      name="electionId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Election</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select an election" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Array.isArray(elections) && elections.map((election) => {
                                const electionId = election._id?.toString() || election.id?.toString();
                                if (!electionId) return null;
                                return (
                                  <SelectItem key={electionId} value={electionId}>
                                    {getElectionLabel(election)}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    )}

                    {/* Nominee name */}
                    <FormField
                      control={singleForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter nominee name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Nominee gender */}
                    {isGenderBased(defaultElectionId || singleForm.watch('electionId')) && (
                    <FormField
                      control={singleForm.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    )}
                    {renderOptionalDetailsFields(singleForm)}
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onSuccess?.()}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={singleForm.formState.isSubmitting}>
                      {singleForm.formState.isSubmitting ? 'Creating...' : 'Create Nominee'}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            {/* Bulk nominees tab */}
            <TabsContent value="bulk">
              <Form {...bulkForm}>
                <form onSubmit={bulkForm.handleSubmit(onSubmitBulk)} className="space-y-6">
                  <div className="space-y-4">
                    {!defaultElectionId && (
                    <FormField
                      control={bulkForm.control}
                      name="electionId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Election</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select an election" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Array.isArray(elections) && elections.map((election) => {
                                const electionId = election._id?.toString() || election.id?.toString();
                                if (!electionId) return null;
                                return (
                                  <SelectItem key={electionId} value={electionId}>
                                    {getElectionLabel(election)}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    )}

                    {/* Comma-separated names with gender */}
                    <FormField
                      control={bulkForm.control}
                      name="namesWithGender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {isGenderBased(defaultElectionId || bulkForm.watch('electionId'))
                              ? 'Nominee Names with Gender (comma-separated)'
                              : 'Nominee Names (comma-separated)'}
                          </FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder={isGenderBased(defaultElectionId || bulkForm.watch('electionId'))
                                ? 'Enter nominee names with gender separated by commas, e.g: John Doe-m, Jane Smith-f'
                                : 'Enter nominee names separated by commas, e.g: John Doe, Jane Smith, Alex Johnson'}
                              className="min-h-[100px]"
                              {...field} 
                            />
                          </FormControl>
                          <div className="text-xs text-muted-foreground">
                            {isGenderBased(defaultElectionId || bulkForm.watch('electionId'))
                              ? 'Format: Name-gender (m for male, f for female) separated by commas. Example: John Doe-m, Jane Smith-f'
                              : 'Enter one name per entry, separated by commas or new lines.'}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onSuccess?.()}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={bulkForm.formState.isSubmitting}>
                      {bulkForm.formState.isSubmitting ? 'Creating...' : 'Create Nominees'}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            {/* Import from previous election tab */}
            <TabsContent value="previous">
              <Form {...importPreviousForm}>
                <form onSubmit={importPreviousForm.handleSubmit(onSubmitImportPrevious)} className="space-y-6">
                  <div className="space-y-4">
                    {/* Source election selection */}
                    <FormField
                      control={importPreviousForm.control}
                      name="sourceElectionId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source Election</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select source election" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {importSourceElections.length === 0 ? (
                                <div className="px-2 py-3 text-sm text-muted-foreground">
                                  No other elections available to import from
                                </div>
                              ) : (
                                importSourceElections.map((election) => {
                                  const electionId = resolveElectionId(election);
                                  if (!electionId) return null;
                                  return (
                                    <SelectItem key={electionId} value={electionId}>
                                      {getElectionLabel(election)}
                                    </SelectItem>
                                  );
                                })
                              )}
                            </SelectContent>
                          </Select>
                          <div className="text-xs text-muted-foreground">
                            Select the election to import nominees from
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Target election — locked when opened from an election workspace */}
                    {defaultElectionId ? (
                      <div className="text-xs text-muted-foreground">
                        Nominees will be added to{' '}
                        <span className="font-medium text-foreground">
                          {targetElection ? getElectionLabel(targetElection) : 'this election'}
                        </span>
                        .
                      </div>
                    ) : (
                      <FormField
                        control={importPreviousForm.control}
                        name="targetElectionId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Election</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select target election" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(sourceElections || elections).map((election) => {
                                  const electionId = resolveElectionId(election);
                                  if (!electionId) return null;
                                  return (
                                    <SelectItem key={electionId} value={electionId}>
                                      {getElectionLabel(election)}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <div className="text-xs text-muted-foreground">
                              Select the election to add the nominees to
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onSuccess?.()}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={importPreviousForm.formState.isSubmitting}>
                      {importPreviousForm.formState.isSubmitting ? 'Importing...' : 'Import Nominees'}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            {/* Excel import tab */}
            <TabsContent value="file">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium mb-2">Excel File</div>
                    <div className="mt-2 flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-white hover:bg-primary/10">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <div className="w-8 h-8 mb-2 text-gray-500">📊</div>
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">Excel (.xlsx) or CSV (.csv)</p>
                          {importFile && (
                            <p className="mt-2 text-sm text-blue-600 font-semibold">
                              {importFile.name}
                            </p>
                          )}
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          onChange={handleFileChange}
                          accept=".xlsx,.csv"
                        />
                      </label>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Upload an Excel file with nominee names. The file should have a column labeled 'name'.
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onSuccess?.()}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    onClick={onSubmitFileImport}
                    disabled={!importFile}
                  >
                    Import Nominees
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
