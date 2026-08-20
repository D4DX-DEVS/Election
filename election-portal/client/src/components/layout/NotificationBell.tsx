import { Bell, CheckCheck, AlertTriangle, Info, Vote, CheckCircle2, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import {
  AppNotification,
  formatNotificationTime,
  notificationIconType,
} from "@/lib/notifications";

function NotificationIcon({ type }: { type: AppNotification["type"] }) {
  const iconType = notificationIconType(type);
  const className = "h-4 w-4 shrink-0";

  if (iconType === "alert") return <AlertTriangle className={cn(className, "text-amber-600")} />;
  if (iconType === "vote") return <Vote className={cn(className, "text-primary")} />;
  if (iconType === "success") return <CheckCircle2 className={cn(className, "text-green-600")} />;
  return <Info className={cn(className, "text-blue-600")} />;
}

function priorityDot(priority: AppNotification["priority"]) {
  if (priority === "high") return "bg-red-500";
  if (priority === "medium") return "bg-amber-500";
  return "bg-slate-300";
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const {
    notifications,
    unreadCount,
    isLoading,
    isError,
    isFetching,
    refetch,
    markAsRead,
    markAllAsRead,
    isRead,
  } = useNotifications();

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) refetch();
  };

  const handleClick = (notification: AppNotification) => {
    markAsRead(notification.id);
    setOpen(false);
    if (notification.href) {
      setLocation(notification.href);
    }
  };

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        buttonRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        className="relative"
        title="Notifications"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={handleToggle}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open &&
        createPortal(
          <>
            {/* Transparent backdrop — closes panel on outside click */}
            <div
              className="fixed inset-0 z-40"
              aria-hidden
              onClick={() => setOpen(false)}
            />

            {/*
             * Panel rendered in document.body via Portal so no transformed
             * ancestor interferes with `position: fixed` centering.
             * `left: 50% + translateX(-50%)` centres within the true viewport.
             * `top` clears the fixed header (3.5 rem) + safe-area inset + gap.
             */}
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Notifications"
              className={cn(
                "fixed z-50 left-1/2 -translate-x-1/2",
                "rounded-xl border bg-popover text-popover-foreground shadow-lg outline-none",
                "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200",
              )}
              style={{
                top: "calc(3.5rem + env(safe-area-inset-top, 0px) + 0.5rem)",
                width: "min(calc(100vw - 2rem), 24rem)",
              }}
            >
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <p className="app-section-title">Notifications</p>
                  <p className="app-muted">
                    {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={markAllAsRead}
                  >
                    <CheckCheck className="h-3.5 w-3.5 mr-1" />
                    Mark all read
                  </Button>
                )}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : isError ? (
                <div className="px-4 py-8 text-center">
                  <p className="app-muted mb-3">Could not load notifications.</p>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    Retry
                  </Button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="app-detail-value">No notifications</p>
                  <p className="app-muted mt-1 mx-auto max-w-[220px]">
                    Election updates and alerts will appear here.
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[360px]">
                  <div className="divide-y divide-gray-100">
                    {notifications.map((notification) => {
                      const read = isRead(notification.id);
                      return (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => handleClick(notification)}
                          className={cn(
                            "w-full px-4 py-3 flex items-start gap-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                            !read && "bg-primary/5 hover:bg-primary/10",
                          )}
                        >
                          <span className="mt-0.5 shrink-0">
                            <NotificationIcon type={notification.type} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate text-sm text-gray-800",
                                !read ? "font-semibold" : "font-medium",
                              )}
                            >
                              {notification.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-gray-500">
                              {notification.message}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground/70">
                            {formatNotificationTime(notification.createdAt)}
                          </span>
                          {!read && (
                            <span
                              className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", priorityDot(notification.priority))}
                              aria-hidden
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              {isFetching && !isLoading && (
                <div className="app-helper flex items-center gap-1 border-t px-4 py-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Refreshing…
                </div>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
