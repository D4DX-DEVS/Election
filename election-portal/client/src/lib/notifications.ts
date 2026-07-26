export type NotificationPriority = "high" | "medium" | "low";

export type NotificationType =
  | "draft_election"
  | "voting_open"
  | "election_soon"
  | "election_overdue"
  | "results_published"
  | "missing_nominees"
  | "low_turnout"
  | "recent_activity"
  | "vote_reminder";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  href: string | null;
  priority: NotificationPriority;
  createdAt: string;
}

const READ_KEY = "voteplus_read_notification_ids";

export function loadReadNotificationIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function saveReadNotificationIds(ids: string[]) {
  localStorage.setItem(READ_KEY, JSON.stringify(Array.from(new Set(ids.map(String)))));
}

export function formatNotificationTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

export function notificationIconType(type: NotificationType): "alert" | "info" | "success" | "vote" {
  switch (type) {
    case "election_overdue":
    case "missing_nominees":
    case "low_turnout":
      return "alert";
    case "voting_open":
    case "vote_reminder":
      return "vote";
    case "results_published":
      return "success";
    default:
      return "info";
  }
}
