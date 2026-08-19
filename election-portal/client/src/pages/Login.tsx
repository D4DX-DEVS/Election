import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clearAccountSession, storeAccountSession } from '@/lib/session';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { BallotIllustration } from '@/components/illustrations/BallotIllustration';

interface LoginResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
    email?: string;
    fullName?: string;
    franchiseId?: string;
    electionAccess?: string[];
    lastLogin?: string | null;
  };
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');
      return data as LoginResponse;
    },
    onSuccess: (data) => {
      queryClient.clear();
      storeAccountSession(data.token, data.user);

      toast({
        title: 'Welcome back!',
        description: `Logged in as ${data.user.fullName || data.user.username}`,
        variant: 'success',
      });

      if (data.user.lastLogin) {
        const last = new Date(data.user.lastLogin);
        if (!isNaN(last.getTime())) {
          toast({
            title: 'Last login',
            description: last.toLocaleString("en-GB", { dateStyle: 'medium', timeStyle: 'short', hour12: true }),
            variant: 'info',
          });
        }
      }

      if (data.user.role === 'voter') {
        navigate('/voting');
      } else if (data.user.role === 'election_admin') {
        navigate('/elections');
      } else {
        navigate('/');
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Login failed',
        description: error?.message || 'Invalid username or password',
        variant: 'destructive',
      });
    },
  });

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    loginMutation.mutate({ username, password });
  };

  useEffect(() => {
    document.title = 'Login | Vote+';
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('user');
    if (token && user) {
      try {
        const userData = JSON.parse(user);
        if (userData.role === 'super_admin' || userData.role === 'franchise_admin') {
          navigate('/');
        } else if (userData.role === 'election_admin') {
          navigate('/elections');
        } else {
          navigate('/voting');
        }
      } catch {
        clearAccountSession();
        queryClient.clear();
      }
    }
  }, [navigate, queryClient]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 sm:p-6">
      <div className="w-full max-w-4xl grid md:grid-cols-2 bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-200/70 dark:border-slate-800 overflow-hidden">
        {/* Visual panel */}
        <div className="relative hidden md:flex flex-col items-center justify-center bg-gradient-to-br from-primary via-blue-600 to-red-500 p-10 overflow-hidden">
          <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 -right-10 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 flex flex-col items-center text-center gap-5">
            <BallotIllustration className="h-36 w-36" />
            <div className="bg-white/95 rounded-2xl px-5 py-3 shadow-lg">
              <img src="/logo.png" alt="Vote+" className="h-10 w-auto object-contain" />
            </div>
            <p className="text-white/90 text-sm max-w-[220px] leading-relaxed">
              Comprehensive Election Management System
            </p>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12">
          {/* Brand strip (shown only when visual panel is hidden, e.g. mobile) */}
          <div className="pb-6 flex flex-col items-center md:hidden">
            <img src="/logo.png" alt="Vote+" className="h-14 w-auto object-contain mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs">
              Comprehensive Election Management System
            </p>
          </div>

          <h1 className="app-page-title mb-1">Sign in</h1>
          <p className="app-muted mb-8">
            Enter the credentials provided by your administrator.
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="username">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loginMutation.isPending}
                  className="pl-10 h-12 rounded-xl text-base bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loginMutation.isPending}
                  className="pl-10 pr-12 h-12 rounded-xl text-base bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loginMutation.isPending}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none disabled:opacity-50 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-semibold mt-2 shadow-md shadow-primary/25 transition-transform active:scale-[0.98] hover:shadow-lg hover:shadow-primary/30"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Signing in…' : 'Sign In'}
            </Button>

            <p className="text-center text-sm pt-1">
              <Link href="/forgot-password" className="text-primary font-medium hover:underline">
                Forgot password?
              </Link>
            </p>
          </form>

          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
