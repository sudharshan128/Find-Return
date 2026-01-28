import rateLimit from "express-rate-limit";
import { getClientIp } from "../utils/ip";
import { Request } from "express";

/**
 * SECURITY: Rate limiting configuration
 * Protects against brute force and DDoS attacks
 */

export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
  message:
    "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Don't rate limit health checks
    return req.path === "/health";
  },
  keyGenerator: (req: Request) => {
    // Use client IP instead of socket IP
    return getClientIp(req);
  },
});

/**
 * Stricter rate limit for admin operations
 * Increased for development - React dev mode causes many rapid calls
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window (was 15 minutes)
  max: 200, // 200 requests per minute (was 25 per 15 min)
  message: "Too many admin requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return getClientIp(req);
  },
});

/**
 * Very lenient rate limit for authenticated admin verification
 * This is called multiple times during auth initialization
 * Authenticated users are already protected from abuse
 */
export const adminVerifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // Allow 1000 requests per minute (React dev mode causes excessive rapid calls)
  message: "Too many verification requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting entirely in development
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    // Don't rate limit if no auth header (will fail auth check anyway)
    return !req.headers.authorization;
  },
  keyGenerator: (req: Request) => {
    return getClientIp(req);
  },
});

/**
 * Very strict rate limit for auth attempts
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 attempts
  message: "Too many login attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return getClientIp(req);
  },
});

/**
 * Rate limit for 2FA verification
 */
export const twoFALimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 attempts per 5 minutes
  message: "Too many 2FA attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return getClientIp(req);
  },
});
