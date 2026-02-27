import { Request, Response, NextFunction } from "express";
import { supabase } from "../services/supabase";

/**
 * MIDDLEWARE: Require 2FA Verification
 * STEP 2.4: Enforces 2FA for super_admin users
 * 
 * ⚠️ CRITICAL ENFORCEMENT POINT
 * 
 * Logic:
 * 1. Check user is authenticated (requireAuth must run first)
 * 2. Check user is super_admin (requireSuperAdmin must run first)
 * 3. If 2FA NOT enabled → Allow access (no 2FA requirement)
 * 4. If 2FA IS enabled → Check if verified in this session
 * 5. If verified → Allow access
 * 6. If NOT verified → Deny with 401 (frontend shows 2FA screen)
 * 
 * Usage in routes:
 * router.get('/dashboard', requireAuth, requireSuperAdmin, require2FA, handler)
 * 
 * ALWAYS runs AFTER requireAuth and requireSuperAdmin
 */
export async function require2FA(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Verify basic auth (should already be done by requireAuth)
    if (!req.user || !req.adminProfile) {
      console.log("[2FA] Missing user or admin profile in request");
      res.status(401).json({
        error: "Not authenticated",
        code: "NOT_AUTHENTICATED",
      });
      return;
    }

    // Check if user is super_admin (should already be done by requireSuperAdmin)
    if (req.adminProfile.role !== "super_admin") {
      // Non-super-admins bypass 2FA silently
      next();
      return;
    }

    // Get 2FA status from database
    const twoFAStatus = await supabase.get2FAStatus(req.adminProfile.id);

    // If 2FA is NOT enabled, allow access
    if (!twoFAStatus || !twoFAStatus.enabled) {
      console.log(
        `[2FA] 2FA not enabled for ${req.user.email}, allowing access`
      );
      next();
      return;
    }

    // 2FA IS enabled - check if verified in THIS SESSION
    const verified2FAAt = (req as any).verified2FAAt;

    if (!verified2FAAt) {
      // 2FA is enabled but not verified in this session
      console.log(
        `[2FA] 2FA verification required for admin: ${req.user.email}`
      );

      // Log the access denial
      await supabase.logAdminAction(
        req.adminProfile.id,
        "2FA_REQUIRED",
        "security",
        "failure",
        {
          reason: "2FA verification required but not provided",
          attempted_endpoint: req.originalUrl,
        },
        req.clientIp!,
        req.userAgent!
      );

      res.status(401).json({
        error: "2FA verification required",
        code: "2FA_REQUIRED",
      });
      return;
    }

    // 2FA is enabled AND verified - allow access
    console.log(`[2FA] 2FA verified for ${req.user.email}, allowing access`);
    next();
  } catch (error) {
    console.error("[2FA] Middleware error:", error);
    res.status(500).json({
      error: "2FA verification error",
      code: "2FA_ERROR",
    });
  }
}

/**
 * Helper function: Check if 2FA is required for access
 * Can be used in non-middleware contexts
 */
export async function is2FARequired(adminId: string): Promise<boolean> {
  try {
    const status = await supabase.get2FAStatus(adminId);
    return status?.enabled || false;
  } catch (error) {
    console.error("[2FA] Error checking requirement:", error);
    return false;
  }
}

/**
 * Helper function: Set verified 2FA in request
 * Called after successful /verify-login
 * Updates req.verified2FAAt so subsequent middleware allows access
 */
export function set2FAVerified(req: Request): void {
  (req as any).verified2FAAt = new Date();
  console.log("[2FA] Set verified2FAAt for user:", req.user?.email);
}
