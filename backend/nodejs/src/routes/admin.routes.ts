import { Router, Request, Response } from "express";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../middleware/requireAuth";
import { require2FA } from "../middleware/require2fa";
import { adminLimiter } from "../middleware/rateLimit";
import { supabase } from "../services/supabase";
import { clearSettingsCache } from "../middleware/settings.middleware";

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
 * GET /admin/analytics/categories
 * Get category-wise statistics
 */
router.get(
  "/analytics/categories",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;

      // Log the action
      await supabase.logAdminAction(
        adminProfile.id,
        "READ_ANALYTICS_CATEGORIES",
        "analytics",
        "success",
        {},
        req.clientIp!,
        req.userAgent!
      );

      const categories = await supabase.getAnalyticsCategories();

      res.json(categories);
    } catch (error) {
      console.error("[ADMIN] Analytics categories error:", error);

      // Log failure
      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          "READ_ANALYTICS_CATEGORIES",
          "analytics",
          "failure",
          { error: String(error) },
          req.clientIp!,
          req.userAgent!
        );
      }

      res.status(500).json({
        error: "Failed to fetch category analytics",
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
  require2FA,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      const offset = parseInt(req.query.offset as string) || 0;
      const filterAdminId = req.query.admin_id as string;
      const filterAction = req.query.action as string;
      const filterSearch = req.query.search as string;
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;
      const importantOnly = req.query.important_only === 'true';

      // Log the action
      await supabase.logAdminAction(
        adminProfile.id,
        "READ_AUDIT_LOGS",
        "audit",
        "success",
        { limit, offset, filters: { admin: filterAdminId, action: filterAction, search: filterSearch, importantOnly } },
        req.clientIp!,
        req.userAgent!,
        undefined,
        adminProfile.email
      );

      let query = supabase
        .getServiceClient()
        .from("admin_audit_logs")
        .select("*", { count: "exact" });

      // Apply filters
      if (filterAdminId) {
        query = query.eq("admin_id", filterAdminId);
      }
      if (filterAction) {
        query = query.ilike("action", `%${filterAction}%`);
      }
      if (filterSearch) {
        query = query.or(`action.ilike.%${filterSearch}%,resource_type.ilike.%${filterSearch}%,reason.ilike.%${filterSearch}%`);
      }
      if (dateFrom) {
        query = query.gte("created_at", dateFrom);
      }
      if (dateTo) {
        query = query.lte("created_at", dateTo);
      }
      
      // Filter out verbose actions if importantOnly is enabled
      if (importantOnly) {
        query = query.not("action", "in", "(READ_SETTINGS,READ_AUDIT_LOGS,VIEW_PROFILE,READ_DASHBOARD)");
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
 * GET /admin/audit-logs/export
 * Export audit logs (super admin only)
 * Query params: action, admin_id, dateFrom, dateTo
 */
router.get(
  "/audit-logs/export",
  adminLimiter,
  requireAuth,
  requireSuperAdmin,
  require2FA,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;
      const filterAction = req.query.action as string;
      const filterAdminId = req.query.adminId as string;
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;

      // Log the export action
      await supabase.logAdminAction(
        adminProfile.id,
        "EXPORT_AUDIT_LOGS",
        "audit",
        "success",
        { action: filterAction, adminId: filterAdminId, dateFrom, dateTo },
        req.clientIp!,
        req.userAgent!,
        undefined,
        adminProfile.email
      );

      let query = supabase
        .getServiceClient()
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (filterAction) {
        query = query.eq("action", filterAction);
      }

      if (filterAdminId) {
        query = query.eq("admin_id", filterAdminId);
      }

      if (dateFrom) {
        // Convert date to start of day timestamp
        const fromDate = dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00.000Z`;
        query = query.gte("created_at", fromDate);
      }

      if (dateTo) {
        // Convert date to end of day timestamp
        const toDate = dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`;
        query = query.lte("created_at", toDate);
      }

      const { data, error } = await query.limit(10000); // Max 10k records for export

      if (error) throw error;

      // Return empty array if no logs, don't return 404
      return res.json({
        logs: data || [],
        exportedAt: new Date().toISOString(),
        exportedBy: adminProfile.email,
        filters: { action: filterAction, adminId: filterAdminId, dateFrom, dateTo },
        totalRecords: (data || []).length,
      });
    } catch (error) {
      console.error("[ADMIN] Audit logs export error:", error);

      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          "EXPORT_AUDIT_LOGS",
          "audit",
          "failure",
          { error: String(error) },
          req.clientIp!,
          req.userAgent!,
          undefined,
          req.adminProfile.email
        );
      }

      return res.status(500).json({
        error: "Failed to export audit logs",
        code: "EXPORT_ERROR",
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

// ============================================================
// ITEMS ENDPOINTS
// ============================================================

/**
 * GET /admin/items
 * Get all items with filters and pagination
 */
router.get(
  "/items",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const search = (req.query.search as string) || '';
      const status = (req.query.status as string) || undefined;
      const flagged = req.query.flagged === 'true';
      const hidden = req.query.hidden === 'true';

      let query = supabase
        .getServiceClient()
        .from('items')
        .select('*, categories(name, icon), areas(name, zone), user_profiles!finder_id(email, full_name, trust_score), item_images(id, storage_path, image_url, is_primary, sort_order)', { count: 'exact' });

      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (flagged) {
        query = query.eq('is_flagged', true);
      }
      if (hidden) {
        query = query.eq('is_hidden', true);
      }

      const from = (page - 1) * limit;
      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, from + limit - 1);

      if (error) throw error;

      await supabase.logAdminAction(
        adminProfile.id,
        'READ_ITEMS',
        'items',
        'success',
        { search, status, flagged, hidden, page, limit },
        req.clientIp!,
        req.userAgent!
      );

      res.json({
        data: data || [],
        total: count || 0,
        page,
        limit,
      });
    } catch (error) {
      console.error('[ADMIN] Items fetch error:', error);
      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          'READ_ITEMS',
          'items',
          'failure',
          { error: String(error) },
          req.clientIp!,
          req.userAgent!
        );
      }
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  }
);

