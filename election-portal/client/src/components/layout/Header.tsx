import { Menu, LogOut, UserCog, User, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { HelpDialog } from "@/components/help/HelpDialog";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { clearAccountSession } from "@/lib/session";

interface HeaderProps {
  toggleSidebar: () => void;
  user: {
    name: string;
    role: string;
    displayRole?: string;
    avatar?: string;
  };
}

export function Header({ toggleSidebar, user }: HeaderProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    clearAccountSession();
    queryClient.clear();
    navigate("/login");
  };

  // Open the role-based help dialog
  const handleHelpClick = () => {
    setHelpOpen(true);
  };

  // Get user initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 z-30 pt-safe">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        <div className="flex items-center">
          {/* Super admins and franchise admins use the bottom nav on mobile — no sidebar drawer to open */}
          {user.role !== "super_admin" && user.role !== "franchise_admin" && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden mr-2"
              onClick={toggleSidebar}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          <div className="flex items-center">
            <img
              src="/logo.png"
              alt="Vote+"
              className="h-9 w-auto object-contain"
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Notifications — hidden for super admins */}
          {user.role !== "super_admin" && (
            <div className="relative mr-2">
              <NotificationBell />
            </div>
          )}

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full p-0 border border-border bg-muted/50 shadow-sm hover:bg-muted hover:shadow active:scale-95 transition-all">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="bg-transparent text-black font-semibold">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuLabel className="text-xs text-muted-foreground pt-0">
                {user.displayRole || user.role}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleHelpClick}>
                <HelpCircle className="h-4 w-4 mr-2" />
                Help & Tutorial
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLogoutConfirmOpen(true)}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <ConfirmDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        onConfirm={handleLogout}
        title="Log out?"
        description="You'll need to sign in again to access your account."
        confirmText="Logout"
        variant="default"
      />
    </header>
  );
}
