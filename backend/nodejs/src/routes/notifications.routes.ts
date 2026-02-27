import { Router, Request, Response } from "express";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";
import { adminLimiter } from "../middleware/rateLimit";
import { supabase } from "../services/supabase";

const router = Router();

/**
 * ============================================
 * NOTIFICATIONS API ROUTES
 * ============================================
 */

/**
 * GET /notifications/stats/summary
 * Get notification statistics
 * NOTE: Must be before /:id route to avoid matching "stats" as an id
 */
router.get(
  "/stats/summary",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const client = supabase.getServiceClient();

      const { data: typeStats, error: typeError } = await client
        .from('notifications')
        .select('type, is_read')
        .order('created_at', { ascending: false });

      if (typeError) throw typeError;

      const stats: {
        total: number;
        unread: number;
        by_type: Record<string, { total: number; unread: number }>;
      } = {
        total: typeStats?.length || 0,
        unread: typeStats?.filter((n: any) => !n.is_read).length || 0,
        by_type: {}
      };

      typeStats?.forEach((notification: any) => {
        if (!stats.by_type[notification.type]) {
          stats.by_type[notification.type] = { total: 0, unread: 0 };
        }
        stats.by_type[notification.type].total++;
        if (!notification.is_read) {
          stats.by_type[notification.type].unread++;
        }
      });

      res.json(stats);
    } catch (error) {
      console.error("[NOTIFICATIONS] Get stats error:", error);
      res.status(500).json({
        error: "Failed to fetch notification stats",
        code: "STATS_ERROR",
      });
    }
  }
);

/**
 * GET /notifications/unread-count
 * Get count of unread notifications
 */
router.get(
  "/unread-count",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const client = supabase.getServiceClient();

      const { count } = await client
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      res.json({
        unread_count: count || 0
      });
    } catch (error) {
      console.error("[NOTIFICATIONS] Get unread count error:", error);
      res.status(500).json({
        error: "Failed to fetch unread count",
        code: "UNREAD_COUNT_ERROR",
      });
    }
  }
);

/**
 * PUT /notifications/read-all
 * Mark all notifications as read
 */
router.put(
  "/read-all",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const adminProfile = req.adminProfile!;
      const client = supabase.getServiceClient();

      const { data: unreadNotifications, error: fetchError } = await client
        .from('notifications')
        .select('id')
        .eq('is_read', false);

      if (fetchError) throw fetchError;

      const count = unreadNotifications?.length || 0;

      if (count > 0) {
        const { error: updateError } = await client
          .from('notifications')
          .update({
            is_read: true,
            read_at: new Date().toISOString(),
            read_by: adminProfile.id
          })
          .eq('is_read', false);

        if (updateError) throw updateError;
      }

      await supabase.logAdminAction(
        adminProfile.id,
        "MARK_ALL_NOTIFICATIONS_READ",
        "notification",
        "success",
        { count },
        req.clientIp!,
        req.userAgent!
      );

      res.json({
        success: true,
        message: `${count} notifications marked as read`,
        count
      });
    } catch (error) {
      console.error("[NOTIFICATIONS] Mark all as read error:", error);
      res.status(500).json({
        error: "Failed to mark all notifications as read",
        code: "MARK_ALL_READ_ERROR",
      });
    }
  }
);

/**
 * POST /notifications/test
 * Create a test notification (super admin only)
 */
router.post(
  "/test",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const adminProfile = req.adminProfile!;
      const client = supabase.getServiceClient();

      if (adminProfile.role !== 'super_admin') {
        res.status(403).json({
          error: "Only super admins can create test notifications",
          code: "FORBIDDEN",
        });
        return;
      }

      const { type, title, message, priority } = req.body;

      const { data: notification, error } = await client
        .from('notifications')
        .insert({
          type: type || 'system_alert',
          title: title || 'Test Notification',
          message: message || 'This is a test notification',
          data: { test: true, created_by: adminProfile.id },
          priority: priority || 1,
        })
        .select('id')
        .single();

      if (error) throw error;

      await supabase.logAdminAction(
        adminProfile.id,
        "CREATE_TEST_NOTIFICATION",
        "notification",
        "success",
        { notification_id: notification?.id },
        req.clientIp!,
        req.userAgent!
      );

      res.json({
        success: true,
        message: "Test notification created",
        notification_id: notification?.id
      });
    } catch (error) {
      console.error("[NOTIFICATIONS] Create test notification error:", error);
      res.status(500).json({
        error: "Failed to create test notification",
        code: "CREATE_TEST_ERROR",
      });
    }
  }
);

/**
 * GET /notifications
 * Get all notifications for the current admin
 */
router.get(
  "/",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const client = supabase.getServiceClient();
      const unreadOnly = req.query.unread_only === 'true';
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;
      const type = req.query.type as string;

      let query = client
        .from('notifications')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      if (type) {
        query = query.eq('type', type);
      }

      const { data: notifications, error, count } = await query;

      if (error) throw error;

      const { count: unreadCount } = await client
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      res.json({
        notifications,
        total: count || 0,
        unread_count: unreadCount || 0,
        limit,
        offset
      });
    } catch (error) {
      console.error("[NOTIFICATIONS] Get notifications error:", error);
      res.status(500).json({
        error: "Failed to fetch notifications",
        code: "NOTIFICATIONS_FETCH_ERROR",
      });
    }
  }
);

/**
 * GET /notifications/:id
 * Get a specific notification by ID
 */
router.get(
  "/:id",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const client = supabase.getServiceClient();

      const { data: notification, error } = await client
        .from('notifications')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (!notification) {
        res.status(404).json({
          error: "Notification not found",
          code: "NOTIFICATION_NOT_FOUND",
        });
        return;
      }

      res.json(notification);
    } catch (error) {
      console.error("[NOTIFICATIONS] Get notification error:", error);
      res.status(500).json({
        error: "Failed to fetch notification",
        code: "NOTIFICATION_FETCH_ERROR",
      });
    }
  }
);

/**
 * PUT /notifications/:id/read
 * Mark a notification as read
 */
router.put(
  "/:id/read",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const adminProfile = req.adminProfile!;
      const client = supabase.getServiceClient();

      const { error } = await client
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
          read_by: adminProfile.id
        })
        .eq('id', id)
        .eq('is_read', false);

      if (error) throw error;

      await supabase.logAdminAction(
        adminProfile.id,
        "MARK_NOTIFICATION_READ",
        "notification",
        "success",
        { notification_id: id },
        req.clientIp!,
        req.userAgent!
      );

      res.json({
        success: true,
        message: "Notification marked as read"
      });
    } catch (error) {
      console.error("[NOTIFICATIONS] Mark as read error:", error);
      res.status(500).json({
        error: "Failed to mark notification as read",
        code: "MARK_READ_ERROR",
      });
    }
  }
);

/**
 * DELETE /notifications/:id
 * Delete a specific notification
 */
router.delete(
  "/:id",
  adminLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const adminProfile = req.adminProfile!;
      const client = supabase.getServiceClient();

      const { error } = await client
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await supabase.logAdminAction(
        adminProfile.id,
        "DELETE_NOTIFICATION",
        "notification",
        "success",
        { notification_id: id },
        req.clientIp!,
        req.userAgent!
      );

      res.json({
        success: true,
        message: "Notification deleted"
      });
    } catch (error) {
      console.error("[NOTIFICATIONS] Delete notification error:", error);
      res.status(500).json({
        error: "Failed to delete notification",
        code: "DELETE_NOTIFICATION_ERROR",
      });
    }
  }
);

export default router;