/**
 * GET /admin/items/:itemId
 * Get single item with full details
 */
router.get(
  "/items/:itemId",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;

      const { data, error } = await supabase
        .getServiceClient()
        .from('items')
        .select(`
          *,
          categories(name, icon),
          areas(name, zone),
          user_profiles!finder_id(user_id, email, full_name, trust_score),
          item_images(*)
        `)
        .eq('id', itemId)
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('[ADMIN] Item fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch item' });
    }
  }
);

/**
 * POST /admin/items/:itemId/hide
 * Hide item from public view
 */
router.post(
  "/items/:itemId/hide",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { reason } = req.body;
      const adminProfile = req.adminProfile!;

      const { error: updateError } = await supabase
        .getServiceClient()
        .from('items')
        .update({
          is_hidden: true,
          hidden_at: new Date().toISOString(),
          hidden_by: adminProfile.id,
          hide_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) throw updateError;

      // Log moderation action
      await supabase
        .getServiceClient()
        .from('item_moderation_log')
        .insert({
          item_id: itemId,
          admin_id: adminProfile.id,
          action: 'hide',
          reason: reason || null,
        });

      await supabase.logAdminAction(
        adminProfile.id,
        'HIDE_ITEM',
        'items',
        'success',
        { itemId, reason },
        req.clientIp!,
        req.userAgent!
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Hide item error:', error);
      res.status(500).json({ error: 'Failed to hide item' });
    }
  }
);

/**
 * POST /admin/items/:itemId/unhide
 * Unhide item
 */
router.post(
  "/items/:itemId/unhide",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { reason } = req.body;
      const adminProfile = req.adminProfile!;

      const { error: updateError } = await supabase
        .getServiceClient()
        .from('items')
        .update({
          is_hidden: false,
          hidden_at: null,
          hidden_by: null,
          hide_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) throw updateError;

      // Log moderation action
      await supabase
        .getServiceClient()
        .from('item_moderation_log')
        .insert({
          item_id: itemId,
          admin_id: adminProfile.id,
          action: 'unhide',
          reason: reason || null,
        });

      await supabase.logAdminAction(
        adminProfile.id,
        'UNHIDE_ITEM',
        'items',
        'success',
        { itemId, reason },
        req.clientIp!,
        req.userAgent!,
        itemId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Unhide item error:', error);
      res.status(500).json({ error: 'Failed to unhide item' });
    }
  }
);

/**
 * POST /admin/items/:itemId/soft-delete
 * Soft delete item (marks as deleted but keeps record)
 */
router.post(
  "/items/:itemId/soft-delete",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { reason } = req.body;
      const adminProfile = req.adminProfile!;

      const { error: updateError } = await supabase
        .getServiceClient()
        .from('items')
        .update({
          is_soft_deleted: true,
          soft_deleted_at: new Date().toISOString(),
          soft_deleted_by: adminProfile.id,
          soft_delete_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) throw updateError;

      // Log moderation action
      await supabase
        .getServiceClient()
        .from('item_moderation_log')
        .insert({
          item_id: itemId,
          admin_id: adminProfile.id,
          action: 'soft_delete',
          reason: reason || null,
        });

      await supabase.logAdminAction(
        adminProfile.id,
        'SOFT_DELETE_ITEM',
        'items',
        'success',
        { itemId, reason },
        req.clientIp!,
        req.userAgent!,
        itemId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Soft delete item error:', error);
      res.status(500).json({ error: 'Failed to soft delete item' });
    }
  }
);

/**
 * POST /admin/items/:itemId/restore
 * Restore soft deleted item
 */
router.post(
  "/items/:itemId/restore",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { reason } = req.body;
      const adminProfile = req.adminProfile!;

      const { error: updateError } = await supabase
        .getServiceClient()
        .from('items')
        .update({
          is_soft_deleted: false,
          soft_deleted_at: null,
          soft_deleted_by: null,
          soft_delete_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) throw updateError;

      // Log moderation action
      await supabase
        .getServiceClient()
        .from('item_moderation_log')
        .insert({
          item_id: itemId,
          admin_id: adminProfile.id,
          action: 'restore',
          reason: reason || null,
        });

      await supabase.logAdminAction(
        adminProfile.id,
        'RESTORE_ITEM',
        'items',
        'success',
        { itemId, reason },
        req.clientIp!,
        req.userAgent!,
        itemId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Restore item error:', error);
      res.status(500).json({ error: 'Failed to restore item' });
    }
  }
);

