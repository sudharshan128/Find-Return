import { Request, Response, NextFunction } from "express";
import { supabase } from "../services/supabase";
import { getClientIp, getUserAgent } from "../utils/ip";

/**
 * CRITICAL SECURITY MIDDLEWARE
 * Verifies Supabase JWT token on EVERY request
 * Attaches authenticated user to req.user
 * MUST be called before any auth-required routes
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("[AUTH] Missing authorization header");
      res.status(401).json({
        error: "Missing authorization token",
        code: "MISSING_TOKEN",
      });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify token with Supabase
    const user = await supabase.verifyToken(token);
    if (!user) {
      console.log("[AUTH] Invalid or expired token");
      res.status(401).json({
        error: "Invalid or expired token",
        code: "INVALID_TOKEN",
      });
      return;
    }

    // Attach user to request
    req.user = user;
    req.clientIp = getClientIp(req);
    req.userAgent = getUserAgent(req);

    console.log(`[AUTH] Authenticated user: ${user.email}`);
    next();
  } catch (error) {
    console.error("[AUTH] Authentication error:", error);
    res.status(500).json({
      error: "Authentication error",
      code: "AUTH_ERROR",
    });
  }
}

/**
 * CRITICAL SECURITY MIDDLEWARE
 * Verifies user is an admin (any role)
 * MUST be called AFTER requireAuth
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      console.log("[AUTH] Missing user in request");
      res.status(401).json({
        error: "User not authenticated",
        code: "NOT_AUTHENTICATED",
      });
      return;
    }

    // Get admin profile from database
    const adminProfile = await supabase.getAdminProfile(req.user.id);
    if (!adminProfile) {
      console.log(`[AUTH] User is not an admin: ${req.user.email}`);
      res.status(403).json({
        error: "Access denied - admin role required",
        code: "FORBIDDEN",
      });
      return;
    }

    // Attach admin profile to request
    req.adminProfile = adminProfile;

    console.log(`[AUTH] Admin access granted: ${adminProfile.email} (${adminProfile.role})`);
    next();
  } catch (error) {
    console.error("[AUTH] Admin verification error:", error);
    res.status(500).json({
      error: "Admin verification error",
      code: "AUTH_ERROR",
    });
  }
}

/**
 * CRITICAL SECURITY MIDDLEWARE
 * Verifies user is a super admin
 * MUST be called AFTER requireAuth
 */
export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      console.log("[AUTH] Missing user in request");
      res.status(401).json({
        error: "User not authenticated",
        code: "NOT_AUTHENTICATED",
      });
      return;
    }

    // Get admin profile from database
    const adminProfile = await supabase.getAdminProfile(req.user.id);
    if (!adminProfile || adminProfile.role !== "super_admin") {
      console.log(
        `[AUTH] User does not have super_admin role: ${req.user.email}`
      );
      res.status(403).json({
        error: "Access denied - super admin role required",
        code: "FORBIDDEN",
      });
      return;
    }

    // Attach admin profile to request
    req.adminProfile = adminProfile;

    console.log(`[AUTH] Super admin access granted: ${adminProfile.email}`);
    next();
  } catch (error) {
    console.error("[AUTH] Super admin verification error:", error);
    res.status(500).json({
      error: "Admin verification error",
      code: "AUTH_ERROR",
    });
  }
}
