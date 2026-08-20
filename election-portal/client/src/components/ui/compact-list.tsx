import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * App-wide standard for record collections.
 *
 * Each row renders as a standalone mini-card (white, subtle border, soft shadow)
 * so the list feels like a premium SaaS dashboard rather than a plain table.
 *
 * Pattern: [Leading] [Primary] [Secondary] [Status] [Actions]
 */
export function CompactList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>{children}</div>
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
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function CompactListRow({
  children,
  onClick,
  className,
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  /** Accessible name when the row opens a record. */
  label?: string;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? label : undefined}
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm transition-all duration-150",
        onClick
          ? "cursor-pointer hover:border-primary/20 hover:shadow-md active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          : undefined,
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
export function CompactListLeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("shrink-0", className)}>{children}</div>;
}

/** Primary label — stays visible; truncates instead of wrapping. */
export function CompactListPrimary({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "min-w-0 max-w-[48%] shrink truncate text-sm font-semibold text-gray-800 sm:max-w-[40%] lg:max-w-xs",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Secondary/muted info — fills leftover width and ellipsizes. */
export function CompactListSecondary({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
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
        "inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
        active ? "text-green-700" : "text-gray-500"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-green-500" : "bg-gray-400"
        )}
      />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

/** Trailing compact actions — stops event propagation so row click isn't triggered. */
export function CompactListActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex shrink-0 items-center gap-0.5", className)}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