/**
 * POST /admin/items/:itemId/hard-delete
 * Hard delete item (super admin only, permanent deletion)
 */
router.post(
  "/items/:itemId/hard-delete",
  adminLimiter,
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { reason } = req.body;
      const adminProfile = req.adminProfile!;

      // Log before deletion
      await supabase
        .getServiceClient()
        .from('item_moderation_log')
        .insert({
          item_id: itemId,
          admin_id: adminProfile.id,
          action: 'hard_delete',
          reason: reason || null,
        });

      await supabase.logAdminAction(
        adminProfile.id,
        'HARD_DELETE_ITEM',
        'items',
        'success',
        { itemId, reason },
        req.clientIp!,
        req.userAgent!,
        itemId,
        adminProfile.email
      );

      const { error } = await supabase
        .getServiceClient()
        .from('items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Hard delete item error:', error);
      res.status(500).json({ error: 'Failed to hard delete item' });
    }
  }
);

/**
 * POST /admin/items/:itemId/flag
 * Flag item as suspicious
 */
router.post(
  "/items/:itemId/flag",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { reason } = req.body;
      const adminProfile = req.adminProfile!;

      const { error: updateError } = await supabase
        .getServiceClient()
        .from('items')
        .update({
          is_flagged: true,
          flag_reason: reason,
          flagged_by: adminProfile.id,
          flagged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) throw updateError;

      await supabase.logAdminAction(
        adminProfile.id,
        'FLAG_ITEM',
        'items',
        'success',
        { itemId, reason },
        req.clientIp!,
        req.userAgent!,
        itemId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Flag item error:', error);
      res.status(500).json({ error: 'Failed to flag item' });
    }
  }
);

/**
 * POST /admin/items/:itemId/clear-flag
 * Clear flag on item
 */
router.post(
  "/items/:itemId/clear-flag",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { reason } = req.body;
      const adminProfile = req.adminProfile!;

      const { error: updateError } = await supabase
        .getServiceClient()
        .from('items')
        .update({
          is_flagged: false,
          flag_reason: null,
          flagged_by: null,
          flagged_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) throw updateError;

      // Log moderation action
      await supabase
        .getServiceClient()
        .from('item_moderation_log')
        .insert({
          item_id: itemId,
          admin_id: adminProfile.id,
          action: 'flag_review',
          reason: `Flag cleared: ${reason || 'No reason provided'}`,
        });

      await supabase.logAdminAction(
        adminProfile.id,
        'CLEAR_FLAG_ITEM',
        'items',
        'success',
        { itemId, reason },
        req.clientIp!,
        req.userAgent!,
        itemId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Clear flag error:', error);
      res.status(500).json({ error: 'Failed to clear flag' });
    }
  }
);

/**
 * POST /admin/items/:itemId/mark-returned
 * Admin confirms item has been returned to owner
 */
router.post(
  "/items/:itemId/mark-returned",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { reason } = req.body;
      const adminProfile = req.adminProfile!;

      // Get item details first to get finder and claimant info
      const { data: item, error: itemError } = await supabase
        .getServiceClient()
        .from('items')
        .select('id, title, finder_id, status')
        .eq('id', itemId)
        .single();

      if (itemError || !item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      if (item.status !== 'claimed') {
        return res.status(400).json({ error: 'Item must be in claimed status to mark as returned' });
      }

      // Get the approved claim to find claimant
      const { data: claim } = await supabase
        .getServiceClient()
        .from('claims')
        .select('id, claimant_id')
        .eq('item_id', itemId)
        .eq('status', 'approved')
        .single();

      // Update item status to returned
      const { error: updateError } = await supabase
        .getServiceClient()
        .from('items')
        .update({
          status: 'returned',
          returned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) throw updateError;

      // Update claim status to completed if exists
      if (claim) {
        await supabase
          .getServiceClient()
          .from('claims')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', claim.id);

        // Close the chat
        await supabase
          .getServiceClient()
          .from('chats')
          .update({
            is_closed: true,
            closed_at: new Date().toISOString(),
            close_reason: 'Item returned - confirmed by admin',
          })
          .eq('item_id', itemId)
          .eq('claim_id', claim.id);

        // Increase trust scores for both finder and claimant
        // Finder gets +5 for successful return
        await supabase
          .getServiceClient()
          .rpc('increment_trust_score', { user_id: item.finder_id, amount: 5 });

        // Claimant gets +3 for successful claim
        if (claim.claimant_id) {
          await supabase
            .getServiceClient()
            .rpc('increment_trust_score', { user_id: claim.claimant_id, amount: 3 });
        }
      }

      // Log moderation action
      await supabase
        .getServiceClient()
        .from('item_moderation_log')
        .insert({
          item_id: itemId,
          admin_id: adminProfile.id,
          action: 'mark_returned',
          reason: reason || 'Item confirmed as returned by admin',
        });

      await supabase.logAdminAction(
        adminProfile.id,
        'MARK_ITEM_RETURNED',
        'items',
        'success',
        { itemId, reason, finderId: item.finder_id, claimantId: claim?.claimant_id },
        req.clientIp!,
        req.userAgent!
      );

      return res.json({ success: true, message: 'Item marked as returned successfully' });
    } catch (error) {
      console.error('[ADMIN] Mark returned error:', error);
      return res.status(500).json({ error: 'Failed to mark item as returned' });
    }
  }
);

