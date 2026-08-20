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
    <div className={cn("flex flex-col gap-1", className)}>{children}</div>
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
    <div className={cn("mb-2 flex items-center gap-2", className)}>
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
        "flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-sm transition-all duration-150",
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

/**
 * Status indicator for list rows.
 * Active → small green dot only (no text).
 * Inactive → gray dot + "Inactive" label.
 */
export function CompactListStatus({
  active,
  inactiveLabel = "Inactive",
}: {
  active: boolean;
  /** Label shown when inactive. Defaults to "Inactive". */
  inactiveLabel?: string;
}) {
  if (active) {
    return (
      <span
        className="inline-flex h-2 w-2 shrink-0 rounded-full bg-green-500"
        aria-label="Active"
        title="Active"
      />
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      {inactiveLabel}
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
      className={cn("flex shrink-0 items-center gap-0", className)}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
