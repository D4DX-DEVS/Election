/** Portal path prefix → election-api path prefix (longest match wins). */
export const PORTAL_TO_BACKEND_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["/api/election-groups", "/api/v1/electionGroup"],
  ["/api/voter-groups", "/api/v1/voterGroup"],
  ["/api/franchises", "/api/v1/franchise"],
  ["/api/elections", "/api/v1/election"],
  ["/api/nominees", "/api/v1/nominee"],
  ["/api/analytics", "/api/v1/electionAnalytics"],
  ["/api/audit-logs", "/api/v1/auditLog"],
  ["/api/onboarding", "/api/v1/onboarding"],
  ["/api/notifications", "/api/v1/notifications"],
  ["/api/system", "/api/v1/system"],
  ["/api/users", "/api/v1/user"],
  ["/api/auth", "/api/v1/auth"],
  ["/api/vote", "/api/v1/vote"],
  ["/uploads", "/uploads"],
];

export function mapPortalPathToBackend(pathAndQuery: string): string {
  const qIndex = pathAndQuery.indexOf("?");
  const pathname = qIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, qIndex);
  const search = qIndex === -1 ? "" : pathAndQuery.slice(qIndex);

  for (const [from, to] of PORTAL_TO_BACKEND_PREFIXES) {
    if (pathname === from || pathname.startsWith(`${from}/`)) {
      return `${to}${pathname.slice(from.length)}${search}`;
    }
  }

  return pathAndQuery;
}

export function requireBackendApiUrl(raw: string | undefined): string {
  const url = (raw || "").trim().replace(/\/$/, "");
  if (!url) {
    throw new Error(
      "VITE_API_URL is required. Set it in election-portal/.env (e.g. http://localhost:5000)."
    );
  }
  return url;
}
