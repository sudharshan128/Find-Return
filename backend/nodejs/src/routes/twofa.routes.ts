import { Router, Request, Response } from "express";
import { requireAuth, requireSuperAdmin } from "../middleware/requireAuth";
import { twoFALimiter } from "../middleware/rateLimit";
import { set2FAVerified } from "../middleware/require2fa";
import { supabase } from "../services/supabase";
import { twoFAService } from "../services/twofa.service";

const router = Router();

/**
 * CRITICAL 2FA RULES:
 * - ONLY super_admin users can enable 2FA
 * - Standard admins (moderator, analyst) do NOT use 2FA
 * - 2FA is optional for super_admin
 * - Enforced AFTER OAuth login
 */

/**
 * POST /admin/2fa/setup
 * Generate 2FA secret and QR code for super admin
 * Returns secret and QR code for scanning
 */
router.post(
  "/setup",
  twoFALimiter,
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;

      // Only allow if 2FA not already enabled
      if (adminProfile.twofa_enabled && adminProfile.twofa_verified_at) {
        res.status(400).json({
          error: "2FA already enabled for this account",
          code: "ALREADY_ENABLED",
        });
        return;
      }

      // Generate new secret
      const { secret, qrCodeUrl } = twoFAService.generateSecret(
        adminProfile.email
      );

      // Log the action
      await supabase.logAdminAction(
        adminProfile.id,
        "2FA_SETUP_INITIATED",
        "security",
        "success",
        { method: "totp" },
        req.clientIp!,
        req.userAgent!
      );

      res.json({
        secret,
        qrCodeUrl,
        message:
          "Scan this QR code with your authenticator app. You will need to verify before 2FA is enabled.",
      });
    } catch (error) {
      console.error("[2FA] Setup error:", error);

      // Log failure
      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          "2FA_SETUP_INITIATED",
          "security",
          "failure",
          { error: String(error) },
          req.clientIp!,
          req.userAgent!
        );
      }

      res.status(500).json({
        error: "Failed to generate 2FA secret",
        code: "2FA_SETUP_ERROR",
      });
    }
  }
);

/**
 * POST /admin/2fa/verify
 * Verify 2FA secret and enable 2FA
 * Body: { secret, token }
 * Token is the 6-digit code from authenticator app
 */
router.post(
  "/verify",
  twoFALimiter,
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;
      const { secret, token } = req.body;

      if (!secret || !token) {
        res.status(400).json({
          error: "Missing secret or token",
          code: "INVALID_REQUEST",
        });
        return;
      }

      // Verify the token
      const isValid = twoFAService.verifyToken(secret, token);
      if (!isValid) {
        console.log(`[2FA] Invalid token for admin: ${adminProfile.email}`);

        // Log failed verification
        await supabase.logAdminAction(
          adminProfile.id,
          "2FA_VERIFY_FAILED",
          "security",
          "failure",
          { reason: "Invalid token" },
          req.clientIp!,
          req.userAgent!
        );

        res.status(400).json({
          error: "Invalid verification code",
          code: "INVALID_TOKEN",
        });
        return;
      }

      // Update database to enable 2FA
      const success = await supabase.updateTwoFASettings(
        adminProfile.id,
        secret,
        true,
        new Date().toISOString()
      );

      if (!success) {
        throw new Error("Failed to save 2FA settings");
      }

      // Log successful verification
      await supabase.logAdminAction(
        adminProfile.id,
        "2FA_VERIFIED",
        "security",
        "success",
        { method: "totp" },
        req.clientIp!,
        req.userAgent!
      );

      res.json({
        success: true,
        message: "2FA has been successfully enabled",
      });
    } catch (error) {
      console.error("[2FA] Verification error:", error);

      // Log failure
      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          "2FA_VERIFY_FAILED",
          "security",
          "failure",
          { error: String(error) },
          req.clientIp!,
          req.userAgent!
        );
      }

      res.status(500).json({
        error: "Failed to verify 2FA",
        code: "2FA_VERIFY_ERROR",
      });
    }
  }
);

/**
 * POST /admin/2fa/check
 * Check if 2FA is required for login
 * Called by frontend to determine if user needs to enter 2FA code
 * Body: { adminId }
 */
