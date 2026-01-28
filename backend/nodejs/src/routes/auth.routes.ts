import { Router, Request, Response } from "express";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";
import { adminVerifyLimiter } from "../middleware/rateLimit";
import { supabase } from "../services/supabase";

const router = Router();

/**
 * GET /admin/auth/health
 * Health check endpoint - no auth required
 */
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", message: "Admin auth backend is running" });
});

/**
 * GET /admin/auth/debug
 * Debug endpoint - check if middleware is the issue
 */
router.get("/debug", requireAuth, requireAdmin, (_req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    message: "Auth middleware working",
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /admin/auth/verify
 * Verify admin credentials after OAuth
 * Frontend calls this after getting Supabase token
 */
router.post(
  "/verify",
  adminVerifyLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;

      // Log the login
      await supabase.logAdminLogin(
        adminProfile.id,
        adminProfile.email,
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
          is_active: adminProfile.is_active,
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