/**
 * GET /admin/items/:itemId/moderation-history
 * Get moderation history for an item
 */
router.get(
  "/items/:itemId/moderation-history",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;

      const { data, error } = await supabase
        .getServiceClient()
        .from('item_moderation_log')
        .select('*, admin_users(email, full_name)')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json(data || []);
    } catch (error) {
      console.error('[ADMIN] Moderation history error:', error);
      res.status(500).json({ error: 'Failed to fetch moderation history' });
    }
  }
);

// ============================================================
// USERS ENDPOINTS
// ============================================================

/**
 * GET /admin/users
 * Get all users with filters and pagination
 */
router.get(
  "/users",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const search = (req.query.search as string) || '';

      let query = supabase
        .getServiceClient()
        .from('user_profiles')
        .select('*', { count: 'exact' });

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const from = (page - 1) * limit;
      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, from + limit - 1);

      if (error) throw error;

      res.json({
        data: data || [],
        total: count || 0,
        page,
        limit,
      });
    } catch (error) {
      console.error('[ADMIN] Users fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

/**
 * GET /admin/users/:userId
 * Get single user details
 */
router.get(
  "/users/:userId",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const { data, error } = await supabase
        .getServiceClient()
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('[ADMIN] User fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }
);

/**
 * POST /admin/users/:userId/warn
 * Issue warning to user
 */
router.post(
  "/users/:userId/warn",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { type, severity, title, description } = req.body;
      const adminProfile = req.adminProfile!;

      // Insert warning record
      await supabase
        .getServiceClient()
        .from('user_warnings')
        .insert({
          user_id: userId,
          admin_id: adminProfile.id,
          type,
          severity,
          title,
          description,
        });

      await supabase.logAdminAction(
        adminProfile.id,
        'WARN_USER',
        'users',
        'success',
        { userId, severity },
        req.clientIp!,
        req.userAgent!
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Warn user error:', error);
      res.status(500).json({ error: 'Failed to warn user' });
    }
  }
);

/**
 * POST /admin/users/:userId/suspend
 * Suspend user (temporary ban)
 */
router.post(
  "/users/:userId/suspend",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { reason, duration } = req.body;
      const adminProfile = req.adminProfile!;

      let until_at = null;
      if (duration) {
        const now = new Date();
        now.setHours(now.getHours() + parseInt(duration));
        until_at = now.toISOString();
      }

      const { error } = await supabase
        .getServiceClient()
        .from('user_profiles')
        .update({
          account_status: 'suspended',
          suspended_at: new Date().toISOString(),
          suspended_by: adminProfile.id,
          suspend_reason: reason,
          suspended_until: until_at,
        })
        .eq('user_id', userId);

      if (error) throw error;

      await supabase.logAdminAction(
        adminProfile.id,
        'SUSPEND_USER',
        'users',
        'success',
        { userId, reason, duration, until_at },
        req.clientIp!,
        req.userAgent!,
        userId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Suspend user error:', error);
      res.status(500).json({ error: 'Failed to suspend user' });
    }
  }
);

/**
 * POST /admin/users/:userId/ban
 * Ban user (permanent)
 */
router.post(
  "/users/:userId/ban",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminProfile = req.adminProfile!;

      const { error } = await supabase
        .getServiceClient()
        .from('user_profiles')
        .update({
          account_status: 'banned',
          banned_at: new Date().toISOString(),
          banned_by: adminProfile.id,
          ban_reason: reason,
        })
        .eq('user_id', userId);

      if (error) throw error;

      await supabase.logAdminAction(
        adminProfile.id,
        'BAN_USER',
        'users',
        'success',
        { userId, reason },
        req.clientIp!,
        req.userAgent!,
        userId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Ban user error:', error);
      res.status(500).json({ error: 'Failed to ban user' });
    }
  }
);

/**
 * POST /admin/users/:userId/unban
 * Unban user
 */
router.post(
  "/users/:userId/unban",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const adminProfile = req.adminProfile!;

      const { error } = await supabase
        .getServiceClient()
        .from('user_profiles')
        .update({
          account_status: 'active',
          banned_at: null,
          banned_by: null,
          ban_reason: null,
        })
        .eq('user_id', userId);

      if (error) throw error;

      await supabase.logAdminAction(
        adminProfile.id,
        'UNBAN_USER',
        'users',
        'success',
        { userId },
        req.clientIp!,
        req.userAgent!,
        userId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Unban user error:', error);
      res.status(500).json({ error: 'Failed to unban user' });
    }
  }
);

/**
 * POST /admin/users/:userId/adjust-trust-score
 * Adjust trust score for a user
 */