router.post(
  "/check",
  twoFALimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = await supabase.getAdminProfile(req.user!.id);

      if (!adminProfile) {
        res.status(404).json({
          error: "Admin profile not found",
          code: "NOT_FOUND",
        });
        return;
      }

      const requiresTwoFA =
        adminProfile.role === "super_admin" &&
        adminProfile.twofa_enabled &&
        adminProfile.twofa_verified_at !== null;

      res.json({
        requiresTwoFA,
        role: adminProfile.role,
      });
    } catch (error) {
      console.error("[2FA] Check error:", error);
      res.status(500).json({
        error: "Failed to check 2FA status",
        code: "2FA_CHECK_ERROR",
      });
    }
  }
);

/**
 * POST /admin/2fa/verify-login
 * Verify 2FA code during login
 * Body: { token }
 * Should be called after OAuth, before dashboard access
 */
router.post(
  "/verify-login",
  twoFALimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = await supabase.getAdminProfile(req.user!.id);

      if (!adminProfile) {
        res.status(404).json({
          error: "Admin profile not found",
          code: "NOT_FOUND",
        });
        return;
      }

      // Check if 2FA is required
      if (!adminProfile.twofa_enabled || !adminProfile.twofa_verified_at) {
        res.json({
          success: true,
          message: "2FA not required for this account",
        });
        return;
      }

      const { token } = req.body;
      if (!token) {
        res.status(400).json({
          error: "Missing verification token",
          code: "INVALID_REQUEST",
        });
        return;
      }

      // Get the secret from database
      const secret = await supabase.getTwoFASecret(adminProfile.id);
      if (!secret) {
        console.log(`[2FA] Secret not found for admin: ${adminProfile.email}`);
        res.status(500).json({
          error: "2FA secret not found",
          code: "2FA_ERROR",
        });
        return;
      }

      // Verify the token
      const isValid = twoFAService.verifyToken(secret, token);
      if (!isValid) {
        console.log(
          `[2FA] Invalid login token for admin: ${adminProfile.email}`
        );

        // Log failed 2FA attempt
        await supabase.logAdminAction(
          adminProfile.id,
          "LOGIN_2FA_FAILED",
          "security",
          "failure",
          { reason: "Invalid 2FA code" },
          req.clientIp!,
          req.userAgent!
        );

        res.status(401).json({
          error: "Invalid verification code",
          code: "INVALID_TOKEN",
        });
        return;
      }

      // Log successful 2FA verification
      await supabase.logAdminAction(
        adminProfile.id,
        "LOGIN_2FA_SUCCESS",
        "security",
        "success",
        { method: "totp" },
        req.clientIp!,
        req.userAgent!
      );

      res.json({
        success: true,
        message: "2FA verification successful",
      });
    } catch (error) {
      console.error("[2FA] Login verification error:", error);

      // Log failure
      if (req.user) {
        const adminId = req.user.id;
        await supabase.logAdminAction(
          adminId,
          "LOGIN_2FA_FAILED",
          "security",
          "failure",
          { error: String(error) },
          req.clientIp!,
          req.userAgent!
        );
      }

      res.status(500).json({
        error: "Failed to verify 2FA code",
        code: "2FA_VERIFY_ERROR",
      });
    }
  }
);

/**
 * POST /admin/2fa/disable
 * Disable 2FA (super admin only)
 * Requires current password or email confirmation (for future enhancement)
 */
router.post(
  "/disable",
  twoFALimiter,
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;

      if (!adminProfile.twofa_enabled) {
        res.status(400).json({
          error: "2FA is not enabled for this account",
          code: "NOT_ENABLED",
        });
        return;
      }

      // Disable 2FA
      const success = await supabase.updateTwoFASettings(
        adminProfile.id,
        null, // Clear secret
        false, // Disable 2FA
        null // Clear verified at
      );

      if (!success) {
        throw new Error("Failed to disable 2FA");
      }

      // Log the action
      await supabase.logAdminAction(
        adminProfile.id,
        "2FA_DISABLED",
        "security",
        "success",
        {},
        req.clientIp!,
        req.userAgent!
      );

      res.json({
        success: true,
        message: "2FA has been disabled",
      });
    } catch (error) {
      console.error("[2FA] Disable error:", error);

      // Log failure
      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          "2FA_DISABLE_FAILED",
          "security",
          "failure",
          { error: String(error) },
          req.clientIp!,
          req.userAgent!
        );
      }

      res.status(500).json({
        error: "Failed to disable 2FA",
        code: "2FA_DISABLE_ERROR",
      });
    }
  }
);

