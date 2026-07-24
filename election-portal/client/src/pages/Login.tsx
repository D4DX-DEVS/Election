import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

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

      queryClient.clear();

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
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Top brand strip */}
      <div className="flex-shrink-0 pt-safe">
        <div className="pt-10 pb-8 flex flex-col items-center px-6">
          <img
            src="/logo.png"
            alt="Vote+"
            className="h-16 w-auto object-contain mb-4 drop-shadow-sm"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
            Comprehensive Election Management System
          </p>
        </div>
      </div>

      {/* Login card */}
      <div className="flex-1 flex flex-col justify-start px-5 max-w-sm mx-auto w-full">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-blue-900/8 border border-gray-100 dark:border-gray-700 p-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Sign in</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Enter the credentials provided by your administrator.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loginMutation.isPending}
                  className="pl-10 h-12 rounded-xl text-base bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus-visible:ring-primary"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loginMutation.isPending}
                  className="pl-10 pr-12 h-12 rounded-xl text-base bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus-visible:ring-primary"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loginMutation.isPending}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-bold mt-2 shadow-md shadow-primary/25"
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
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8 mb-4">
          Powered by{' '}
          <a
            href="https://d4dx.co"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            D4DX.CO
          </a>
        </p>
      </div>
    </div>
  );
}