router.post(
  "/users/:userId/adjust-trust-score",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { newScore, reason } = req.body;
      const adminProfile = req.adminProfile!;

      const { error } = await supabase
        .getServiceClient()
        .from('user_profiles')
        .update({
          trust_score: Math.max(0, Math.min(100, newScore)),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      // Log the change
      await supabase
        .getServiceClient()
        .from('trust_score_history')
        .insert({
          user_id: userId,
          admin_id: adminProfile.id,
          new_score: newScore,
          reason: reason || null,
        });

      await supabase.logAdminAction(
        adminProfile.id,
        'ADJUST_TRUST_SCORE',
        'users',
        'success',
        { userId, newScore, reason },
        req.clientIp!,
        req.userAgent!,
        userId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Adjust trust score error:', error);
      res.status(500).json({ error: 'Failed to adjust trust score' });
    }
  }
);

/**
 * POST /admin/users/:userId/disable-chat
 * Disable chat for user
 */
router.post(
  "/users/:userId/disable-chat",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminProfile = req.adminProfile!;

      const { error } = await supabase
        .getServiceClient()
        .from('user_profiles')
        .update({
          chat_disabled: true,
          chat_disabled_reason: reason,
        })
        .eq('user_id', userId);

      if (error) throw error;

      await supabase.logAdminAction(
        adminProfile.id,
        'DISABLE_USER_CHAT',
        'users',
        'success',
        { userId, reason },
        req.clientIp!,
        req.userAgent!,
        userId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Disable chat error:', error);
      res.status(500).json({ error: 'Failed to disable chat' });
    }
  }
);

/**
 * POST /admin/users/:userId/enable-chat
 * Enable chat for user
 */
router.post(
  "/users/:userId/enable-chat",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const adminProfile = req.adminProfile!;

      const { error } = await supabase
        .getServiceClient()
        .from('user_profiles')
        .update({
          chat_disabled: false,
          chat_disabled_reason: null,
        })
        .eq('user_id', userId);

      if (error) throw error;

      await supabase.logAdminAction(
        adminProfile.id,
        'ENABLE_USER_CHAT',
        'users',
        'success',
        { userId },
        req.clientIp!,
        req.userAgent!,
        userId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Enable chat error:', error);
      res.status(500).json({ error: 'Failed to enable chat' });
    }
  }
);

/**
 * POST /admin/users/:userId/block-claims
 * Block user from making claims
 */
router.post(
  "/users/:userId/block-claims",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminProfile = req.adminProfile!;

      const { error } = await supabase
        .getServiceClient()
        .from('user_profiles')
        .update({
          claims_blocked: true,
          claims_blocked_reason: reason,
        })
        .eq('user_id', userId);

      if (error) throw error;

      await supabase.logAdminAction(
        adminProfile.id,
        'BLOCK_USER_CLAIMS',
        'users',
        'success',
        { userId, reason },
        req.clientIp!,
        req.userAgent!,
        userId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Block claims error:', error);
      res.status(500).json({ error: 'Failed to block claims' });
    }
  }
);

/**
 * POST /admin/users/:userId/unblock-claims
 * Unblock user claims
 */
router.post(
  "/users/:userId/unblock-claims",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const adminProfile = req.adminProfile!;

      const { error } = await supabase
        .getServiceClient()
        .from('user_profiles')
        .update({
          claims_blocked: false,
          claims_blocked_reason: null,
        })
        .eq('user_id', userId);

      if (error) throw error;

      await supabase.logAdminAction(
        adminProfile.id,
        'UNBLOCK_USER_CLAIMS',
        'users',
        'success',
        { userId },
        req.clientIp!,
        req.userAgent!,
        userId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Unblock claims error:', error);
      res.status(500).json({ error: 'Failed to unblock claims' });
    }
  }
);

/**
 * GET /admin/users/:userId/items
 * Get user's items
 */
router.get(
  "/users/:userId/items",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const { data, error } = await supabase
        .getServiceClient()
        .from('items')
        .select('*')
        .eq('finder_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json(data || []);
    } catch (error) {
      console.error('[ADMIN] User items error:', error);
      res.status(500).json({ error: 'Failed to fetch user items' });
    }
  }
);

/**
 * GET /admin/users/:userId/claims
 * Get user's claims
 */
router.get(
  "/users/:userId/claims",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const { data, error } = await supabase
        .getServiceClient()
        .from('claims')
        .select('*')
        .eq('claimant_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json(data || []);
    } catch (error) {
      console.error('[ADMIN] User claims error:', error);
      res.status(500).json({ error: 'Failed to fetch user claims' });
    }
  }
);

/**
 * GET /admin/users/:userId/warnings
 * Get user's warnings
 */
router.get(
  "/users/:userId/warnings",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const { data, error } = await supabase
        .getServiceClient()
        .from('user_warnings')
        .select('*, admin_users(email, full_name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json(data || []);
    } catch (error) {
      console.error('[ADMIN] User warnings error:', error);
      res.status(500).json({ error: 'Failed to fetch user warnings' });
    }
  }
);

/**
 * GET /admin/users/:userId/trust-history
 * Get user's trust score history
 */
router.get(
  "/users/:userId/trust-history",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const { data, error } = await supabase
        .getServiceClient()
        .from('trust_score_history')
        .select('*, admin_users(email, full_name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json(data || []);
    } catch (error) {
      console.error('[ADMIN] Trust history error:', error);
      res.status(500).json({ error: 'Failed to fetch trust history' });
    }
  }
);

// ============================================================
// CLAIMS ENDPOINTS
// ============================================================

