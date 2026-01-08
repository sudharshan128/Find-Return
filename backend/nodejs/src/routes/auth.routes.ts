import { Router, Request, Response } from "express";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";
import { authLimiter } from "../middleware/rateLimit";
import { supabase } from "../services/supabase";

const router = Router();

/**
 * POST /admin/auth/verify
 * Verify admin credentials after OAuth
 * Frontend calls this after getting Supabase token
 */
router.post(
  "/verify",
  authLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;

      // Log the login
      await supabase.logAdminLogin(
        adminProfile.id,
        req.clientIp!,
        req.userAgent!
      );

      // Log the action
      await supabase.logAdminAction(
        adminProfile.id,
        "LOGIN",
        "admin_session",
        "success",
        { method: "oauth" },
        req.clientIp!,
        req.userAgent!
      );

      // Check if super admin and 2FA is enabled
      const requiresTwoFA = adminProfile.role === "super_admin" && adminProfile.twofa_enabled;

      res.json({
        success: true,
        admin: {
          id: adminProfile.id,
          email: adminProfile.email,
          role: adminProfile.role,
        },
        requiresTwoFA,
      });
    } catch (error) {
      console.error("[AUTH] Verify error:", error);
      res.status(500).json({
        error: "Verification failed",
        code: "VERIFY_ERROR",
      });
    }
  }
);

/**
 * GET /admin/auth/profile
 * Get current admin profile
 */
router.get(
  "/profile",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;

      res.json({
        id: adminProfile.id,
        email: adminProfile.email,
        role: adminProfile.role,
        isActive: adminProfile.is_active,
        twoFAEnabled: adminProfile.twofa_enabled && adminProfile.twofa_verified_at !== null,
      });
    } catch (error) {
      console.error("[AUTH] Profile fetch error:", error);
      res.status(500).json({
        error: "Failed to fetch profile",
        code: "PROFILE_ERROR",
      });
    }
  }
);

/**
 * POST /admin/auth/logout
 * Log admin logout (optional, for audit trail)
 */
router.post(
  "/logout",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;

      // Log logout action
      await supabase.logAdminAction(
        adminProfile.id,
        "LOGOUT",
        "admin_session",
        "success",
        {},
        req.clientIp!,
        req.userAgent!
      );

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("[AUTH] Logout error:", error);
      res.status(500).json({
        error: "Logout failed",
        code: "LOGOUT_ERROR",
      });
    }
  }
);

export default router;
