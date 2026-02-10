import { Request, Response, NextFunction } from "express";

/** Global error handler */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`[Error] ${err.message}`, err.stack);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: err.message,
  });
}

/** Simple rate limiter: per-IP, sliding window */
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(maxRequests = 300, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const entry = requestCounts.get(ip);

    if (!entry || now > entry.resetAt) {
      requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count++;
    if (entry.count > maxRequests) {
      res.status(429).json({
        success: false,
        error: "Rate limit exceeded. The hotel asks you to slow down.",
      });
      return;
    }

    next();
  };
}