/**
 * GET /admin/claims
 * Get all claims with filters and pagination
 */
router.get(
  "/claims",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const status = (req.query.status as string) || undefined;

      let query = supabase
        .getServiceClient()
        .from('claims')
        .select('*, items(title, item_images(id, storage_path, image_url, is_primary, sort_order)), user_profiles!claimant_id(full_name)', { count: 'exact' });

      if (status) {
        query = query.eq('status', status);
      }

      const from = (page - 1) * limit;
      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, from + limit - 1);

      if (error) throw error;

      res.json({
        data: data || [],
        total: count || 0,
        page,
        limit,
      });
    } catch (error) {
      console.error('[ADMIN] Claims fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch claims' });
    }
  }
);

/**
 * GET /admin/claims/:claimId
 * Get single claim details
 */
router.get(
  "/claims/:claimId",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;

      const { data, error } = await supabase
        .getServiceClient()
        .from('claims')
        .select('*, items(*, item_images(id, storage_path, image_url, is_primary, sort_order)), user_profiles!claimant_id(full_name)')
        .eq('id', claimId)
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('[ADMIN] Claim fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch claim' });
    }
  }
);

/**
 * POST /admin/claims/:claimId/approve
 * Approve claim
 */
router.post(
  "/claims/:claimId/approve",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      const adminProfile = req.adminProfile!;

      const { error } = await supabase
        .getServiceClient()
        .from('claims')
        .update({
          status: 'approved',
          admin_override: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (error) throw error;

      // Log action
      await supabase.logAdminAction(
        adminProfile.id,
        'APPROVE_CLAIM',
        'claim',
        'success',
        { claimId },
        req.clientIp!,
        req.userAgent!,
        claimId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Approve claim error:', error);
      
      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          'APPROVE_CLAIM',
          'claim',
          'failure',
          { claimId: req.params.claimId, error: String(error) },
          req.clientIp!,
          req.userAgent!,
          req.params.claimId,
          req.adminProfile.email
        );
      }
      
      res.status(500).json({ error: 'Failed to approve claim' });
    }
  }
);

/**
 * POST /admin/claims/:claimId/reject
 * Reject claim
 */
router.post(
  "/claims/:claimId/reject",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      const { reason } = req.body;
      const adminProfile = req.adminProfile!;

      const { error } = await supabase
        .getServiceClient()
        .from('claims')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          admin_override: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (error) throw error;

      // Log action
      await supabase.logAdminAction(
        adminProfile.id,
        'REJECT_CLAIM',
        'claim',
        'success',
        { claimId, reason },
        req.clientIp!,
        req.userAgent!,
        claimId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Reject claim error:', error);
      
      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          'REJECT_CLAIM',
          'claim',
          'failure',
          { claimId: req.params.claimId, error: String(error) },
          req.clientIp!,
          req.userAgent!,
          req.params.claimId,
          req.adminProfile.email
        );
      }
      
      res.status(500).json({ error: 'Failed to reject claim' });
    }
  }
);

/**
 * POST /admin/claims/:claimId/lock
 * Lock claim from edits
 */
router.post(
  "/claims/:claimId/lock",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      const { reason } = req.body;
      const adminProfile = req.adminProfile!;

      const { error } = await supabase
        .getServiceClient()
        .from('claims')
        .update({
          is_locked: true,
          locked_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (error) throw error;

      // Log action
      await supabase.logAdminAction(
        adminProfile.id,
        'LOCK_CLAIM',
        'claim',
        'success',
        { claimId, reason },
        req.clientIp!,
        req.userAgent!,
        claimId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Lock claim error:', error);
      
      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          'LOCK_CLAIM',
          'claim',
          'failure',
          { claimId: req.params.claimId, error: String(error) },
          req.clientIp!,
          req.userAgent!,
          req.params.claimId,
          req.adminProfile.email
        );
      }
      
      res.status(500).json({ error: 'Failed to lock claim' });
    }
  }
);

/**
 * POST /admin/claims/:claimId/unlock
 * Unlock claim
 */
router.post(
  "/claims/:claimId/unlock",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      const adminProfile = req.adminProfile!;

      const { error } = await supabase
        .getServiceClient()
        .from('claims')
        .update({
          is_locked: false,
          locked_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (error) throw error;

      // Log action
      await supabase.logAdminAction(
        adminProfile.id,
        'UNLOCK_CLAIM',
        'claim',
        'success',
        { claimId },
        req.clientIp!,
        req.userAgent!,
        claimId,
        adminProfile.email
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Unlock claim error:', error);
      
      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          'UNLOCK_CLAIM',
          'claim',
          'failure',
          { claimId: req.params.claimId, error: String(error) },
          req.clientIp!,
          req.userAgent!,
          req.params.claimId,
          req.adminProfile.email
        );
      }
      
      res.status(500).json({ error: 'Failed to unlock claim' });
    }
  }
);

/**
 * POST /admin/claims/:claimId/flag-dispute
 * Flag claim dispute
 */
router.post(
  "/claims/:claimId/flag-dispute",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      const { reason } = req.body;

      const { error } = await supabase
        .getServiceClient()
        .from('claims')
        .update({
          is_disputed: true,
          dispute_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Flag dispute error:', error);
      res.status(500).json({ error: 'Failed to flag dispute' });
    }
  }
);

