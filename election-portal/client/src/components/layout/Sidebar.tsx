import { Link, useLocation } from "wouter";
import { cloneElement, isValidElement, useEffect, useState } from "react";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import { buildVoterGroupsListUrl } from "@/lib/voterGroupNav";
import {
  LayoutDashboard,
  Building,
  Vote,
  UserPlus,
  UserCog,
  ChevronDown,
  FileText,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  userRole?: string;
}

function isElectionSectionPath(path: string) {
  return (
    path === "/elections" ||
    path.startsWith("/elections/") ||
    path === "/reports"
  );
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

export function Sidebar({ isOpen, userRole = "" }: SidebarProps) {
  const [location] = useLocation();
  const [electionsOpen, setElectionsOpen] = useState(isElectionSectionPath(location));

  const isSuperAdmin = userRole === "super_admin";
  const isFranchiseAdmin = userRole === "franchise_admin";
  const isElectionAdmin = userRole === "election_admin";
  const isVoter = userRole === "voter";

  useEffect(() => {
    if (isElectionSectionPath(location)) setElectionsOpen(true);
  }, [location]);

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
        className={cn(
          "group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-colors",
          nested ? "px-3 py-2 my-0.5 ml-6" : "px-4 py-2.5 my-0.5",
          active
            ? "bg-primary/10 text-primary font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:bg-primary"
            : "text-slate-600 hover:bg-primary/5 hover:text-primary"
        )}
      >
        {isValidElement(icon)
          ? cloneElement(icon as ReactElement<{ className?: string }>, {
              className: cn(
                "shrink-0 transition-colors",
                nested ? "h-4 w-4" : "h-5 w-5",
                active ? "text-primary" : "text-slate-400 group-hover:text-primary"
              ),
            })
          : icon}
        <span>{label}</span>
      </Link>
    );
  };

  const NavGroup = ({
    label,
    icon,
    open,
    onToggle,
    active,
    children,
  }: {
    label: string;
    icon: React.ReactNode;
    open: boolean;
    onToggle: () => void;
    active: boolean;
    children: React.ReactNode;
  }) => (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "group relative flex w-full items-center gap-3 px-4 py-2.5 my-0.5 rounded-xl text-sm font-medium transition-colors text-left",
          active
            ? "bg-primary/10 text-primary font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:bg-primary"
            : "text-slate-600 hover:bg-primary/5 hover:text-primary"
        )}
      >
        {isValidElement(icon)
          ? cloneElement(icon as ReactElement<{ className?: string }>, {
              className: cn(
                "h-5 w-5 shrink-0",
                active ? "text-primary" : "text-slate-400 group-hover:text-primary"
              ),
            })
          : icon}
        <span className="flex-1">{label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? <div className="pb-1">{children}</div> : null}
    </div>
  );

  if (isVoter) {
    return (
      <aside
        className={cn(
          "sidebar scrollbar-thin fixed top-[calc(4rem+env(safe-area-inset-top,0px))] left-0 bottom-0 w-64 bg-white border-r border-slate-200/80 overflow-y-auto z-20 transition-transform duration-300",
          !isOpen && "transform -translate-x-full lg:translate-x-0"
        )}
      >
        <nav className="mt-4 px-4 py-2">
          <NavLink href="/voting" icon={<Vote />} label="Cast Vote" />
        </nav>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "sidebar scrollbar-thin fixed top-[calc(4rem+env(safe-area-inset-top,0px))] left-0 bottom-0 w-64 bg-white border-r border-slate-200/80 overflow-y-auto z-20 transition-transform duration-300",
        // Super admins and franchise admins navigate via the mobile bottom nav;
        // the sidebar is desktop-only for them.
        isSuperAdmin || isFranchiseAdmin
          ? "hidden lg:block"
          : !isOpen && "transform -translate-x-full lg:translate-x-0"
      )}
    >
      <nav className="mt-4 space-y-0.5">
        <div className="px-4 py-2">
          <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Overview
          </p>
          <NavLink href="/" icon={<LayoutDashboard />} label="Dashboard" />
        </div>

        {isSuperAdmin && (
          <div className="px-4 py-2">
            <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Administration
            </p>
            <NavLink href="/franchises" icon={<Building />} label="Franchises" />
            <NavLink href="/admins" icon={<UserCog />} label="Admins" />
          </div>
        )}

        {(isFranchiseAdmin || isElectionAdmin) && (
          <div className="px-4 py-2">
            <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Manage
            </p>

            <NavGroup
              label="Elections"
              icon={<Vote />}
              open={electionsOpen}
              onToggle={() => setElectionsOpen((v) => !v)}
              active={isElectionSectionPath(location)}
            >
              <NavLink href="/elections" icon={<Vote />} label="All Elections" nested />
              <NavLink href="/reports" icon={<FileText />} label="Reports" nested />
            </NavGroup>

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
      </nav>
    </aside>
  );
}
