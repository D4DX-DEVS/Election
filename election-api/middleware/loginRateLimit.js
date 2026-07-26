const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map();

function keyFor(req) {
  const username = String(req.body?.username || "").trim().toLowerCase();
  return `${req.ip || "unknown"}:${username || "missing"}`;
}

function loginRateLimit(req, res, next) {
  const now = Date.now();
  const key = keyFor(req);
  const current = attempts.get(key);
  const record =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + WINDOW_MS }
      : current;

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.max(Math.ceil((record.resetAt - now) / 1000), 1);
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      success: false,
      message: "Too many sign-in attempts. Please wait and try again.",
    });
  }

  record.count += 1;
  attempts.set(key, record);

  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) attempts.delete(key);
  });

  next();
}

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts.entries()) {
    if (record.resetAt <= now) attempts.delete(key);
  }
}, WINDOW_MS);
cleanup.unref();

module.exports = { loginRateLimit };