/**
 * POST /admin/claims/:claimId/resolve-dispute
 * Resolve claim dispute
 */
router.post(
  "/claims/:claimId/resolve-dispute",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      const { resolution, reason } = req.body;

      const { error } = await supabase
        .getServiceClient()
        .from('claims')
        .update({
          is_disputed: false,
          dispute_resolution: resolution,
          dispute_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Resolve dispute error:', error);
      res.status(500).json({ error: 'Failed to resolve dispute' });
    }
  }
);

/**
 * POST /admin/claims/:claimId/notes
 * Add note to claim
 */
router.post(
  "/claims/:claimId/notes",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      const { text } = req.body;
      const adminProfile = req.adminProfile!;

      await supabase
        .getServiceClient()
        .from('claim_notes')
        .insert({
          claim_id: claimId,
          admin_id: adminProfile.id,
          text,
        });

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Add note error:', error);
      res.status(500).json({ error: 'Failed to add note' });
    }
  }
);

/**
 * GET /admin/claims/:claimId/notes
 * Get notes on claim
 */
router.get(
  "/claims/:claimId/notes",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;

      const { data, error } = await supabase
        .getServiceClient()
        .from('claim_notes')
        .select('*, admin_users(email, full_name)')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json(data || []);
    } catch (error) {
      console.error('[ADMIN] Get notes error:', error);
      res.status(500).json({ error: 'Failed to fetch notes' });
    }
  }
);

// ============================================================
// CHATS ENDPOINTS
// ============================================================

/**
 * GET /admin/chats
 * Get all chats with filters and pagination
 */
router.get(
  "/chats",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      const from = (page - 1) * limit;
      const { data, count, error } = await supabase
        .getServiceClient()
        .from('chats')
        .select('*', { count: 'exact' })
        .order('updated_at', { ascending: false })
        .range(from, from + limit - 1);

      if (error) throw error;

      res.json({
        data: data || [],
        total: count || 0,
        page,
        limit,
      });
    } catch (error) {
      console.error('[ADMIN] Chats fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch chats' });
    }
  }
);

/**
 * GET /admin/chats/:chatId
 * Get single chat with messages
 */
router.get(
  "/chats/:chatId",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { chatId } = req.params;

      const { data, error } = await supabase
        .getServiceClient()
        .from('chats')
        .select('*, chat_messages(*)')
        .eq('id', chatId)
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('[ADMIN] Chat fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch chat' });
    }
  }
);

/**
 * POST /admin/chats/:chatId/freeze
 * Freeze chat (prevent new messages)
 */
router.post(
  "/chats/:chatId/freeze",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { chatId } = req.params;
      const { reason } = req.body;

      const { error } = await supabase
        .getServiceClient()
        .from('chats')
        .update({
          is_frozen: true,
          frozen_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', chatId);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Freeze chat error:', error);
      res.status(500).json({ error: 'Failed to freeze chat' });
    }
  }
);

/**
 * POST /admin/chats/:chatId/unfreeze
 * Unfreeze chat
 */
router.post(
  "/chats/:chatId/unfreeze",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { chatId } = req.params;

      const { error } = await supabase
        .getServiceClient()
        .from('chats')
        .update({
          is_frozen: false,
          frozen_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', chatId);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Unfreeze chat error:', error);
      res.status(500).json({ error: 'Failed to unfreeze chat' });
    }
  }
);

/**
 * DELETE /admin/chats/:chatId/messages/:messageId
 * Delete message from chat
 */
router.delete(
  "/chats/:chatId/messages/:messageId",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;
      const { reason } = req.body;

      const { error } = await supabase
        .getServiceClient()
        .from('chat_messages')
        .update({
          is_deleted: true,
          deleted_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageId);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Delete message error:', error);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }
);

/**
 * POST /admin/chats/:chatId/close
 * Close chat (permanent)
 */
router.post(
  "/chats/:chatId/close",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { chatId } = req.params;
      const { reason } = req.body;

      const { error } = await supabase
        .getServiceClient()
        .from('chats')
        .update({
          is_closed: true,
          closed_reason: reason,
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', chatId);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Close chat error:', error);
      res.status(500).json({ error: 'Failed to close chat' });
    }
  }
);

// ============================================================
// REPORTS ENDPOINTS
// ============================================================

/**
 * GET /admin/reports
 * Get all abuse reports with filters and pagination
 */
router.get(
  "/reports",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const status = (req.query.status as string) || undefined;

      let query = supabase
        .getServiceClient()
        .from('abuse_reports')
        .select('*', { count: 'exact' });

      if (status) {
        query = query.eq('status', status);
      }

      const from = (page - 1) * limit;
      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, from + limit - 1);

      if (error) throw error;

      res.json({
        data: data || [],
        total: count || 0,
        page,
        limit,
      });
    } catch (error) {
      console.error('[ADMIN] Reports fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  }
);

/**
 * GET /admin/reports/:reportId
 * Get single report details
 */
router.get(
  "/reports/:reportId",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;

      const { data, error } = await supabase
        .getServiceClient()
        .from('abuse_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('[ADMIN] Report fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch report' });
    }
  }
);

/**
 * POST /admin/reports/:reportId/resolve
 * Mark report as resolved
 */
