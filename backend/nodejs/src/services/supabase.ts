import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { AdminProfile } from "../types/express";

/**
 * CRITICAL SECURITY NOTE:
 * - Client: Uses ANON_KEY (frontend can use)
 * - Service: Uses SERVICE_ROLE_KEY (backend only)
 * - Service key bypasses RLS for admin operations
 * - Always verify user role server-side
 */

class SupabaseService {
  private clientAnon: SupabaseClient;
  private clientService: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Missing required Supabase environment variables");
    }

    // Client for reading public data
    this.clientAnon = createClient(supabaseUrl, anonKey);

    // Service role client for admin operations (backend only)
    this.clientService = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Verify JWT token and get authenticated user
   * CRITICAL: This validates that the token is legitimate
   */
  async verifyToken(token: string): Promise<User | null> {
    try {
      const {
        data: { user },
        error,
      } = await this.clientAnon.auth.getUser(token);

      if (error || !user) {
        console.log("[AUTH] Token verification failed:", error?.message);
        return null;
      }

      return user;
    } catch (error) {
      console.error("[AUTH] Token verification error:", error);
      return null;
    }
  }

  /**
   * Get admin profile from database
   * CRITICAL: Verify is_active and force_logout_at
   * NOTE: userId is from auth.users.id, we query admin_users by user_id FK
   */
  async getAdminProfile(userId: string): Promise<AdminProfile | null> {
    try {
      console.log(`[AUTH] Fetching admin profile for userId: ${userId}`);
      
      const { data, error } = await this.clientService
        .from("admin_users")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.log("[AUTH] Database error fetching admin:", error.message, error.code);
        return null;
      }

      if (!data) {
        console.log("[AUTH] Admin record not found for userId:", userId);
        return null;
      }

      console.log(`[AUTH] Admin record found: ${data.email}, is_active: ${data.is_active}`);

      // Check if admin is inactive
      if (!data.is_active) {
        console.log("[AUTH] Admin inactive:", userId);
        return null;
      }

      // Check if force logout is set and current time is after it
      if (data.force_logout_at) {
        const forceLogoutTime = new Date(data.force_logout_at);
        if (new Date() >= forceLogoutTime) {
          console.log("[AUTH] Force logout triggered for:", userId, "— clearing force_logout_at so admin can re-login");
          // Clear it so it only fires once — admin can log back in after being kicked out
          await this.clientService
            .from("admin_users")
            .update({ force_logout_at: null, updated_at: new Date().toISOString() })
            .eq("user_id", userId);
          return null;
        }
      }

      console.log(`[AUTH] Admin profile verified successfully: ${data.email}`);
      return data as AdminProfile;
    } catch (error) {
      console.error("[AUTH] Error fetching admin profile:", error);
      return null;
    }
  }

  /**
   * Log admin action to audit trail
   * CRITICAL: All admin actions must be logged
   */
  async logAdminAction(
    adminId: string,
    action: string,
    resourceType: string,
    status: "success" | "failure",
    details: Record<string, any>,
    ipAddress: string,
    userAgent: string,
    resourceId?: string,
    adminEmail?: string
  ): Promise<void> {
    try {
      // Map to actual database schema columns
      await this.clientService.from("admin_audit_logs").insert({
        admin_id: adminId,
        action,
        resource_type: resourceType,
        resource_action: status, // Map status to resource_action
        resource_id: resourceId || null,
        reason: adminEmail || null, // Store admin email in reason field temporarily
        before_data: details || null, // Store details in before_data
        after_data: null,
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[AUDIT] Error logging action:", error);
      // Don't throw - audit logging should not break the request
    }
  }

  /**
   * Log admin login
   */
  async logAdminLogin(
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      await this.clientService.from("admin_login_history").insert({
        admin_id: adminId,
        admin_email: adminEmail,
        login_at: new Date().toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
        success: true,
      });
    } catch (error) {
      console.error("[AUDIT] Error logging login:", error);
    }
  }

  /**
   * Update 2FA settings for super admin
   */
  async updateTwoFASettings(
    adminId: string,
    twoFASecret: string | null,
    twoFAEnabled: boolean,
    twoFAVerifiedAt: string | null
  ): Promise<boolean> {
    try {
      const { error } = await this.clientService
        .from("admin_users")
        .update({
          twofa_secret: twoFASecret,
          twofa_enabled: twoFAEnabled,
          twofa_verified_at: twoFAVerifiedAt,
        })
        .eq("user_id", adminId);

      if (error) {
        console.error("[2FA] Error updating 2FA settings:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[2FA] Error updating 2FA settings:", error);
      return false;
    }
  }

  /**
   * Get 2FA secret for verification
   */
  async getTwoFASecret(adminId: string): Promise<string | null> {
    try {
      const { data, error } = await this.clientService
        .from("admin_users")
        .select("twofa_secret")
        .eq("user_id", adminId)
        .single();

      if (error || !data) {
        return null;
      }

      return data.twofa_secret;
    } catch (error) {
      console.error("[2FA] Error fetching 2FA secret:", error);
      return null;
    }
  }

  /**
   * Get analytics data
   * CRITICAL: Calculate from actual tables (no platform_statistics_daily table)
   * FIXED: Uses real data sources - items, claims, abuse_reports
   */
  async getAnalyticsSummary(): Promise<any> {
    try {
      console.log("[ANALYTICS] getAnalyticsSummary called");
      // Fetch all counts in parallel
      const totalUsersRes = await this.clientService.from("user_profiles").select("*", { count: "exact", head: true });
      console.log("[ANALYTICS] Total Users query result:", { count: totalUsersRes.count, error: totalUsersRes.error });
      
      const newTodayUsersRes = await this.clientService
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
      
      const newThisWeekUsersRes = await this.clientService
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      const newThisMonthUsersRes = await this.clientService
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
      
      const lowTrustUsersRes = await this.clientService
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .lt("trust_score", 40);
        
      const [
        totalItemsRes,
        activeItemsRes,
        returnedItemsRes,
        flaggedItemsRes,
        totalClaimsRes,
        pendingClaimsRes,
        approvedClaimsRes,
        rejectedClaimsRes,
        approvedTodayRes,
        activeChatsRes,
        frozenChatsRes,
        pendingReportsRes,
      ] = await Promise.all([
        // Items
        this.clientService.from("items").select("*", { count: "exact", head: true }),
        this.clientService
          .from("items")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        this.clientService
          .from("items")
          .select("*", { count: "exact", head: true })
          .eq("status", "returned"),
        this.clientService
          .from("items")
          .select("*", { count: "exact", head: true })
          .eq("is_flagged", true),
        // Claims
        this.clientService.from("claims").select("*", { count: "exact", head: true }),
        this.clientService
          .from("claims")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        this.clientService
          .from("claims")
          .select("*", { count: "exact", head: true })
          .eq("status", "approved"),
        this.clientService
          .from("claims")
          .select("*", { count: "exact", head: true })
          .eq("status", "rejected"),
        this.clientService
          .from("claims")
          .select("*", { count: "exact", head: true })
          .eq("status", "approved")
          .gte("approved_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        // Chats
        this.clientService
          .from("chats")
          .select("*", { count: "exact", head: true })
          .eq("is_frozen", false),
        this.clientService
          .from("chats")
          .select("*", { count: "exact", head: true })
          .eq("is_frozen", true),
        // Reports
        this.clientService
          .from("abuse_reports")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

      return {
        users: {
          total: totalUsersRes.count || 0,
          new_today: newTodayUsersRes.count || 0,
          new_this_week: newThisWeekUsersRes.count || 0,
          new_this_month: newThisMonthUsersRes.count || 0,
          low_trust: lowTrustUsersRes.count || 0,
        },
        items: {
          total: totalItemsRes.count || 0,
          active: activeItemsRes.count || 0,
          returned: returnedItemsRes.count || 0,
          flagged: flaggedItemsRes.count || 0,
        },
        claims: {
          total: totalClaimsRes.count || 0,
          pending: pendingClaimsRes.count || 0,
          approved: approvedClaimsRes.count || 0,
          rejected: rejectedClaimsRes.count || 0,
          approved_today: approvedTodayRes.count || 0,
        },
        chats: {
          active: activeChatsRes.count || 0,
          frozen: frozenChatsRes.count || 0,
        },
        reports: {
          pending: pendingReportsRes.count || 0,
        },
      };
    } catch (error) {
      console.error("[ANALYTICS] Error fetching summary:", error);
      return null;
    }
  }

  /**
   * Get daily trend data
   * FIXED: Calculates trends from items table (no platform_statistics_daily table)
   * Groups items by date_found to show activity over time
   */
  async getAnalyticsTrends(days: number = 30): Promise<any> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      // Generate all dates in range for complete data
      const dateMap = new Map<string, {
        stat_date: string;
        new_users: number;
        new_items: number;
        new_claims: number;
        returned_items: number;
        new_reports: number;
      }>();

      // Initialize all dates in range
      for (let i = 0; i < days; i++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split("T")[0];
        dateMap.set(dateStr, {
          stat_date: dateStr,
          new_users: 0,
          new_items: 0,
          new_claims: 0,
          returned_items: 0,
          new_reports: 0,
        });
      }

      // Fetch items created in the time period
      const { data: items } = await this.clientService
        .from("items")
        .select("id, created_at, status")
        .gte("created_at", startDate);

      // Count items per day
      (items || []).forEach((item: any) => {
        const date = new Date(item.created_at).toISOString().split("T")[0];
        if (dateMap.has(date)) {
          const current = dateMap.get(date)!;
          current.new_items += 1;
          if (item.status === "returned") {
            current.returned_items += 1;
          }
        }
      });

      // Fetch claims in the time period
      const { data: claims } = await this.clientService
        .from("claims")
        .select("id, created_at")
        .gte("created_at", startDate);

      (claims || []).forEach((claim: any) => {
        const date = new Date(claim.created_at).toISOString().split("T")[0];
        if (dateMap.has(date)) {
          dateMap.get(date)!.new_claims += 1;
        }
      });

      // Fetch new users in the time period
      const { data: users } = await this.clientService
        .from("user_profiles")
        .select("user_id, created_at")
        .gte("created_at", startDate);

      (users || []).forEach((user: any) => {
        const date = new Date(user.created_at).toISOString().split("T")[0];
        if (dateMap.has(date)) {
          dateMap.get(date)!.new_users += 1;
        }
      });

      // Fetch abuse reports in the time period
      const { data: reports } = await this.clientService
        .from("abuse_reports")
        .select("id, created_at")
        .gte("created_at", startDate);

      (reports || []).forEach((report: any) => {
        const date = new Date(report.created_at).toISOString().split("T")[0];
        if (dateMap.has(date)) {
          dateMap.get(date)!.new_reports += 1;
        }
      });

      // Convert to array sorted by date (most recent first)
      return Array.from(dateMap.values())
        .sort((a, b) => b.stat_date.localeCompare(a.stat_date));
    } catch (error) {
      console.error("[ANALYTICS] Error fetching trends:", error);
      return [];
    }
  }

  /**
   * Get geographic data (areas with activity)
   * Returns all items grouped by area with total and active counts
   */
  async getAnalyticsAreas(): Promise<any> {
    try {
      // Get all items with area information
      const { data, error } = await this.clientService
        .from("items")
        .select("area_id, status, areas(id, name)");

      if (error) {
        console.error("[ANALYTICS] Error fetching areas:", error);
        return null;
      }

      // Group by area and count both total and active
      const areaMap = new Map<string, { name: string; total: number; active: number }>();
      
      (data || []).forEach((item: any) => {
        if (item.areas) {
          const areaName = item.areas.name;
          const key = areaName;
          
          if (!areaMap.has(key)) {
            areaMap.set(key, { name: areaName, total: 0, active: 0 });
          }
          const current = areaMap.get(key)!;
          current.total += 1;
          if (item.status === "active" && !item.is_hidden) {
            current.active += 1;
          }
        }
      });

      return Array.from(areaMap.values()).sort((a, b) => b.total - a.total);
    } catch (error) {
      console.error("[ANALYTICS] Error fetching areas:", error);
      return null;
    }
  }

  /**
   * Get category data (categories with activity)
   * Returns all items grouped by category with total, active, and returned counts
   * Joins with categories table using category_id
   */
  async getAnalyticsCategories(): Promise<any> {
    try {
      // Get all items with category information via join
      console.log("[ANALYTICS] Starting categories query...");
      const { data, error } = await this.clientService
        .from("items")
        .select("status, category_id, categories(id, name)");

      console.log("[ANALYTICS] Categories query result:", { count: data?.length, hasError: !!error, error });

      if (error) {
        console.error("[ANALYTICS] Error fetching categories:", error);
        return null;
      }

      // Group by category and count by status
      const categoryMap = new Map<string, { name: string; total: number; active: number; returned: number; icon: string }>();
      
      (data || []).forEach((item: any) => {
        const categoryName = item.categories?.name || "Uncategorized";
        
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, { 
            name: categoryName, 
            total: 0, 
            active: 0, 
            returned: 0,
            icon: "📦" // Default icon
          });
        }
        const current = categoryMap.get(categoryName)!;
        current.total += 1;
        if (item.status === "active") {
          current.active += 1;
        } else if (item.status === "returned") {
          current.returned += 1;
        }
      });

      return Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);
    } catch (error) {
      console.error("[ANALYTICS] Error fetching categories:", error);
      return null;
    }
  }

  /**
   * PHASE 3: 2FA METHODS
   * All methods below support TOTP-based 2FA for super_admin users
   */

  /**
   * Save encrypted 2FA secret for admin
   * CRITICAL: Secret is encrypted before storage (future enhancement)
   */
  async save2FASecret(
    adminId: string,
    secret: string
  ): Promise<boolean> {
    try {
      const { error } = await this.clientService
        .from("admin_users")
        .update({
          twofa_secret: secret, // In production, encrypt this
          twofa_enabled: false, // Not verified yet
          twofa_verified_at: null,
        })
        .eq("user_id", adminId);

      if (error) {
        console.error("[2FA] Failed to save secret:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[2FA] Save secret error:", error);
      return false;
    }
  }

  /**
   * Get 2FA status for an admin
   * Note: adminId here is the admin_users.id (primary key), not user_id
   */
  async get2FAStatus(
    adminId: string
  ): Promise<{ enabled: boolean; verified: boolean } | null> {
    try {
      const { data, error } = await this.clientService
        .from("admin_users")
        .select("twofa_enabled, twofa_verified_at")
        .eq("id", adminId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        enabled: data.twofa_enabled || false,
        verified: !!data.twofa_verified_at,
      };
    } catch (error) {
      console.error("[2FA] Get status error:", error);
      return null;
    }
  }

  /**
   * Get encrypted 2FA secret for verification
   * CRITICAL: Decrypt only server-side
   * Note: adminId here is admin_users.id (primary key), not user_id
   */
  async get2FASecret(adminId: string): Promise<string | null> {
    try {
      const { data, error } = await this.clientService
        .from("admin_users")
        .select("twofa_secret")
        .eq("id", adminId)
        .single();

      if (error || !data) {
        return null;
      }

      return data.twofa_secret;
    } catch (error) {
      console.error("[2FA] Get secret error:", error);
      return null;
    }
  }

  /**
   * Enable 2FA (mark as verified)
   */
  async enable2FA(adminId: string): Promise<boolean> {
    try {
      const { error } = await this.clientService
        .from("admin_users")
        .update({
          twofa_enabled: true,
          twofa_verified_at: new Date().toISOString(),
        })
        .eq("user_id", adminId);

      if (error) {
        console.error("[2FA] Failed to enable 2FA:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[2FA] Enable 2FA error:", error);
      return false;
    }
  }

  /**
   * Disable 2FA for admin
   */
  async disable2FA(adminId: string): Promise<boolean> {
    try {
      const { error } = await this.clientService
        .from("admin_users")
        .update({
          twofa_enabled: false,
          twofa_verified_at: null,
          twofa_secret: null,
          twofa_backup_codes: null,
        })
        .eq("user_id", adminId);

      if (error) {
        console.error("[2FA] Failed to disable 2FA:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[2FA] Disable 2FA error:", error);
      return false;
    }
  }

  /**
   * Rate limiting: Record failed attempt and check if locked
   */
  async recordFailedAttempt(
    adminId: string
  ): Promise<{
    locked: boolean;
    lockUntil?: Date;
    attempts: number;
  }> {
    try {
      const { data: existing } = await this.clientService
        .from("twofa_attempts")
        .select("*")
        .eq("admin_id", adminId)
        .single();

      const now = new Date();
      const twoFALockoutMinutes = 10;

      if (existing) {
        const lastAttempt = new Date(existing.last_attempt_at);
        const timeSinceLastAttempt = now.getTime() - lastAttempt.getTime();

        // Reset counter if more than 10 minutes have passed
        if (timeSinceLastAttempt > twoFALockoutMinutes * 60 * 1000) {
          // Window expired, reset counter
          await this.clientService
            .from("twofa_attempts")
            .update({
              attempt_count: 1,
              last_attempt_at: now.toISOString(),
              locked_until: null,
            })
            .eq("admin_id", adminId);

          return { locked: false, attempts: 1 };
        }

        // Increment counter
        const newCount = existing.attempt_count + 1;

        if (newCount >= 3) {
          // Lock admin for 10 minutes
          const lockUntil = new Date(
            now.getTime() + twoFALockoutMinutes * 60 * 1000
          );

          await this.clientService
            .from("twofa_attempts")
            .update({
              attempt_count: newCount,
              locked_until: lockUntil.toISOString(),
              last_attempt_at: now.toISOString(),
            })
            .eq("admin_id", adminId);

          return { locked: true, lockUntil, attempts: newCount };
        }

        // Not locked yet
        await this.clientService
          .from("twofa_attempts")
          .update({
            attempt_count: newCount,
            last_attempt_at: now.toISOString(),
          })
          .eq("admin_id", adminId);

        return { locked: false, attempts: newCount };
      } else {
        // First attempt for this admin
        await this.clientService
          .from("twofa_attempts")
          .insert({
            admin_id: adminId,
            attempt_count: 1,
            last_attempt_at: now.toISOString(),
          });

        return { locked: false, attempts: 1 };
      }
    } catch (error) {
      console.error("[2FA] Record attempt error:", error);
      return { locked: false, attempts: 0 };
    }
  }

  /**
   * Reset attempts after successful verification
   */
  async reset2FAAttempts(adminId: string): Promise<boolean> {
    try {
      await this.clientService
        .from("twofa_attempts")
        .update({
          attempt_count: 0,
          last_attempt_at: new Date().toISOString(),
          locked_until: null,
        })
        .eq("admin_id", adminId);

      return true;
    } catch (error) {
      console.error("[2FA] Reset attempts error:", error);
      return false;
    }
  }

  // Public accessors for use in routes
  getAnonClient(): SupabaseClient {
    return this.clientAnon;
  }

  getServiceClient(): SupabaseClient {
    return this.clientService;
  }
}

// Export singleton instance
export const supabase = new SupabaseService();
