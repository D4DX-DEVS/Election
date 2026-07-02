import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import Dashboard from "@/pages/Dashboard";
import Elections from "@/pages/Elections";
import CreateElection from "@/pages/CreateElection";
import EditElection from "@/pages/EditElection";
import ElectionWorkspace from "@/pages/ElectionWorkspace";
import ElectionResults from "@/pages/ElectionResults";
import Voters from "@/pages/Voters";
import Analytics from "@/pages/Analytics";
import Franchises from "@/pages/Franchises";
import Admins from "@/pages/Admins";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import AuditLogs from "@/pages/AuditLogs";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import Onboarding from "@/pages/Onboarding";
import VotingPortal from "@/pages/VotingPortal";
import VotingBallot from "@/pages/VotingBallot";
import VotingResults from "@/pages/VotingResults";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { canAccessPath } from "@/lib/roles";

function RedirectTo({ path }: { path: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(path);
  }, [path, setLocation]);
  return null;
}

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

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
  const { data: onboardingStatus, isLoading: isLoadingOnboarding } = useQuery({
    queryKey: ['/api/onboarding/status'],
    retry: false,
    enabled: !!user && hasToken, // Only run if we have a user and token
  });

  useEffect(() => {
    // If we have a token but the API call failed, clear localStorage
    if (hasToken && isError && !isLoading) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
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

    // Skip onboarding
    const needsOnboarding = false;
    localStorage.setItem('needsOnboarding', 'false');

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

      if (location !== targetPath) {
        console.log(`Redirecting ${role} to ${targetPath}`);
        setLocation(targetPath);
      }
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
    const superAdminOnlyPaths = ['/franchises', '/admins', '/audit-logs'];
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
  }, [user, isLoading, isError, hasToken, location, setLocation]);

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
        <Route path="/voters" component={Voters} />
        <Route path="/analytics" component={() => <RedirectTo path="/elections" />} />
        <Route path="/election-groups" component={() => <RedirectTo path="/elections" />} />
        <Route path="/franchises" component={Franchises} />
        <Route path="/admins" component={Admins} />
        <Route path="/voter-groups" component={() => <RedirectTo path="/voters" />} />
        <Route path="/reports" component={Reports} />
        <Route path="/profile" component={Profile} />
        <Route path="/settings" component={Settings} />
        <Route path="/audit-logs" component={AuditLogs} />

        <Route component={NotFound} />
      </Switch>
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