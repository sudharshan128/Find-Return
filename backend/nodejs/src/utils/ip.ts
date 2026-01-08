import { Request } from "express";

/**
 * Extract client IP address from request
 * Handles proxies and forwarded headers
 */
export function getClientIp(req: Request): string {
  // Check X-Forwarded-For (set by proxies like Render, Nginx, etc.)
  const xForwarded = req.headers["x-forwarded-for"];
  if (xForwarded) {
    // Can be comma-separated list
    const ips = Array.isArray(xForwarded)
      ? xForwarded[0]
      : xForwarded.split(",")[0];
    return ips.trim();
  }

  // Check X-Real-IP (Nginx)
  const xRealIp = req.headers["x-real-ip"];
  if (xRealIp) {
    return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
  }

  // Fallback to socket address
  return req.socket.remoteAddress || "unknown";
}

/**
 * Extract user agent
 */
export function getUserAgent(req: Request): string {
  return req.headers["user-agent"] || "unknown";
}

/**
 * Sanitize log data to prevent sensitive information leaks
 */
export function sanitizeLogData(data: any): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "key",
    "api_key",
    "access_token",
    "refresh_token",
    "twofa_secret",
  ];

  const sanitized = { ...data };
  Object.keys(sanitized).forEach((key) => {
    if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = "[REDACTED]";
    }
  });

  return sanitized;
}
