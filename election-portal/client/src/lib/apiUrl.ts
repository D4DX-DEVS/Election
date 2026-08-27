import { mapPortalPathToBackend, requireBackendApiUrl } from "@shared/apiProxy";

export function getBackendApiUrl(): string {
  return requireBackendApiUrl(import.meta.env.VITE_API_URL);
}

/** Resolve a portal `/api/...` or `/uploads/...` path to the backend origin from env. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getBackendApiUrl()}${mapPortalPathToBackend(normalized)}`;
}
