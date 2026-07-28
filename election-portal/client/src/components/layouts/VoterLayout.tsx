import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Vote, ChevronLeft, User, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { SiteFooter } from '@/components/layout/SiteFooter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { clearAccountSession } from '@/lib/session';
import { useToast } from '@/hooks/use-toast';

interface VoterLayoutProps {
  children: React.ReactNode;
  title?: string;
  /** Show a back-chevron in the header (navigates to /voting) */
  showBack?: boolean;
  onBack?: () => void;
}

export default function VoterLayout({ children, title, showBack, onBack }: VoterLayoutProps) {
  const [, navigate] = useLocation();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) navigate('/login');
  }, [navigate]);

  useEffect(() => {
    document.title = title ? `${title} | Vote+` : 'Vote+';
  }, [title]);

  const handleLogout = () => {
    clearAccountSession();
    queryClient.clear();
    navigate('/login');
    toast({ title: 'Logged out', description: 'You have been signed out successfully.', variant: 'success' });
  };

  // Derive user initials for the avatar circle
  const userFullName =
    (() => {
      try {
        const u = localStorage.getItem('user');
        if (u) {
          const parsed = JSON.parse(u);
          return parsed.fullName || parsed.username || '';
        }
      } catch { /* ignore */ }
      return localStorage.getItem('userFullName') || '';
    })();

  const initials = userFullName
    ? userFullName
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'V';

  const isOnBallot = location.startsWith('/election/');
  const isOnResults = location.startsWith('/results/');
  const isOnProfile = location === '/profile';
  const isOnSettings = location === '/settings';

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background dark:bg-gray-900">
      {/* ── Header ── */}
      <header className="bg-white/95 backdrop-blur-md dark:bg-gray-800 border-b border-slate-200/80 dark:border-gray-700 sticky top-0 z-30 pt-safe">
        <div className="flex items-center justify-between h-16 px-4 sm:px-6">
          {/* Left: back button or logo */}
          {showBack || onBack ? (
            <button
              type="button"
              onClick={onBack ?? (() => navigate('/voting'))}
              className="flex items-center justify-center w-11 h-11 -ml-2 rounded-xl text-gray-600 hover:bg-primary/10 active:bg-gray-200 transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/voting')}
              className="flex-shrink-0"
              aria-label="Home"
            >
              <img
                src="/logo.png"
                alt="Vote+"
                className="h-9 w-auto object-contain"
              />
            </button>
          )}

          {/* Center title (when on sub-page) */}
          {(showBack || onBack) && title ? (
            <p className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-gray-800 dark:text-white max-w-[60%] truncate">
              {title}
            </p>
          ) : null}

          {/* Right: notifications + user menu */}
          <div className="flex items-center gap-1">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary font-bold text-sm hover:bg-primary/20 active:scale-95 transition-all"
                  title={`Logged in as ${userFullName}`}
                  aria-label="Account menu"
                >
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <p className="font-semibold truncate">{userFullName || 'Voter'}</p>
                  <p className="text-xs text-muted-foreground">Voter account</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center cursor-pointer">
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLogoutConfirmOpen(true)} className="text-red-600 focus:text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <ConfirmDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        onConfirm={handleLogout}
        title="Log out?"
        description="You'll need to sign in again to access your account."
        confirmText="Logout"
        variant="default"
      />

      {/* ── Main Content ── */}
      <main className="flex flex-1 flex-col min-h-[calc(100dvh-4rem)] pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-8 bg-background dark:bg-gray-900">
        <div className="flex flex-1 flex-col w-full">{children}</div>
        <SiteFooter />
      </main>

      {/* ── Bottom Navigation (mobile only) ── */}
      <nav
        className="lg:hidden bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-gray-700 fixed bottom-0 left-0 right-0 z-50 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] mobile-bottom-nav"
        aria-label="Voter navigation"
      >
        <ul className="flex h-16 items-stretch justify-around">
          <li className="flex-1">
            <button
              type="button"
              onClick={() => navigate('/voting')}
              className={cn(
                'mx-auto w-[calc(100%-0.5rem)] flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors active:bg-primary/5',
                !isOnBallot && !isOnResults && !isOnProfile && !isOnSettings ? 'bg-primary/10 text-primary' : 'text-gray-500 dark:text-gray-400',
              )}
            >
              <Vote className="h-5 w-5" />
              <span>Elections</span>
            </button>
          </li>
          <li className="flex-1">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className={cn(
                'mx-auto w-[calc(100%-0.5rem)] flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors active:bg-primary/5',
                isOnProfile ? 'bg-primary/10 text-primary' : 'text-gray-500 dark:text-gray-400',
              )}
            >
              <User className="h-5 w-5" />
              <span>Profile</span>
            </button>
          </li>
          <li className="flex-1">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className={cn(
                'mx-auto w-[calc(100%-0.5rem)] flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors active:bg-primary/5',
                isOnSettings ? 'bg-primary/10 text-primary' : 'text-gray-500 dark:text-gray-400',
              )}
            >
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
