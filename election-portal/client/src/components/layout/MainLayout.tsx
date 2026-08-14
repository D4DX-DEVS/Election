import { ReactNode, useState, useEffect } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { SiteFooter } from "./SiteFooter";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
}

const COLLAPSE_STORAGE_KEY = "voteplus:sidebar-collapsed";

export function MainLayout({ children }: MainLayoutProps) {
  // Mobile/tablet: sidebar is an off-canvas drawer, closed by default.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop: sidebar is always visible, but can collapse to icon-only. Persisted across sessions.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [currentUser, setCurrentUser] = useState({
    name: "Loading...",
    role: "",
    fullName: "",
    email: ""
  });

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore storage errors (private browsing, quota, etc.)
      }
      return next;
    });
  };

  // Close the mobile drawer whenever the viewport grows past the lg breakpoint.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setSidebarOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

  const isVoter = currentUser.role === "voter";
  const collapsed = sidebarCollapsed && !isVoter;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Header
        toggleSidebar={toggleSidebar}
        sidebarCollapsed={collapsed}
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
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={toggleSidebarCollapse}
        userRole={currentUser.role}
      />

      {/* Backdrop shown when the sidebar drawer is open on mobile/tablet */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <main className={cn(
        "flex flex-1 flex-col w-full bg-background transition-[padding] duration-300",
        "min-h-[calc(100dvh-3.5rem)]",
        "px-4 pt-[calc(4.5rem+env(safe-area-inset-top,0px))] sm:px-6 lg:px-8",
        "pb-[calc(2rem+env(safe-area-inset-bottom,0px))]",
        collapsed ? "lg:pl-[72px]" : "lg:pl-60"
      )}>
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </main>
    </div>
  );
}
