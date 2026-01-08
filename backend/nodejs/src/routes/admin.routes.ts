import { Router, Request, Response } from "express";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../middleware/requireAuth";
import { adminLimiter } from "../middleware/rateLimit";
import { supabase } from "../services/supabase";

const router = Router();

/**
 * CRITICAL: All admin routes require authentication AND admin role
 * Enforce role-based access in middleware AND database
 */

/**
 * GET /admin/analytics/summary
 * Get high-level platform statistics
 * Accessible to: any admin (analyst, moderator, super_admin)
 */
router.get(
  "/analytics/summary",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;

      // Log the action
      await supabase.logAdminAction(
        adminProfile.id,
        "READ_ANALYTICS_SUMMARY",
        "analytics",
        "success",
        {},
        req.clientIp!,
        req.userAgent!
      );

      const summary = await supabase.getAnalyticsSummary();

      res.json(summary);
    } catch (error) {
      console.error("[ADMIN] Analytics summary error:", error);

      // Log failure
      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          "READ_ANALYTICS_SUMMARY",
          "analytics",
          "failure",
          { error: String(error) },
          req.clientIp!,
          req.userAgent!
        );
      }

      res.status(500).json({
        error: "Failed to fetch analytics summary",
        code: "ANALYTICS_ERROR",
      });
    }
  }
);

/**
 * GET /admin/analytics/trends
 * Get trend data over time
 * Query params: days=30 (default)
 */
router.get(
  "/analytics/trends",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;
      const days = Math.min(parseInt(req.query.days as string) || 30, 365); // Max 1 year

      // Log the action
      await supabase.logAdminAction(
        adminProfile.id,
        "READ_ANALYTICS_TRENDS",
        "analytics",
        "success",
        { days },
        req.clientIp!,
        req.userAgent!
      );

      const trends = await supabase.getAnalyticsTrends(days);

      res.json(trends);
    } catch (error) {
      console.error("[ADMIN] Analytics trends error:", error);

      // Log failure
      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          "READ_ANALYTICS_TRENDS",
          "analytics",
          "failure",
          { error: String(error) },
          req.clientIp!,
          req.userAgent!
        );
      }

      res.status(500).json({
        error: "Failed to fetch analytics trends",
        code: "ANALYTICS_ERROR",
      });
    }
  }
);

/**
 * GET /admin/analytics/areas
 * Get geographic distribution of items
 */
router.get(
  "/analytics/areas",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;

      // Log the action
      await supabase.logAdminAction(
        adminProfile.id,
        "READ_ANALYTICS_AREAS",
        "analytics",
        "success",
        {},
        req.clientIp!,
        req.userAgent!
      );

      const areas = await supabase.getAnalyticsAreas();

      res.json(areas);
    } catch (error) {
      console.error("[ADMIN] Analytics areas error:", error);

      // Log failure
      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          "READ_ANALYTICS_AREAS",
          "analytics",
          "failure",
          { error: String(error) },
          req.clientIp!,
          req.userAgent!
        );
      }

      res.status(500).json({
        error: "Failed to fetch area analytics",
        code: "ANALYTICS_ERROR",
      });
    }
  }
);

/**
 * GET /admin/audit-logs
 * Get audit logs (super admin only)
 * Query params: limit=100, offset=0, admin_id=<filter>
 */
router.get(
  "/audit-logs",
  adminLimiter,
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      const offset = parseInt(req.query.offset as string) || 0;
      const filterAdminId = req.query.admin_id as string;

      // Log the action
      await supabase.logAdminAction(
        adminProfile.id,
        "READ_AUDIT_LOGS",
        "audit",
        "success",
        { limit, offset, filter: filterAdminId || "none" },
        req.clientIp!,
        req.userAgent!
      );

      let query = supabase
        .getServiceClient()
        .from("admin_audit_logs")
        .select("*", { count: "exact" });

      if (filterAdminId) {
        query = query.eq("admin_id", filterAdminId);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      res.json({
        logs: data || [],
        total: count || 0,
        limit,
        offset,
      });
    } catch (error) {
      console.error("[ADMIN] Audit logs fetch error:", error);

      // Log failure
      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          "READ_AUDIT_LOGS",
          "audit",
          "failure",
          { error: String(error) },
          req.clientIp!,
          req.userAgent!
        );
      }

      res.status(500).json({
        error: "Failed to fetch audit logs",
        code: "AUDIT_ERROR",
      });
    }
  }
);

/**
 * GET /admin/login-history
 * Get admin login history (super admin only)
 * Query params: limit=100, offset=0
 */
router.get(
  "/login-history",
  adminLimiter,
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      const offset = parseInt(req.query.offset as string) || 0;

      // Log the action
      await supabase.logAdminAction(
        adminProfile.id,
        "READ_LOGIN_HISTORY",
        "audit",
        "success",
        { limit, offset },
        req.clientIp!,
        req.userAgent!
      );

      const { data, count, error } = await supabase
        .getServiceClient()
        .from("admin_login_history")
        .select("*", { count: "exact" })
        .order("login_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      res.json({
        logins: data || [],
        total: count || 0,
        limit,
        offset,
      });
    } catch (error) {
      console.error("[ADMIN] Login history fetch error:", error);

      // Log failure
      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          "READ_LOGIN_HISTORY",
          "audit",
          "failure",
          { error: String(error) },
          req.clientIp!,
          req.userAgent!
        );
      }

      res.status(500).json({
        error: "Failed to fetch login history",
        code: "AUDIT_ERROR",
      });
    }
  }
);

export default router;
