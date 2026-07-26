export interface AuthUser {
  id?: string;
  _id?: string;
  username: string;
  role: string;
  email?: string;
  fullName?: string;
  franchiseId?: string;
  isVoter?: boolean;
  status?: string;
  lastLogin?: string | null;
  createdAt?: string;
  registrationNumber?: string;
  electionAccess?: string[];
  onboardingCompleted?: boolean;
}

export function formatRoleLabel(role?: string): string {
  if (!role) return "—";
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function getUserId(user?: AuthUser | null): string {
  return String(user?.id || user?._id || "");
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function syncAuthUserToStorage(user: AuthUser) {
  const stored = {
    id: getUserId(user),
    username: user.username,
    role: user.role,
    email: user.email,
    fullName: user.fullName,
    franchiseId: user.franchiseId,
    isVoter: user.isVoter,
    status: user.status,
    lastLogin: user.lastLogin,
    onboardingCompleted: user.onboardingCompleted,
  };
  localStorage.setItem("user", JSON.stringify(stored));
  if (user.fullName) {
    localStorage.setItem("userFullName", user.fullName);
  }
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
