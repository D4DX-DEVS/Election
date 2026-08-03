export const ROLE_RANK = {
  voter: 1,
  election_admin: 2,
  franchise_admin: 3,
  super_admin: 4,
} as const;

export type AppRole = keyof typeof ROLE_RANK;

export function roleRank(role?: string): number {
  if (!role) return 0;
  return ROLE_RANK[role as AppRole] || 0;
}

export function isHigherRole(actorRole?: string, targetRole?: string): boolean {
  return roleRank(actorRole) > roleRank(targetRole);
}

export function canAccessPath(role: string | undefined, path: string): boolean {
  if (!role || role === "voter") {
    // Voters have no profile page — only admins manage account details.
    return (
      path === "/voting" ||
      path.startsWith("/election/") ||
      path.startsWith("/results/") ||
      path === "/login" ||
      path === "/onboarding" ||
      path === "/settings"
    );
  }

  if (role === "super_admin") return true;

  // Franchise admins edit their own franchise from the Profile page instead.
  const superAdminOnly = ["/franchises", "/audit-logs", "/system-health"];
  if (superAdminOnly.some((p) => path === p || path.startsWith(`${p}/`))) {
    return false;
  }

  if (
    role === "election_admin" &&
    (path === "/admins" || path === "/elections/create")
  ) {
    return false;
  }

  const voterOnly = ["/voting"];
  if (voterOnly.some((p) => path === p)) return false;

  return true;
}
