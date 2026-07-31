import type { Express } from "express";
import { createServer, type Server } from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import cookieParser from "cookie-parser";

const API_URL = process.env.VITE_API_URL || "http://localhost:8000";

/**
 * Maps portal /api/* routes to election-api /api/v1/* routes.
 * Maps portal /api/* routes to election-api /api/v1/* (Supabase-backed).
 *
 * NOTE: When app.use("/api/auth", ...) mounts a middleware, Express strips the
 * "/api/auth" prefix before the proxy sees the path. So pathRewrite must map
 * the remaining path (e.g. "/login") to the full backend path.
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // No body parsers: this is a streaming reverse proxy. Parsing bodies here
  // (especially multipart/form-data) breaks file uploads forwarded to the backend.
  app.use(cookieParser());
  console.log(`[portal] Proxying /api/* → ${API_URL}`);

  const makeProxy = (backendBasePath: string) =>
    createProxyMiddleware({
      target: API_URL,
      changeOrigin: true,
      timeout: 120_000,
      proxyTimeout: 120_000,
      // Express strips the mount prefix, so remaining path starts with "/"
      // e.g. mounted at /api/auth → proxy sees /login → rewrite to /api/v1/auth/login
      pathRewrite: (path) => `${backendBasePath}${path}`,
      on: {
        proxyRes: (proxyRes) => {
          // Prevent browser/proxy 304 responses that leave stale empty lists after mutations.
          delete proxyRes.headers["etag"];
          delete proxyRes.headers["last-modified"];
          proxyRes.headers["cache-control"] = "no-store, no-cache, must-revalidate";
          proxyRes.headers["pragma"] = "no-cache";
          proxyRes.headers["expires"] = "0";
        },
        error: (err: Error, _req: any, res: any) => {
          console.error("Proxy error:", err.message);
          res.status(502).json({ success: false, message: "Backend service unavailable" });
        },
      },
    });

  // Auth → /api/v1/auth
  app.use("/api/auth", makeProxy("/api/v1/auth"));

  // Franchises → /api/v1/franchise
  app.use("/api/franchises", makeProxy("/api/v1/franchise"));

  // Elections → /api/v1/election
  app.use("/api/elections", makeProxy("/api/v1/election"));

  // Election Groups → /api/v1/electionGroup
  app.use("/api/election-groups", makeProxy("/api/v1/electionGroup"));

  // Nominees → /api/v1/nominee
  app.use("/api/nominees", makeProxy("/api/v1/nominee"));

  // Vote → /api/v1/vote
  app.use("/api/vote", makeProxy("/api/v1/vote"));

  // Voter Groups → /api/v1/voterGroup
  app.use("/api/voter-groups", makeProxy("/api/v1/voterGroup"));

  // Analytics → /api/v1/electionAnalytics
  app.use("/api/analytics", makeProxy("/api/v1/electionAnalytics"));

  // Audit Logs → /api/v1/auditLog
  app.use("/api/audit-logs", makeProxy("/api/v1/auditLog"));

  // Users → /api/v1/user
  app.use("/api/users", makeProxy("/api/v1/user"));

  // Onboarding → /api/v1/onboarding
  app.use("/api/onboarding", makeProxy("/api/v1/onboarding"));

  // Notifications → /api/v1/notifications
  app.use("/api/notifications", makeProxy("/api/v1/notifications"));

  // System health → /api/v1/system
  app.use("/api/system", makeProxy("/api/v1/system"));

  // Uploaded images (franchise logos, election banners) served by the backend
  app.use("/uploads", makeProxy("/uploads"));

  const httpServer = createServer(app);
  return httpServer;
}

