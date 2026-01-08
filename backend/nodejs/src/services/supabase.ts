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
   */
  async getAdminProfile(userId: string): Promise<AdminProfile | null> {
    try {
      const { data, error } = await this.clientService
        .from("admin_users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error || !data) {
        console.log("[AUTH] Admin not found:", userId);
        return null;
      }

      // Check if admin is inactive
      if (!data.is_active) {
        console.log("[AUTH] Admin inactive:", userId);
        return null;
      }

      // Check if force logout is set and current time is after it
      if (data.force_logout_at) {
        const forceLogoutTime = new Date(data.force_logout_at);
        if (new Date() >= forceLogoutTime) {
          console.log("[AUTH] Force logout triggered for:", userId);
          return null;
        }
      }

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
    resourceId?: string
  ): Promise<void> {
    try {
      await this.clientService.from("admin_audit_logs").insert({
        admin_id: adminId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        status,
        details,
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
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      await this.clientService.from("admin_login_history").insert({
        admin_id: adminId,
        login_at: new Date().toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
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
        .eq("id", adminId);

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
        .eq("id", adminId)
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
   * CRITICAL: Read-only operations
   */
  async getAnalyticsSummary(): Promise<any> {
    try {
      const [statsData, itemsData, claimsData, reportsData] = await Promise.all(
        [
          this.clientService.from("platform_statistics_daily").select("*"),
          this.clientService.from("items").select("id"),
          this.clientService.from("claims").select("id"),
          this.clientService.from("reports").select("id"),
        ]
      );

      return {
        totalItems: itemsData.data?.length || 0,
        totalClaims: claimsData.data?.length || 0,
        totalReports: reportsData.data?.length || 0,
        statistics: statsData.data || [],
      };
    } catch (error) {
      console.error("[ANALYTICS] Error fetching summary:", error);
      return null;
    }
  }

  /**
   * Get daily trend data
   */
  async getAnalyticsTrends(days: number = 30): Promise<any> {
    try {
      const { data, error } = await this.clientService
        .from("platform_statistics_daily")
        .select("*")
        .gte("date", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order("date", { ascending: true });

      if (error) {
        console.error("[ANALYTICS] Error fetching trends:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("[ANALYTICS] Error fetching trends:", error);
      return null;
    }
  }

  /**
   * Get geographic data (areas with activity)
   */
  async getAnalyticsAreas(): Promise<any> {
    try {
      const { data, error } = await this.clientService
        .from("items")
        .select("area, id")
        .eq("status", "active");

      if (error) {
        return null;
      }

      // Group by area
      const areaMap = new Map<string, number>();
      (data || []).forEach((item: any) => {
        const area = item.area || "Unknown";
        areaMap.set(area, (areaMap.get(area) || 0) + 1);
      });

      return Array.from(areaMap.entries()).map(([area, count]) => ({
        area,
        count,
      }));
    } catch (error) {
      console.error("[ANALYTICS] Error fetching areas:", error);
      return null;
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
