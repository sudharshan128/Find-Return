import { User } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      adminProfile?: {
        id: string;
        email: string;
        role: "super_admin" | "moderator" | "analyst";
        is_active: boolean;
        twofa_enabled: boolean;
        twofa_verified_at: string | null;
      };
      clientIp?: string;
      userAgent?: string;
    }
  }
}

export interface AdminProfile {
  id: string;
  email: string;
  role: "super_admin" | "moderator" | "analyst";
  is_active: boolean;
  twofa_enabled: boolean;
  twofa_secret: string | null;
  twofa_verified_at: string | null;
  force_logout_at: string | null;
}

export interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  status: "success" | "failure";
  details: Record<string, any>;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export interface LoginHistory {
  id: string;
  admin_id: string;
  login_at: string;
  logout_at?: string;
  ip_address: string;
  user_agent: string;
}
