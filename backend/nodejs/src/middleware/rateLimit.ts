import rateLimit from "express-rate-limit";
import { getClientIp } from "../utils/ip";
import { Request } from "express";

/**
 * SECURITY: Rate limiting configuration
 * Protects against brute force and DDoS attacks
 */

export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "500"), // increased from 100
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
 * Rate limit for admin JWT verification calls.
 * Development: unlimited (React HMR causes many rapid calls).
 * Production: 60 req/min — enough for normal usage, blocks credential-stuffing.
 */
export const adminVerifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: "Too many verification requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req: Request) => {
    // Skip rate limiting entirely in development
    return process.env.NODE_ENV === 'development';
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
