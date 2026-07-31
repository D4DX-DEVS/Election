import { Switch, Route, useLocation } from "wouter";
import { lazy, Suspense, useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import { canAccessPath } from "@/lib/roles";
import { clearAccountSession } from "@/lib/session";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Elections = lazy(() => import("@/pages/Elections"));
const CreateElection = lazy(() => import("@/pages/CreateElection"));
const EditElection = lazy(() => import("@/pages/EditElection"));
const ElectionWorkspace = lazy(() => import("@/pages/ElectionWorkspace"));
const ElectionResults = lazy(() => import("@/pages/ElectionResults"));
const Voters = lazy(() => import("@/pages/Voters"));
const Franchises = lazy(() => import("@/pages/Franchises"));
const Admins = lazy(() => import("@/pages/Admins"));
const Reports = lazy(() => import("@/pages/Reports"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const AuditLogs = lazy(() => import("@/pages/AuditLogs"));
const SystemHealth = lazy(() => import("@/pages/SystemHealth"));
const Login = lazy(() => import("@/pages/Login"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const VotingPortal = lazy(() => import("@/pages/VotingPortal"));
const VotingBallot = lazy(() => import("@/pages/VotingBallot"));
const VotingResults = lazy(() => import("@/pages/VotingResults"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-white"
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"
          aria-hidden="true"
        />
        <p className="mt-2 text-sm text-gray-600">Loading Vote+…</p>
      </div>
    </div>
  );
}

function RedirectTo({ path }: { path: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(path);
  }, [path, setLocation]);
  return null;
}

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [, refreshSession] = useState(0);

  useEffect(() => {
    const handleSessionChange = (event: StorageEvent) => {
      if (event.key === "authToken" || event.key === "user") {
        queryClient.clear();
        refreshSession((value) => value + 1);
      }
    };
    window.addEventListener("storage", handleSessionChange);
    return () => window.removeEventListener("storage", handleSessionChange);
  }, []);

  // Check for token in localStorage first for quicker response
  const hasToken = localStorage.getItem('authToken') !== null;

  // API check if user is authenticated (only if we have a token)
  const { data: user, isLoading, isError } = useQuery<{
    id: string;
    username: string;
    role: string;
    email?: string;
    fullName?: string;
    franchiseId?: string;
    status?: string;
    isVoter?: boolean;
    onboardingCompleted?: boolean;
  }>({
    queryKey: ['/api/auth/me'],
    retry: false,
    refetchOnWindowFocus: false,
    enabled: hasToken, // Only run query if we have a token
  });

  // Check if user onboarding is completed (once we have user data)
  const { data: onboardingStatus, isLoading: isLoadingOnboarding } = useQuery<{
    onboardingCompleted?: boolean;
  }>({
    queryKey: ['/api/onboarding/status'],
    retry: false,
    enabled: !!user && hasToken, // Only run if we have a user and token
  });

  useEffect(() => {
    // If we have a token but the API call failed, clear localStorage
    if (hasToken && isError && !isLoading) {
      clearAccountSession();
      queryClient.clear();
      if (location !== '/login' && location !== '/forgot-password' && !location.startsWith('/voting/')) {
        setLocation('/login');
      }
      return;
    }

    // If we don't have a token and not on login page, redirect to login
    // Special case: don't redirect from login, forgot-password, or results page
    if (
      !hasToken &&
      location !== '/login' &&
      location !== '/forgot-password' &&
      !location.startsWith('/results/')
    ) {
      setLocation('/login');
      return;
    }

    const needsOnboarding =
      user?.role !== "voter" &&
      onboardingStatus?.onboardingCompleted === false;
    localStorage.setItem('needsOnboarding', String(needsOnboarding));

    if (
      user &&
      !isLoadingOnboarding &&
      onboardingStatus?.onboardingCompleted === true &&
      location === "/onboarding"
    ) {
      const targetPath =
        user.role === "election_admin"
          ? "/elections"
          : user.role === "voter"
            ? "/voting"
            : "/";
      setLocation(targetPath);
      return;
    }

    if (
      user &&
      !isLoadingOnboarding &&
      needsOnboarding &&
      location !== "/onboarding"
    ) {
      setLocation("/onboarding");
      return;
    }

    // If we have user data and we're on login page, redirect to appropriate page
    if (user && location === '/login') {
      let role = 'voter'; // Default role

      // Check if user has a role property
      if (user && typeof user === 'object' && 'role' in user) {
        role = user.role;
      } else {
        // Try to get role from localStorage
        try {
          const storedUserString = localStorage.getItem('user');
          if (storedUserString) {
            const storedUser = JSON.parse(storedUserString);
            if (storedUser && typeof storedUser === 'object' && 'role' in storedUser) {
              role = storedUser.role;
            }
          }
        } catch (e) {
          console.error('Error parsing stored user:', e);
        }
      }

      // Check if user needs onboarding
      if (needsOnboarding) {
        setLocation('/onboarding');
        return;
      }

      // Only redirect if we're not already at the target location to prevent infinite loops
      const targetPath = role === 'voter'
                          ? '/voting'
                          : role === 'election_admin'
                            ? '/elections'
                            : '/';

      console.log(`Redirecting ${role} to ${targetPath}`);
      setLocation(targetPath);
      return;
    }

    // ── Guard: role-based path access (super_admin > franchise_admin > election_admin > voter) ──
    if (user && !canAccessPath(user.role, location)) {
      const fallback =
        user.role === "voter"
          ? "/voting"
          : user.role === "election_admin"
            ? "/elections"
            : "/";
      if (location !== fallback) {
        setLocation(fallback);
        return;
      }
    }

    // ── Guard: voters may only reach voting-related pages ──
    if (user && user.role === 'voter') {
      const voterAllowed =
        location === '/voting' ||
        location.startsWith('/election/') ||
        location.startsWith('/results/') ||
        location === '/login' ||
        location === '/onboarding' ||
        location === '/profile' ||
        location === '/settings';
      if (!voterAllowed) {
        setLocation('/voting');
        return;
      }
    }

    // ── Guard: pages that only super_admin may access ──
    // franchise_admin and election_admin are redirected to their own home page.
    const superAdminOnlyPaths = ['/franchises', '/audit-logs'];
    if (
      user &&
      user.role !== 'super_admin' &&
      user.role !== 'voter' &&
      superAdminOnlyPaths.some((p) => location === p || location.startsWith(p + '/'))
    ) {
      const fallback = user.role === 'election_admin' ? '/elections' : '/';
      setLocation(fallback);
      return;
    }

    // ── Guard: voter-only pages must not be reached by admin roles ──
    // (Extra safety: admin accidentally navigating to /voting is sent home.)
    const voterOnlyPaths = ['/voting'];
    if (
      user &&
      user.role !== 'voter' &&
      voterOnlyPaths.some((p) => location === p)
    ) {
      const adminHome = user.role === 'election_admin' ? '/elections' : '/';
      setLocation(adminHome);
      return;
    }
  }, [
    user,
    onboardingStatus,
    isLoading,
    isLoadingOnboarding,
    isError,
    hasToken,
    location,
    setLocation,
  ]);

  // Show loading state while checking authentication 
  // Only if we have a token and are still loading (not on login page)
  if (hasToken && isLoading && location !== '/login' && !location.startsWith('/voting/')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Router() {
  return (
    <AuthWrapper>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          {/* Public / auth routes */}
          <Route path="/login" component={Login} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/onboarding" component={Onboarding} />

          {/* Voting routes */}
          <Route path="/voting" component={VotingPortal} />
          <Route path="/election/:electionId" component={VotingBallot} />
          <Route path="/results/:electionId" component={VotingResults} />

          {/* Admin routes */}
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/elections/create" component={CreateElection} />
          <Route path="/elections/:id/edit" component={EditElection} />
          <Route path="/elections/:id/results" component={ElectionResults} />
          <Route path="/elections/:id" component={ElectionWorkspace} />
          <Route path="/elections" component={Elections} />
          <Route path="/nominees" component={() => <RedirectTo path="/elections" />} />
          <Route path="/voters" component={() => <Voters />} />
          <Route path="/analytics" component={() => <RedirectTo path="/elections" />} />
          <Route path="/election-groups" component={() => <RedirectTo path="/elections" />} />
          <Route path="/franchises" component={Franchises} />
          <Route path="/admins" component={Admins} />
          <Route path="/system-health" component={SystemHealth} />
          <Route path="/voter-groups" component={() => <RedirectTo path="/voters" />} />
          <Route path="/reports" component={Reports} />
          <Route path="/profile" component={Profile} />
          <Route path="/settings" component={Settings} />
          <Route path="/audit-logs" component={AuditLogs} />

          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AuthWrapper>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <InstallPrompt />
        <UpdatePrompt />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
