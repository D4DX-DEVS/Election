import { Menu, ChevronDown, LogOut, UserCog, User, Shield, HelpCircle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { HelpDialog } from "@/components/help/HelpDialog";
import { NotificationBell } from "@/components/layout/NotificationBell";

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
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
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
    <header className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-slate-200 z-30">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden mr-2" 
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center">
            <img
              src="/logo.png"
              alt="Vote+"
              className="h-12 w-auto object-contain"
            />
          </div>
        </div>

        <div className="flex items-center">
          {/* Help button */}
          <div className="relative mr-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative text-primary hover:text-primary-dark"
              onClick={handleHelpClick}
              title="Help & Tutorials"
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Notifications */}
          <div className="relative mr-2">
            <NotificationBell />
          </div>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 p-2 rounded-md">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex md:flex-col md:items-start">
                  {user.name.trim().toLowerCase() !== (user.displayRole || user.role).trim().toLowerCase() && (
                    <span className="text-sm font-medium">{user.name}</span>
                  )}
                  <Badge variant="outline" className="px-1 py-0 text-xs h-5 bg-slate-100">
                    <Shield className="h-3 w-3 mr-1" />
                    {user.displayRole || user.role}
                  </Badge>
                </div>
                <ChevronDown className="h-4 w-4" />
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
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center cursor-pointer">
                  <UserCog className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleHelpClick}>
                <HelpCircle className="h-4 w-4 mr-2" />
                Help & Tutorial
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </header>
  );
}