router.post(
  "/reports/:reportId/resolve",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const { action } = req.body;
      const adminProfile = req.adminProfile!;

      const { error } = await supabase
        .getServiceClient()
        .from('abuse_reports')
        .update({
          status: 'resolved',
          resolution: action,
          resolved_by: adminProfile.id,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Resolve report error:', error);
      res.status(500).json({ error: 'Failed to resolve report' });
    }
  }
);

/**
 * POST /admin/reports/:reportId/dismiss
 * Dismiss report (not applicable)
 */
router.post(
  "/reports/:reportId/dismiss",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const { reason } = req.body;
      const adminProfile = req.adminProfile!;

      const { error } = await supabase
        .getServiceClient()
        .from('abuse_reports')
        .update({
          status: 'dismissed',
          dismissal_reason: reason,
          resolved_by: adminProfile.id,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Dismiss report error:', error);
      res.status(500).json({ error: 'Failed to dismiss report' });
    }
  }
);

/**
 * POST /admin/reports/:reportId/escalate
 * Escalate report to super admin
 */
router.post(
  "/reports/:reportId/escalate",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const { reason } = req.body;

      const { error } = await supabase
        .getServiceClient()
        .from('abuse_reports')
        .update({
          is_escalated: true,
          escalation_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Escalate report error:', error);
      res.status(500).json({ error: 'Failed to escalate report' });
    }
  }
);

// ============================================================
// SETTINGS ENDPOINTS
// ============================================================

/**
 * GET /admin/settings
 * Get system settings (all admins can read; only super admin can modify)
 */
router.get(
  "/settings",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;

      // Log the action
      await supabase.logAdminAction(
        adminProfile.id,
        "READ_SETTINGS",
        "settings",
        "success",
        {},
        req.clientIp!,
        req.userAgent!,
        undefined,
        adminProfile.email
      );

      const { data, error } = await supabase
        .getServiceClient()
        .from("system_settings")
        .select("*")
        .order("setting_key", { ascending: true });

      if (error) throw error;

      // Transform to expected format with typed values based on setting_type
      const settings = (data || []).map((setting: any) => {
        const valueJson = setting.setting_value; // This is already parsed JSONB
        const settingType = setting.setting_type || 'string';
        
        let typedValue: any = {
          value_string: null,
          value_number: null,
          value_boolean: null,
          value_json: null,
        };

        // The value is already parsed from JSONB, use it directly
        switch (settingType) {
          case 'number':
            typedValue.value_number = typeof valueJson === 'number' ? valueJson : null;
            break;
          case 'boolean':
            typedValue.value_boolean = typeof valueJson === 'boolean' ? valueJson : null;
            break;
          case 'json':
            typedValue.value_json = valueJson;
            break;
          default:
            typedValue.value_string = typeof valueJson === 'string' ? valueJson : null;
        }

        return {
          id: setting.id,
          setting_key: setting.setting_key,
          setting_type: settingType,
          ...typedValue,
          description: setting.description,
          is_sensitive: setting.is_sensitive,
          updated_at: setting.updated_at,
        };
      });

      return res.json(settings);
    } catch (error) {
      console.error("[ADMIN] Settings fetch error:", error);

      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          "READ_SETTINGS",
          "settings",
          "failure",
          { error: String(error) },
          req.clientIp!,
          req.userAgent!,
          undefined,
          req.adminProfile.email
        );
      }

      return res.status(500).json({
        error: "Failed to fetch settings",
        code: "SETTINGS_ERROR",
      });
    }
  }
);

/**
 * PUT /admin/settings
 * Update system settings (super admin only)
 */
router.put(
  "/settings",
  adminLimiter,
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminProfile = req.adminProfile!;
      const updates = req.body; // Array of { key, value }

      if (!Array.isArray(updates)) {
        return res.status(400).json({
          error: "Invalid request format. Expected array of settings.",
        });
      }

      // Update each setting
      for (const update of updates) {
        const { key, value } = update;

        // Store value as JSONB (Supabase will handle JSON serialization)
        await supabase
          .getServiceClient()
          .from("system_settings")
          .update({
            setting_value: value, // Store as-is, JSONB column handles type
            updated_by: adminProfile.id,
            updated_at: new Date().toISOString(),
          })
          .eq("setting_key", key);
      }

      // Log the action
      await supabase.logAdminAction(
        adminProfile.id,
        "UPDATE_SETTINGS",
        "settings",
        "success",
        { updatedKeys: updates.map(u => u.key) },
        req.clientIp!,
        req.userAgent!,
        undefined,
        adminProfile.email
      );

      // Clear settings cache so changes take effect immediately
      clearSettingsCache();

      return res.json({ success: true, updated: updates.length });
    } catch (error) {
      console.error("[ADMIN] Settings update error:", error);

      if (req.adminProfile) {
        await supabase.logAdminAction(
          req.adminProfile.id,
          "UPDATE_SETTINGS",
          "settings",
          "failure",
          { error: String(error) },
          req.clientIp!,
          req.userAgent!,
          undefined,
          req.adminProfile.email
        );
      }

      return res.status(500).json({
        error: "Failed to update settings",
        code: "SETTINGS_ERROR",
      });
    }
  }
);

export default router;
