import { Bell, CheckCheck, AlertTriangle, Info, Vote, CheckCircle2, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

  const handleOpenChange = (open: boolean) => {
    if (open) refetch();
  };

  const handleClick = (notification: AppNotification) => {
    markAsRead(notification.id);
    if (notification.href) {
      setLocation(notification.href);
    }
  };

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title="Notifications"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[calc(100vw-1rem)] max-w-96 p-0">
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
      </PopoverContent>
    </Popover>
  );
}
