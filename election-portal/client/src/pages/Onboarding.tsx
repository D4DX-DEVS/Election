import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  Card,
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  ChevronRight, 
  BookOpen, 
  Settings, 
  Users, 
  FileText 
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { getStoredUser } from "@/lib/authUser";
import { SiteFooter } from "@/components/layout/SiteFooter";

// Step interface for the onboarding process
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
  isCompleted: boolean;
}

// Onboarding component for various user roles
export default function Onboarding() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("welcome");
  const [progress, setProgress] = useState(0);
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(new Set());

  // Get user from local storage
  const user = getStoredUser();
  const userRole = user?.role || "viewer";

  // Define steps based on user role
  const superAdminSteps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Welcome to Vote+",
      description: "Get started with your super administrator account",
      component: <WelcomeStep />,
      isCompleted: false
    },
    {
      id: "system-tour",
      title: "System Tour",
      description: "Learn about the key features of Vote+",
      component: <SystemTourStep />,
      isCompleted: false
    },
    {
      id: "franchise-setup",
      title: "Set Up Franchises",
      description: "Create your first franchise organization",
      component: <FranchiseSetupStep />,
      isCompleted: false
    },
    {
      id: "admin-setup",
      title: "Create Administrators",
      description: "Add franchise administrators to manage elections",
      component: <AdminSetupStep />,
      isCompleted: false
    },
    {
      id: "complete",
      title: "All Set!",
      description: "You're ready to start using Vote+",
      component: <CompleteStep />,
      isCompleted: false
    }
  ];

  const franchiseAdminSteps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Welcome to Vote+",
      description: "Get started with your franchise administrator account",
      component: <WelcomeStep />,
      isCompleted: false
    },
    {
      id: "system-tour",
      title: "System Tour",
      description: "Learn about the key features for franchise management",
      component: <SystemTourStep />,
      isCompleted: false
    },
    {
      id: "election-setup",
      title: "Create Elections",
      description: "Set up your first election",
      component: <ElectionSetupStep />,
      isCompleted: false
    },
    {
      id: "voter-setup",
      title: "Add Voters",
      description: "Create voter groups and import voters",
      component: <VoterSetupStep />,
      isCompleted: false
    },
    {
      id: "complete",
      title: "All Set!",
      description: "You're ready to start managing elections",
      component: <CompleteStep />,
      isCompleted: false
    }
  ];

  const electionAdminSteps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Welcome to Vote+",
      description: "Get started with your election administrator account",
      component: <WelcomeStep />,
      isCompleted: false
    },
    {
      id: "system-tour",
      title: "System Tour",
      description: "Learn about the key features for election management",
      component: <SystemTourStep />,
      isCompleted: false
    },
    {
      id: "nominee-setup",
      title: "Add Nominees",
      description: "Add nominees to your assigned elections",
      component: <NomineeSetupStep />,
      isCompleted: false
    },
    {
      id: "complete",
      title: "All Set!",
      description: "You're ready to manage election nominees and results",
      component: <CompleteStep />,
      isCompleted: false
    }
  ];

  // Select steps based on user role
  const steps = 
    userRole === "super_admin" ? superAdminSteps :
    userRole === "franchise_admin" ? franchiseAdminSteps :
    userRole === "election_admin" ? electionAdminSteps :
    superAdminSteps; // Default to super admin steps

  const currentStep = steps[currentStepIndex];

  // Update progress bar
  useEffect(() => {
    const newProgress = (completedStepIds.size / steps.length) * 100;
    setProgress(newProgress);
  }, [completedStepIds, steps.length]);

  // API call to update user's onboarding status
  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`
        }
      });

      if (!response.ok) {
        console.error("Onboarding completion failed:", await response.text());
        throw new Error("Failed to update onboarding status");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Onboarding Complete!",
        description: "Welcome to Vote+",
      });

      // Redirect based on role
      if (userRole === "super_admin") {
        navigate("/");
      } else if (userRole === "franchise_admin" || userRole === "election_admin") {
        navigate("/elections");
      } else {
        navigate("/");
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete onboarding process",
        variant: "destructive",
      });
    }
  });

  // Handle navigation between steps
  const goToNextStep = () => {
    setCompletedStepIds((prev) => new Set(prev).add(steps[currentStepIndex].id));

    if (currentStepIndex < steps.length - 1) {
      // Move to next step
      setCurrentStepIndex(currentStepIndex + 1);
      setActiveTab(steps[currentStepIndex + 1].id);
    } else {
      // Complete onboarding
      completeOnboardingMutation.mutate();
    }
  };

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      setActiveTab(steps[currentStepIndex - 1].id);
    }
  };

  // Skip onboarding
  const skipOnboarding = () => {
    completeOnboardingMutation.mutate();
  };

  const roleLabel =
    userRole === "super_admin" ? "Super Administrator" :
    userRole === "franchise_admin" ? "Franchise Administrator" :
    userRole === "election_admin" ? "Election Administrator" :
    "User";

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Compact header — mirrors the dashboard's brand mark + wordmark */}
      <header className="h-12 shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center">
            <img src="/logo.png" alt="Vote+" className="h-7 w-auto object-contain" />
          </div>
          <Button variant="outline" size="sm" onClick={skipOnboarding}>
            Skip Tutorial
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 lg:py-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h1 className="app-page-title">Setting up your {roleLabel} account</h1>
            <p className="app-muted shrink-0 tabular-nums">
              Step {currentStepIndex + 1} of {steps.length}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[200px_1fr] md:gap-4">
            <div className="hidden min-w-0 md:block">
              <Card className="border border-gray-200 shadow-none">
                <CardContent className="p-2.5">
                  <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Your Progress
                  </h2>
                  <nav className="space-y-0.5">
                    {steps.map((step, index) => (
                      <button
                        key={step.id}
                        type="button"
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                          index === currentStepIndex
                            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                            : "text-slate-600 hover:bg-primary/5"
                        }`}
                        onClick={() => {
                          setCurrentStepIndex(index);
                          setActiveTab(step.id);
                        }}
                      >
                        <span className="flex-shrink-0">
                          {completedStepIds.has(step.id) ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <div
                              className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
                                index === currentStepIndex
                                  ? "border-primary-foreground/70 text-primary-foreground"
                                  : "border-gray-300 text-gray-500"
                              }`}
                            >
                              {index + 1}
                            </div>
                          )}
                        </span>
                        <span className="truncate font-medium">{step.title}</span>
                      </button>
                    ))}
                  </nav>
                </CardContent>
              </Card>
            </div>

            <div className="min-w-0">
              <Card className="border border-gray-200 shadow-none">
                <CardHeader className="p-3 pb-2 sm:p-4 sm:pb-2.5">
                  <CardTitle>{currentStep.title}</CardTitle>
                  <CardDescription>{currentStep.description}</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                  {currentStep.component}
                </CardContent>
                <CardFooter className="flex justify-between gap-2 border-t border-gray-100 p-3 sm:p-4">
                  <Button
                    variant="outline"
                    onClick={goToPreviousStep}
                    disabled={currentStepIndex === 0}
                  >
                    Back
                  </Button>
                  <Button onClick={goToNextStep}>
                    {currentStepIndex === steps.length - 1 ? "Finish" : "Continue"}
                    {currentStepIndex !== steps.length - 1 && (
                      <ChevronRight className="ml-1.5 h-4 w-4" />
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

// Step Components
function WelcomeStep() {
  // Get user from local storage
  const user = getStoredUser();
  const userName = user?.fullName || user?.username || "User";
  const userRole = user?.role || "viewer";

  return (
    <div className="space-y-2.5">
      <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
        <h3 className="app-section-title mb-1">
          Welcome, {userName}!
        </h3>
        <p className="app-body mb-1.5">
          We're excited to have you on board as a{" "}
          {userRole === "super_admin"
            ? "Super Administrator"
            : userRole === "franchise_admin"
              ? "Franchise Administrator"
              : "Election Administrator"}.
          Let's get you started with Vote+.
        </p>
        <p className="app-body">
          This quick onboarding process will help you understand the system
          and set up your first{" "}
          {userRole === "super_admin"
            ? "franchise organization"
            : userRole === "franchise_admin"
              ? "election"
              : "nominee list"}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-2.5">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h4 className="app-label">Learn the Basics</h4>
              <p className="app-muted mt-0.5">
                Understand the core features and capabilities of the system
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-2.5">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Settings className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h4 className="app-label">Configure Your Account</h4>
              <p className="app-muted mt-0.5">
                Set up your profile and preferences for a personalized experience
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-2.5">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h4 className="app-label">Manage Users</h4>
              <p className="app-muted mt-0.5">
                Create and organize administrators, nominees, and voters
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-2.5">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h4 className="app-label">Election Management</h4>
              <p className="app-muted mt-0.5">
                Create, configure, and monitor election processes
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemTourStep() {
  // Get user role
  const user = getStoredUser();
  const userRole = user?.role || "viewer";

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Let's explore the key features of the Vote+ system that are relevant to your role as a{" "}
        {userRole === "super_admin" 
          ? "Super Administrator" 
          : userRole === "franchise_admin" 
            ? "Franchise Administrator" 
            : "Election Administrator"}.
      </p>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="elections">Elections</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-0">
          <div className="rounded-lg border overflow-hidden">
            <div className="bg-white p-3 border-b">
              <h4 className="text-sm font-semibold text-gray-900">Dashboard Overview</h4>
            </div>
            <div className="p-3">
              <p className="text-sm text-gray-600 mb-1.5">
                Your dashboard provides a quick overview of:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Active elections and their status</li>
                <li>Recent voting activity and participation rates</li>
                <li>Upcoming election deadlines and important dates</li>
                <li>System notifications and alerts</li>
              </ul>

              <div className="mt-2 p-2 bg-primary/5 rounded-lg">
                <p className="text-xs font-semibold text-gray-900">Pro Tip</p>
                <p className="text-sm text-gray-600">
                  The dashboard is customized based on your role and permissions, showing only relevant information.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="elections" className="space-y-0">
          <div className="rounded-lg border overflow-hidden">
            <div className="bg-white p-3 border-b">
              <h4 className="text-sm font-semibold text-gray-900">Managing Elections</h4>
            </div>
            <div className="p-3">
              <p className="text-sm text-gray-600 mb-1.5">
                The Vote+ system allows you to:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Create and configure new elections with customizable parameters</li>
                <li>Add nominees and manage their profiles</li>
                <li>Control voting periods and access</li>
                <li>Generate real-time analytics and reports</li>
                <li>Archive completed elections for future reference</li>
              </ul>

              <div className="mt-2 p-2 bg-primary/5 rounded-lg">
                <p className="text-xs font-semibold text-gray-900">Pro Tip</p>
                <p className="text-sm text-gray-600">
                  Elections can be grouped for better organization, especially when managing multiple concurrent events.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-0">
          <div className="rounded-lg border overflow-hidden">
            <div className="bg-white p-3 border-b">
              <h4 className="text-sm font-semibold text-gray-900">User Management</h4>
            </div>
            <div className="p-3">
              <p className="text-sm text-gray-600 mb-2.5">
                As a{" "}
                {userRole === "super_admin" 
                  ? "Super Administrator" 
                  : userRole === "franchise_admin" 
                    ? "Franchise Administrator" 
                    : "Election Administrator"}, 
                you can manage:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {userRole === "super_admin" && (
                  <>
                    <li>Franchise organizations and their settings</li>
                    <li>Franchise administrators with specific access rights</li>
                  </>
                )}

                {(userRole === "super_admin" || userRole === "franchise_admin") && (
                  <>
                    <li>Election administrators assigned to specific elections</li>
                    <li>Voter groups and registration methods</li>
                  </>
                )}

                {userRole === "election_admin" && (
                  <li>Nominees and their profiles for your assigned elections</li>
                )}

                <li>Access control and security settings</li>
                <li>User activity logs and audit trails</li>
              </ul>

              <div className="mt-2 p-2 bg-primary/5 rounded-lg">
                <p className="text-xs font-semibold text-gray-900">Pro Tip</p>
                <p className="text-sm text-gray-600">
                  Creating voter groups allows for bulk generation of voter accounts with sequential credentials.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FranchiseSetupStep() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-3">
        As a Super Administrator, you can create franchise organizations that represent different entities using the system. Each franchise can have its own administrators, elections, and voters.
      </p>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-3">
        <h4 className="flex items-center text-sm font-semibold text-amber-800">
          <CheckCircle2 className="h-4 w-4 mr-1.5 text-amber-500" />
          Setting Up Your First Franchise
        </h4>
        <p className="mt-1.5 text-xs text-amber-700">
          To create a franchise, navigate to the Franchises page from the main sidebar. You'll be able to add the organization's name, logo, and default settings for elections.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Key Franchise Settings</h4>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
            <li>Organization name and branding</li>
            <li>Default nominee display order (alphabetical, random, etc.)</li>
            <li>Maximum voters and nominees allowed per election</li>
            <li>Gender quota requirements, if applicable</li>
            <li>Self-registration and voting access defaults</li>
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Best Practices</h4>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
            <li>Use clear, recognizable names for franchises</li>
            <li>Upload high-quality logos for better branding</li>
            <li>Configure sensible defaults that apply to most elections</li>
            <li>Create separate franchises for distinctly different organizations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function AdminSetupStep() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-3">
        Now that you've set up a franchise, you'll need to create administrators who can manage elections within that franchise. There are two types of administrators you can create:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Franchise Administrators</h4>
          <p className="text-sm text-gray-600 mb-2">
            These users can:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>Create and manage all elections within their franchise</li>
            <li>Add election administrators</li>
            <li>Manage voter groups and generate voter accounts</li>
            <li>View analytics across all elections in the franchise</li>
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Election Administrators</h4>
          <p className="text-sm text-gray-600 mb-2">
            These users can:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>Manage specific elections they're assigned to</li>
            <li>Add and edit nominees</li>
            <li>Monitor voting progress and results</li>
            <li>Access limited to their assigned elections only</li>
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <h4 className="flex items-center text-sm font-semibold text-amber-800">
          <CheckCircle2 className="h-4 w-4 mr-1.5 text-amber-500" />
          Creating Administrators
        </h4>
        <p className="mt-1.5 text-xs text-amber-700">
          To create administrators, go to the Admins page from the main sidebar. You'll be able to create accounts, set credentials, and assign franchises or specific elections.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 p-3">
        <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Security Best Practices</h4>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
          <li>Create unique usernames that identify both the user and their role</li>
          <li>Use strong initial passwords and require users to change them</li>
          <li>Assign the minimum necessary permissions for each administrator</li>
          <li>Regularly review administrator access and remove accounts no longer needed</li>
        </ul>
      </div>
    </div>
  );
}

function ElectionSetupStep() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-3">
        As a Franchise Administrator, one of your primary responsibilities is creating and configuring elections. Let's walk through the process of setting up your first election.
      </p>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-3">
        <h4 className="flex items-center text-sm font-semibold text-amber-800">
          <CheckCircle2 className="h-4 w-4 mr-1.5 text-amber-500" />
          Creating a New Election
        </h4>
        <p className="mt-1.5 text-xs text-amber-700">
          To create an election, navigate to the Elections page from the main sidebar and click "Create Election". You'll need to fill in the basic details and configure the election settings.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Key Election Settings</h4>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
            <li>Election title and organization name</li>
            <li>Election date and duration</li>
            <li>Number of positions to be filled (number to be elected)</li>
            <li>Nominee display order (alphabetical, random, etc.)</li>
            <li>Maximum voters and nominees allowed</li>
            <li>Gender quotas, if applicable</li>
            <li>Self-registration and voting access settings</li>
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Election Status Lifecycle</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            <div className="bg-white border p-2 rounded text-center">
              <span className="text-xs font-medium">Draft</span>
            </div>
            <div className="bg-green-100 p-2 rounded text-center">
              <span className="text-xs font-medium">Active</span>
            </div>
            <div className="bg-blue-100 p-2 rounded text-center">
              <span className="text-xs font-medium">Completed</span>
            </div>
            <div className="bg-gray-200 p-2 rounded text-center">
              <span className="text-xs font-medium">Archived</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-3">
            Elections start in "Draft" mode, allowing you to configure settings and add nominees before making it "Active" for voting. After voting concludes, elections are marked "Completed" for results analysis, and can later be "Archived" for historical record-keeping.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Best Practices</h4>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
            <li>Use clear, descriptive titles that identify the purpose of the election</li>
            <li>Configure election settings before adding nominees</li>
            <li>Consider using election groups to organize related elections</li>
            <li>Test the election setup before making it active for voters</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function VoterSetupStep() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-3">
        Managing voters is a critical part of running successful elections. Vote+ provides several ways to add voters to your elections.
      </p>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-3">
        <h4 className="flex items-center text-sm font-semibold text-amber-800">
          <CheckCircle2 className="h-4 w-4 mr-1.5 text-amber-500" />
          Creating Voter Groups
        </h4>
        <p className="mt-1.5 text-xs text-amber-700">
          Voter groups allow you to organize voters and generate credentials in bulk. To create a voter group, go to the Voters page from the main sidebar and click "Create Voter Group".
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Voter Management Methods</h4>
          <div className="space-y-3 mt-3">
            <div>
              <h5 className="text-sm font-medium">Voter Groups</h5>
              <p className="text-sm text-gray-600">
                Create groups with a custom prefix and starting number to generate sequential voter credentials (e.g., VOTER001, VOTER002).
              </p>
            </div>

            <div>
              <h5 className="text-sm font-medium">Manual Addition</h5>
              <p className="text-sm text-gray-600">
                Add individual voters with custom details and credentials.
              </p>
            </div>

            <div>
              <h5 className="text-sm font-medium">Import from File</h5>
              <p className="text-sm text-gray-600">
                Upload a CSV or Excel file with voter information for bulk import.
              </p>
            </div>

            <div>
              <h5 className="text-sm font-medium">Self-Registration</h5>
              <p className="text-sm text-gray-600">
                Enable voters to register themselves with verification methods like email confirmation.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Voter Credentials</h4>
          <p className="text-sm text-gray-600 mb-3">
            Each voter receives unique login credentials:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>Username (often with a group-specific prefix)</li>
            <li>Initial password (randomly generated or following a pattern)</li>
            <li>Optional registration number for additional verification</li>
          </ul>
          <p className="text-sm text-gray-600 mt-3">
            Credentials can be distributed via email, SMS, or printed materials.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Best Practices</h4>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
            <li>Create separate voter groups for different constituencies or departments</li>
            <li>Use recognizable prefixes that help identify the voter's group</li>
            <li>Consider requiring voters to change their password on first login</li>
            <li>Provide clear instructions to voters on how to access the voting interface</li>
            <li>Test the voting process with sample voters before the election goes live</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function NomineeSetupStep() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-3">
        As an Election Administrator, one of your key responsibilities is managing nominees for your assigned elections. Let's walk through the process of adding nominees.
      </p>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-3">
        <h4 className="flex items-center text-sm font-semibold text-amber-800">
          <CheckCircle2 className="h-4 w-4 mr-1.5 text-amber-500" />
          Adding Nominees
        </h4>
        <p className="mt-1.5 text-xs text-amber-700">
          To add nominees, navigate to the Nominees page from the main sidebar. Select your assigned election and click "Add Nominee" to enter their details.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Nominee Information</h4>
          <p className="text-sm text-gray-600 mb-3">
            For each nominee, you can provide the following details:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
            <li>Full name</li>
            <li>Gender (important for elections with gender quotas)</li>
            <li>Position or order in the ballot (if not using alphabetical or random order)</li>
            <li>Photo upload</li>
            <li>Biographical information</li>
            <li>Additional custom fields relevant to the election</li>
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Nominee Status Management</h4>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-green-100 p-2 rounded text-center">
              <span className="text-xs font-medium">Active</span>
            </div>
            <div className="bg-orange-100 p-2 rounded text-center">
              <span className="text-xs font-medium">Withdrawn</span>
            </div>
            <div className="bg-red-100 p-2 rounded text-center">
              <span className="text-xs font-medium">Disqualified</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-3">
            You can update a nominee's status if they withdraw from the election or are disqualified for any reason. This ensures that votes are not wasted on ineligible candidates.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Best Practices</h4>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
            <li>Use consistent photo sizes and backgrounds for a professional appearance</li>
            <li>Keep biographical information concise and relevant</li>
            <li>Verify nominee information for accuracy before the election goes live</li>
            <li>If using position numbers, ensure they are sequential and without gaps</li>
            <li>Consider gender balance requirements when approving nominees</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function CompleteStep() {
  // Get user role
  const user = getStoredUser();
  const userRole = user?.role || "viewer";
  const userName = user?.fullName || user?.username || "User";

  return (
    <div className="space-y-2 text-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 className="h-5 w-5" />
      </div>

      <h3 className="app-section-title">
        Congratulations, {userName}!
      </h3>

      <p className="app-body max-w-lg mx-auto">
        You've completed the onboarding process and are ready to start using Vote+ as a{" "}
        {userRole === "super_admin"
          ? "Super Administrator"
          : userRole === "franchise_admin"
            ? "Franchise Administrator"
            : "Election Administrator"}.
      </p>

      <div className="rounded-lg border border-gray-200 p-2.5 bg-white max-w-lg mx-auto mt-2 text-left">
        <h4 className="app-label mb-1">Next Steps</h4>
        <ul className="list-disc list-inside app-body space-y-1">
          {userRole === "super_admin" && (
            <>
              <li>Create your first franchise organization</li>
              <li>Add franchise administrators to help manage elections</li>
              <li>Configure system-wide settings and defaults</li>
            </>
          )}

          {userRole === "franchise_admin" && (
            <>
              <li>Create your first election</li>
              <li>Set up voter groups and generate voter credentials</li>
              <li>Add election administrators to help manage nominees</li>
            </>
          )}

          {userRole === "election_admin" && (
            <>
              <li>Review your assigned elections</li>
              <li>Add nominees with their profiles and photos</li>
              <li>Monitor election progress and results</li>
            </>
          )}

          <li>Explore the dashboard and other system features</li>
          <li>Check out the help documentation for detailed guides</li>
        </ul>
      </div>

      <p className="app-muted mt-2">
        Remember, you can always return to these guides through the Help section if you need a refresher.
      </p>
    </div>
  );
}
