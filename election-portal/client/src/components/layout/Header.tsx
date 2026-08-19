import { LogOut, User, HelpCircle, ChevronDown } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface HeaderProps {
  sidebarCollapsed: boolean;
  user: {
    name: string;
    role: string;
    displayRole?: string;
    avatar?: string;
  };
}

export function Header({ sidebarCollapsed, user }: HeaderProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleLogout = () => {
    clearAccountSession();
    queryClient.clear();
    navigate("/login");
    toast({ title: "Logged out", description: "You have been signed out successfully.", variant: "success" });
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
    <header
      className={cn(
        "fixed top-0 right-0 left-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 pt-safe transition-[padding] duration-300",
        user.role !== "voter" && (sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-60")
      )}
    >
      <div className="flex items-center justify-between h-14 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center lg:hidden">
            <img
              src="/logo.png"
              alt="Vote+"
              className="h-8 w-auto object-contain"
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
              <button
                type="button"
                className="flex h-11 items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-slate-100 active:scale-[0.98]"
              >
                <Avatar className="h-8 w-8 ring-2 ring-white shadow-sm">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuLabel className="app-muted pt-0 font-normal">
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