/**
 * POST /admin/2fa/verify-login
 * Verify 2FA code during login flow
 * CRITICAL: Used when user has 2FA enabled
 * Body: { token: "123456" }
 * Returns: { success: true, message: "2FA verified" }
 * 
 * This endpoint:
 * - Does NOT require superAdmin middleware (user not fully authenticated yet)
 * - Uses rate limiting
 * - Checks lockout status
 * - Logs all attempts (success/failure)
 * - Returns specific error codes for frontend handling
 */
router.post(
  "/verify-login",
  twoFALimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      const userId = req.user!.id;

      if (!token || typeof token !== "string") {
        res.status(400).json({
          error: "Missing or invalid 2FA token",
          code: "INVALID_TOKEN",
        });
        return;
      }

      // Get admin profile
      const adminProfile = await supabase.getAdminProfile(userId);
      if (!adminProfile) {
        console.log("[2FA] Admin not found for login verification");
        res.status(401).json({
          error: "Admin not found",
          code: "NOT_FOUND",
        });
        return;
      }

      // Only super_admin users use 2FA
      if (adminProfile.role !== "super_admin") {
        console.log("[2FA] Non-super-admin attempted 2FA login");
        res.status(403).json({
          error: "2FA not required for this role",
          code: "FORBIDDEN",
        });
        return;
      }

      // Check if 2FA is enabled
      const twoFAStatus = await supabase.get2FAStatus(adminProfile.id);
      if (!twoFAStatus || !twoFAStatus.enabled) {
        console.log("[2FA] 2FA not enabled for admin");
        res.status(400).json({
          error: "2FA not enabled for this account",
          code: "2FA_NOT_ENABLED",
        });
        return;
      }

      // Get encrypted secret
      const encryptedSecret = await supabase.get2FASecret(adminProfile.id);
      if (!encryptedSecret) {
        console.log("[2FA] No 2FA secret found for admin");
        res.status(500).json({
          error: "2FA configuration error",
          code: "2FA_CONFIG_ERROR",
        });
        return;
      }

      // Verify token
      const isValid = twoFAService.verifyToken(encryptedSecret, token);

      if (!isValid) {
        console.log(`[2FA] Invalid token attempt for admin: ${adminProfile.email}`);

        // Record failed attempt (rate limiting)
        const attemptResult = await supabase.recordFailedAttempt(adminProfile.id);

        // Log failure
        await supabase.logAdminAction(
          adminProfile.id,
          "2FA_VERIFY_ATTEMPT",
          "security",
          "failure",
          {
            reason: "Invalid token",
            attempt: attemptResult.attempts,
          },
          req.clientIp!,
          req.userAgent!
        );

        if (attemptResult.locked) {
          console.warn(
            `[2FA] Admin locked out due to too many failed attempts: ${adminProfile.email}`
          );

          // Log lockout
          await supabase.logAdminAction(
            adminProfile.id,
            "2FA_LOCKOUT",
            "security",
            "failure",
            {
              reason: "Too many failed attempts",
              locked_until: attemptResult.lockUntil,
            },
            req.clientIp!,
            req.userAgent!
          );

          res.status(429).json({
            error: "Too many failed attempts. Please try again later.",
            code: "RATE_LIMITED",
            retryAfter: attemptResult.lockUntil
              ? Math.ceil(
                  (new Date(attemptResult.lockUntil).getTime() - Date.now()) /
                    1000
                )
              : 600,
          });
          return;
        }

        res.status(400).json({
          error: "Invalid 2FA code",
          code: "INVALID_CODE",
          attemptsRemaining: 3 - attemptResult.attempts,
        });
        return;
      }

      // Token is valid!
      console.log(`[2FA] Valid 2FA token verified for admin: ${adminProfile.email}`);

      // Reset attempts
      await supabase.reset2FAAttempts(adminProfile.id);

      // Set verified 2FA flag in request (used by require2FA middleware)
      set2FAVerified(req);

      // Log success
      await supabase.logAdminAction(
        adminProfile.id,
        "2FA_VERIFY_ATTEMPT",
        "security",
        "success",
        {},
        req.clientIp!,
        req.userAgent!
      );

      res.json({
        success: true,
        message: "2FA verification successful",
      });
    } catch (error) {
      console.error("[2FA] Verification error:", error);

      res.status(500).json({
        error: "2FA verification failed",
        code: "2FA_ERROR",
      });
    }
  }
);

export default router;
