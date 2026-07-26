import type { AuthUser } from "@/lib/authUser";

const ACCOUNT_SCOPED_KEYS = [
  "authToken",
  "user",
  "userFullName",
  "needsOnboarding",
  "voteplus_read_notification_ids",
  "voteplus_preferences",
  "notificationsEndpointDisabledUntil",
] as const;

export function clearAccountSession() {
  ACCOUNT_SCOPED_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function storeAccountSession(token: string, user: AuthUser) {
  clearAccountSession();
  localStorage.setItem("authToken", token);
  localStorage.setItem("user", JSON.stringify(user));
  if (user.fullName) localStorage.setItem("userFullName", user.fullName);
}
