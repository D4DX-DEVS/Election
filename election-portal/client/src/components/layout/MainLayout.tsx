import { ReactNode, useState, useEffect } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { SiteFooter } from "./SiteFooter";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  // Mobile-first: sidebar starts closed on mobile (the bottom nav is the
  // primary navigation there). On large screens the sidebar is always visible.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState({
    name: "Loading...",
    role: "",
    fullName: "",
    email: ""
  });

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  // Load user data from localStorage
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        
        // Create a user-friendly display name
        const displayName = parsedUser.fullName || parsedUser.username || "User";
        
        setCurrentUser({
          name: displayName,
          role: parsedUser.role || "",
          fullName: parsedUser.fullName || parsedUser.username || "",
          email: parsedUser.email || ""
        });
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Header 
        toggleSidebar={toggleSidebar} 
        user={{
          name: currentUser.name,
          role: currentUser.role,
          displayRole: currentUser.role
            ? currentUser.role
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
            : ""
        }} 
      />
      <Sidebar isOpen={sidebarOpen} userRole={currentUser.role} />

      {/* Backdrop shown when the sidebar drawer is open on mobile */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 top-[calc(4rem+env(safe-area-inset-top,0px))] bg-black/40 z-10 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <main className={cn(
        "flex flex-1 flex-col w-full bg-background transition-padding duration-300",
        "min-h-[calc(100dvh-4rem)]",
        "px-4 pt-[calc(5rem+env(safe-area-inset-top,0px))] sm:px-6 lg:px-8",
        "pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-8",
        "lg:pl-72"
      )}>
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </main>

      <BottomNav />
    </div>
  );
}
