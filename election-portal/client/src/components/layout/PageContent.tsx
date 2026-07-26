import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Root wrapper for page content — fills layout height so footer stays at the bottom on short pages. */
export function PageContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("app-page", className)}>{children}</div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("app-page-header", className)}>
      <div className="min-w-0">
        <h1 className="app-page-title">{title}</h1>
        {description ? (
          <p className="app-page-description">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="app-page-actions">{actions}</div> : null}
    </header>
  );
}

/** Pushes pagination or other bottom actions toward the site footer on short pages. */
export function PageBottom({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="flex-1 min-h-[2rem]" aria-hidden />
      {children}
    </>
  );
}
