import { ReactNode } from "react";
import { BallotIllustrationMuted } from "@/components/illustrations/BallotIllustration";
import { cn } from "@/lib/utils";

/** Themed empty-list placeholder — reused across every table/list page. */
export function EmptyState({
  title,
  description,
  className,
  action,
}: {
  title: string;
  description?: string;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)}>
      <BallotIllustrationMuted className="h-24 w-24" />
      <p className="app-body font-medium text-gray-700">{title}</p>
      {description && <p className="app-muted max-w-xs">{description}</p>}
      {action}
    </div>
  );
}
