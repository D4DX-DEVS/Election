import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AppNotification,
  loadReadNotificationIds,
  saveReadNotificationIds,
} from "@/lib/notifications";
import { apiUrl } from "@/lib/apiUrl";

const NOTIFICATIONS_DISABLED_UNTIL_KEY = "notificationsEndpointDisabledUntil";
const NOTIFICATIONS_RECHECK_MS = 1000 * 60 * 60 * 6; // 6 hours

function getEndpointDisabledUntil(): number {
  const raw = localStorage.getItem(NOTIFICATIONS_DISABLED_UNTIL_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function isEndpointTemporarilyDisabled(): boolean {
  return Date.now() < getEndpointDisabledUntil();
}

function disableEndpointTemporarily() {
  localStorage.setItem(
    NOTIFICATIONS_DISABLED_UNTIL_KEY,
    String(Date.now() + NOTIFICATIONS_RECHECK_MS)
  );
}

function clearEndpointDisableFlag() {
  localStorage.removeItem(NOTIFICATIONS_DISABLED_UNTIL_KEY);
}

type NotificationFetchResult = {
  notifications: AppNotification[];
  endpointUnavailable: boolean;
};

async function fetchNotifications(): Promise<NotificationFetchResult> {
  const res = await fetch(apiUrl("/api/notifications"), {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
    },
    credentials: "include",
  });
  // Older deployed APIs may not expose this route yet — treat as empty, not an error.
  if (res.status === 404) {
    return {
      notifications: [],
      endpointUnavailable: true,
    };
  }
  if (!res.ok) {
    throw new Error(`${res.status}: Failed to load notifications`);
  }
  const body = await res.json();
  return {
    notifications: body.data ?? [],
    endpointUnavailable: false,
  };
}

export function useNotifications() {
  const [readIds, setReadIds] = useState<string[]>(() => loadReadNotificationIds());
  const [notificationsEndpointAvailable, setNotificationsEndpointAvailable] = useState(
    () => !isEndpointTemporarilyDisabled()
  );

  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("authToken");

  const { data, isLoading, isError, refetch, isFetching } = useQuery<NotificationFetchResult>({
    queryKey: ["/api/notifications"],
    queryFn: fetchNotifications,
    refetchInterval: notificationsEndpointAvailable && hasToken ? 60_000 : false,
    staleTime: 30_000,
    enabled: notificationsEndpointAvailable && hasToken,
    retry: (failureCount, error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("401:")) return false;
      return failureCount < 1;
    },
  });

  useEffect(() => {
    if (data) {
      if (data.endpointUnavailable) {
        disableEndpointTemporarily();
        setNotificationsEndpointAvailable(false);
      } else {
        clearEndpointDisableFlag();
        setNotificationsEndpointAvailable(true);
      }
    }
  }, [data]);

  const notifications = data?.notifications ?? [];

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !readIds.includes(n.id)),
    [notifications, readIds]
  );

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveReadNotificationIds(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    const allIds = notifications.map((n) => n.id);
    setReadIds(allIds);
    saveReadNotificationIds(allIds);
  }, [notifications]);

  const isRead = useCallback((id: string) => readIds.includes(id), [readIds]);

  return {
    notifications,
    unreadNotifications,
    unreadCount: unreadNotifications.length,
    isLoading,
    isError,
    isFetching,
    refetch,
    markAsRead,
    markAllAsRead,
    isRead,
  };
}
