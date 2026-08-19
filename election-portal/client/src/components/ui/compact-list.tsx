import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * App-wide standard for normal record collections.
 *
 * NEW RECORD LIST → CompactList (not stacked cards, not a separate desktop table).
 * Use for franchises, admins, elections, voters, groups, nominees, results rows,
 * notifications, recent-record sections, and any future management list
 * (departments, users, reports, categories, etc.).
 *
 * Do not use for dashboard metric cards, charts, forms, detail pages,
 * voting/ballot controls, or multi-step workflows.
 *
 * Row pattern: [Leading] [Primary] [Secondary] [Status] [Actions]
 */
export function CompactList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-gray-200 bg-white divide-y divide-gray-100",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CompactListToolbar({
  children,
  actions,
  className,
}: {
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center gap-2", className)}>
      {children ? <div className="min-w-0 flex-1">{children}</div> : null}
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CompactListRow({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "flex min-h-11 items-center gap-2 px-3 py-2 hover:bg-primary/5",
        onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        className
      )}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

/** Avatar, checkbox, or other leading slot. */
export function CompactListLeading({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("shrink-0", className)}>{children}</div>;
}

/** Primary label — stays visible; truncates instead of wrapping. */
export function CompactListPrimary({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("min-w-0 max-w-[48%] shrink truncate text-sm font-medium text-gray-900 sm:max-w-[40%] lg:max-w-xs", className)}>
      {children}
    </span>
  );
}

/** Secondary/muted info — fills leftover width and ellipsizes. */
export function CompactListSecondary({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("min-w-0 flex-1 truncate text-xs text-gray-500", className)}>
      {children}
    </span>
  );
}

/** Standard dot + label status (Active/Inactive and similar binary states). */
export function CompactListStatus({
  active,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-xs font-medium",
        active ? "text-green-700" : "text-gray-500"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-green-500" : "bg-gray-400")} />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

/** Trailing compact actions (icon buttons or `...` menu). */
export function CompactListActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)} onClick={(event) => event.stopPropagation()}>
      {children}
    </div>
  );
}
