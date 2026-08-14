import { Link, useLocation } from "wouter";
import { cloneElement, isValidElement } from "react";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import { buildVoterGroupsListUrl } from "@/lib/voterGroupNav";
import {
  LayoutDashboard,
  Building,
  Vote,
  UserPlus,
  UserCog,
  Activity,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";

interface SidebarProps {
  /** Mobile/tablet drawer open state (below lg breakpoint) */
  isOpen: boolean;
  /** Desktop icon-only collapse state (lg breakpoint and up) */
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  userRole?: string;
}

function isElectionSectionPath(path: string) {
  return path === "/elections" || path.startsWith("/elections/");
}

function isVoterGroupsSectionPath(path: string) {
  return path === "/voters" || path.startsWith("/voters");
}

function isPathActive(location: string, href: string) {
  if (href === "/") {
    return location === "/" || location === "/dashboard";
  }
  if (href === "/elections") {
    return (
      location === "/elections" ||
      location.startsWith("/elections/")
    );
  }
  return location === href || location.startsWith(`${href}/`);
}

export function Sidebar({ isOpen, isCollapsed, onClose, onToggleCollapse, userRole = "" }: SidebarProps) {
  const [location] = useLocation();

  const isSuperAdmin = userRole === "super_admin";
  const isFranchiseAdmin = userRole === "franchise_admin";
  const isElectionAdmin = userRole === "election_admin";
  const isVoter = userRole === "voter";
  const collapsed = isCollapsed && !isVoter;

  const NavLink = ({
    href,
    icon,
    label,
    nested = false,
    isActive,
  }: {
    href: string;
    icon: React.ReactNode;
    label: string;
    nested?: boolean;
    isActive?: (path: string) => boolean;
  }) => {
    const active = isActive ? isActive(location) : isPathActive(location, href.split("?")[0]);

    return (
      <Link
        href={href}
        onClick={onClose}
        title={collapsed ? label : undefined}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          nested && !collapsed ? "px-2.5 py-1.5 my-0.5 ml-5" : "px-3 py-2 my-0.5",
          collapsed && "justify-center px-0",
          active
            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
            : "text-slate-600 hover:bg-primary/5 hover:text-primary"
        )}
      >
        {isValidElement(icon)
          ? cloneElement(icon as ReactElement<{ className?: string }>, {
              className: cn(
                "shrink-0 transition-colors",
                nested ? "h-3.5 w-3.5" : "h-4 w-4",
                active ? "text-primary-foreground" : "text-slate-400 group-hover:text-primary"
              ),
            })
          : icon}
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => {
    if (collapsed) {
      return <div className="mx-3 my-2 border-t border-slate-100" aria-hidden />;
    }
    return (
      <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {children}
      </p>
    );
  };

  const BrandMark = () => (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-700 text-sm font-black text-white shadow-sm shadow-primary/30">
      V+
    </div>
  );

  const content = (
    <>
      {/* Sidebar brand header */}
      <div className={cn("flex h-14 shrink-0 items-center border-b border-slate-200/80 px-3.5", collapsed && "justify-center px-2")}>
        {collapsed ? (
          <BrandMark />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <BrandMark />
            <img src="/logo.png" alt="Vote+" className="h-7 w-auto object-contain" />
          </div>
        )}

        {/* Mobile/tablet close button */}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          aria-label="Close navigation menu"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        {/* Desktop collapse toggle */}
        {!isVoter && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary lg:flex",
              collapsed ? "mt-2" : "ml-auto"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="h-4.5 w-4.5" /> : <ChevronsLeft className="h-4.5 w-4.5" />}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-thin px-2.5 py-2.5">
        {isVoter ? (
          <NavLink href="/voting" icon={<Vote />} label="Cast Vote" />
        ) : (
          <>
            <div className="px-1 py-1.5">
              <SectionLabel>Overview</SectionLabel>
              <NavLink href="/" icon={<LayoutDashboard />} label="Dashboard" />
            </div>

            {isSuperAdmin && (
              <div className="px-1 py-1.5">
                <SectionLabel>Administration</SectionLabel>
                <NavLink href="/franchises" icon={<Building />} label="Franchises" />
                <NavLink href="/admins" icon={<UserCog />} label="Admins" />
                <NavLink href="/system-health" icon={<Activity />} label="System Health" />
              </div>
            )}

            {(isFranchiseAdmin || isElectionAdmin) && (
              <div className="px-1 py-1.5">
                <SectionLabel>Manage</SectionLabel>

                <NavLink
                  href="/elections"
                  icon={<Vote />}
                  label="Elections"
                  isActive={(path) => isElectionSectionPath(path)}
                />

                <NavLink
                  href={buildVoterGroupsListUrl()}
                  icon={<UserPlus />}
                  label="Voter Groups"
                  isActive={(path) => isVoterGroupsSectionPath(path)}
                />
                {isFranchiseAdmin && (
                  <NavLink href="/admins" icon={<UserCog />} label="Election Admins" />
                )}
              </div>
            )}
          </>
        )}
      </nav>

      {/* Footer brand tag */}
      <div className={cn("shrink-0 border-t border-slate-200/80 p-2.5", collapsed && "flex justify-center px-2")}>
        <a
          href="https://d4dx.co"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-slate-400 transition-colors hover:bg-slate-50 hover:text-primary",
            collapsed && "justify-center px-2"
          )}
          title="Powered by D4DX.CO"
        >
          <img src="/d4dx-logo.png" alt="D4DX" className="h-3.5 w-auto shrink-0 object-contain opacity-70" />
          {!collapsed && (
            <span className="min-w-0 truncate">
              Powered by <span className="font-medium">D4DX.CO</span>
            </span>
          )}
        </a>
      </div>
    </>
  );

  return (
    <aside
      className={cn(
        "sidebar fixed top-0 left-0 bottom-0 z-40 flex w-60 flex-col bg-white border-r border-slate-200/80 shadow-xl shadow-slate-900/5 transition-transform duration-300 ease-in-out lg:shadow-none",
        "lg:translate-x-0 lg:transition-[width] lg:duration-300",
        collapsed ? "lg:w-[72px]" : "lg:w-60",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {content}
    </aside>
  );
}
