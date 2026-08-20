import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isLettersOnlyName } from "@/lib/utils";
import { Building2, Globe, Mail, Pencil, Phone, Upload } from "lucide-react";

interface FranchiseDetails {
  _id?: string;
  name?: string;
  websiteUrl?: string;
  contactNumber?: string;
  contactEmail?: string;
  logo?: { url?: string; alt?: string };
}

interface FranchiseSettingsCardProps {
  franchiseId: string;
}

/**
 * Lets a franchise admin view and edit their own organisation's details from
 * the Profile page — the franchise list page itself stays super-admin only.
 */
export function FranchiseSettingsCard({ franchiseId }: FranchiseSettingsCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    websiteUrl: "",
    contactNumber: "",
    contactEmail: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");

  const { data, isLoading } = useQuery<{ data?: FranchiseDetails }>({
    queryKey: [`/api/franchises/${franchiseId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/franchises/${franchiseId}`);
      return res.json();
    },
    enabled: !!franchiseId,
  });

  const franchise = useMemo<FranchiseDetails>(
    () => (data as any)?.data || (data as any) || {},
    [data]
  );

  // Seed the form whenever the dialog opens so edits always start from current values.
  useEffect(() => {
    if (open) {
      setForm({
        name: franchise.name || "",
        websiteUrl: franchise.websiteUrl || "",
        contactNumber: franchise.contactNumber || "",
        contactEmail: franchise.contactEmail || "",
      });
      setLogoFile(null);
      setLogoPreview("");
    }
  }, [open, franchise]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = new FormData();
      body.append("name", form.name);
      body.append("websiteUrl", form.websiteUrl);
      body.append("contactNumber", form.contactNumber);
      body.append("contactEmail", form.contactEmail);
      if (logoFile) body.append("logo", logoFile);

      const res = await fetch(`/api/franchises/${franchiseId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
        body,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Could not update franchise");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/franchises/${franchiseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/franchises"] });
      setOpen(false);
      toast({
        title: "Franchise updated",
        description: "Your organisation details were saved.",
        variant: "success",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Could not update franchise", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLettersOnlyName(form.name)) {
      toast({
        title: "Invalid franchise name",
        description: "Name cannot contain numbers.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  // Matches the icon-left, label-above-value rows used in the Account
  // details card right below this one.
  const detail = (icon: React.ReactNode, label: string, value?: string) => {
    const text = value?.trim();
    return (
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="app-helper">{label}</p>
          <p className={text ? "app-detail-value break-words" : "app-muted"}>
            {text || "Not set"}
          </p>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="p-3 pb-0 md:p-4 md:pb-0">
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setOpen(true)}
            disabled={isLoading}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-2 md:p-4 md:pt-2 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            {/* Identity header — logo + name read as one unit */}
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
                {franchise.logo?.url ? (
                  <img
                    src={franchise.logo.url}
                    alt={franchise.logo.alt || franchise.name || "Franchise logo"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building2 className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate app-section-title">
                  {franchise.name || "—"}
                </p>
                <p className="app-helper">Organisation</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {detail(<Globe className="h-4 w-4" />, "Website", franchise.websiteUrl)}
              {detail(<Phone className="h-4 w-4" />, "Contact number", franchise.contactNumber)}
              {detail(<Mail className="h-4 w-4" />, "Contact email", franchise.contactEmail)}
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit franchise</DialogTitle>
            <DialogDescription>
              Update your organisation's name, logo, and contact details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="app-form-fields">
              <div className="grid gap-1">
                <Label htmlFor="franchise-name">Franchise Name</Label>
                <Input
                  id="franchise-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Enter franchise name"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="franchise-website">Website URL</Label>
                <Input
                  id="franchise-website"
                  value={form.websiteUrl}
                  onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="franchise-phone">Contact Number</Label>
                <Input
                  id="franchise-phone"
                  value={form.contactNumber}
                  onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="franchise-email">Contact Email</Label>
                <Input
                  id="franchise-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  placeholder="contact@example.com"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="franchise-logo">Franchise Logo</Label>
                <div className="flex flex-wrap items-center gap-3">
                  {(logoPreview || franchise.logo?.url) && (
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                      <img
                        src={logoPreview || franchise.logo?.url}
                        alt="Franchise logo"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <Input
                    id="franchise-logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <Label
                    htmlFor="franchise-logo"
                    className="cursor-pointer inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition hover:bg-primary/5"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {franchise.logo?.url || logoPreview ? "Change File" : "Choose File"}
                  </Label>
                  <span className="min-w-0 break-all app-muted">
                    {logoFile ? logoFile.name : franchise.logo?.url ? "Current logo" : "No file chosen"}
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
