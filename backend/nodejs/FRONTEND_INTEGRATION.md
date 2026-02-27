# Frontend Integration Guide

## 📋 Overview

This guide shows how to integrate your React frontend with the new Node.js backend.

---

## 1. Environment Setup

Create `.env.local` in `frontend/` directory:

```
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

For production:
```
VITE_API_URL=https://your-api.onrender.com
```

---

## 2. API Service Class

Create `frontend/src/lib/api.ts`:

```typescript
import { Session } from "@supabase/supabase-js";

class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // ============================================
  // AUTH ENDPOINTS
  // ============================================

  async verifyAdmin(token: string): Promise<{
    success: boolean;
    admin: { id: string; email: string; role: string };
    requiresTwoFA: boolean;
  }> {
    return this.request(
      "/api/admin/auth/verify",
      { method: "POST" },
      token
    );
  }

  async getAdminProfile(token: string): Promise<{
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    twoFAEnabled: boolean;
  }> {
    return this.request(
      "/api/admin/auth/profile",
      { method: "GET" },
      token
    );
  }

  async logout(token: string): Promise<{ success: boolean }> {
    return this.request(
      "/api/admin/auth/logout",
      { method: "POST" },
      token
    );
  }

  // ============================================
  // 2FA ENDPOINTS
  // ============================================

  async setup2FA(token: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    message: string;
  }> {
    return this.request(
      "/api/admin/2fa/setup",
      { method: "POST" },
      token
    );
  }

  async verify2FA(
    token: string,
    data: { secret: string; token: string }
  ): Promise<{ success: boolean; message: string }> {
    return this.request(
      "/api/admin/2fa/verify",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      token
    );
  }

  async check2FA(token: string): Promise<{
    requiresTwoFA: boolean;
    role: string;
  }> {
    return this.request(
      "/api/admin/2fa/check",
      { method: "POST" },
      token
    );
  }

  async verifyLogin2FA(token: string, code: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(
      "/api/admin/2fa/verify-login",
      {
        method: "POST",
        body: JSON.stringify({ token: code }),
      },
      token
    );
  }

  async disable2FA(token: string): Promise<{ success: boolean }> {
    return this.request(
      "/api/admin/2fa/disable",
      { method: "POST" },
      token
    );
  }

  // ============================================
  // ANALYTICS ENDPOINTS
  // ============================================

  async getAnalyticsSummary(token: string): Promise<any> {
    return this.request(
      "/api/admin/analytics/summary",
      { method: "GET" },
      token
    );
  }

  async getAnalyticsTrends(token: string, days: number = 30): Promise<any> {
    return this.request(
      `/api/admin/analytics/trends?days=${days}`,
      { method: "GET" },
      token
    );
  }

  async getAnalyticsAreas(token: string): Promise<any> {
    return this.request(
      "/api/admin/analytics/areas",
      { method: "GET" },
      token
    );
  }

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  async getAuditLogs(
    token: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<any> {
    return this.request(
      `/api/admin/audit-logs?limit=${limit}&offset=${offset}`,
      { method: "GET" },
      token
    );
  }

  async getLoginHistory(
    token: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<any> {
    return this.request(
      `/api/admin/login-history?limit=${limit}&offset=${offset}`,
      { method: "GET" },
      token
    );
  }
}

// Export singleton
export const apiClient = new APIClient(
  import.meta.env.VITE_API_URL || "http://localhost:3000"
);
```

---

## 3. Update AdminAuthContext

Modify `frontend/src/contexts/AdminAuthContext.jsx`:

```javascript
import { createContext, useState, useEffect, useCallback } from "react";
import { supabaseAdmin } from "../lib/supabase";
import { apiClient } from "../lib/api";

export const AdminAuthContext = createContext();

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize auth
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabaseAdmin.auth.getSession();

        if (!session?.access_token) {
          setLoading(false);
          return;
        }

        // Call backend to verify admin
        const result = await apiClient.verifyAdmin(session.access_token);

        setUser(session.user);
        setIsAuthenticated(true);
        setLoading(false);

        // If 2FA required, frontend will handle that separately
        if (result.requiresTwoFA) {
          localStorage.setItem("pending2FA", "true");
        } else {
          localStorage.removeItem("pending2FA");
        }
      } catch (error) {
        console.error("[ADMIN AUTH] Verification failed:", error);
        setLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const { error } = await supabaseAdmin.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/admin/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error("[ADMIN AUTH] Sign in error:", error);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabaseAdmin.auth.signOut();
      setUser(null);
      setAdminProfile(null);
      setIsAuthenticated(false);
      localStorage.removeItem("pending2FA");
    } catch (error) {
      console.error("[ADMIN AUTH] Sign out error:", error);
    }
  }, []);

  const hasPermission = useCallback((requiredRole) => {
    if (!adminProfile) return false;
    if (!adminProfile.is_active) return false;

    const roleHierarchy = {
      super_admin: 3,
      moderator: 2,
      analyst: 1,
    };

    return (
      (roleHierarchy[adminProfile.role] || 0) >=
      (roleHierarchy[requiredRole] || 0)
    );
  }, [adminProfile]);

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        adminProfile,
        isAuthenticated,
        loading,
        signInWithGoogle,
        signOut,
        hasPermission,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}
```

---

## 4. Update Admin Login Page

Modify `frontend/src/pages/admin/AdminLoginPage.jsx`:

```javascript
import { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminAuthContext } from "../../contexts/AdminAuthContext";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading, signInWithGoogle } =
    useContext(AdminAuthContext);

  useEffect(() => {
    // If authenticated, check for 2FA requirement
    if (isAuthenticated && !loading) {
      const pending2FA = localStorage.getItem("pending2FA");
      if (pending2FA === "true") {
        navigate("/admin/2fa");
      } else {
        navigate("/admin");
      }
    }
  }, [isAuthenticated, loading]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="login-container">
      <h1>Admin Login</h1>
      <button onClick={signInWithGoogle}>Sign in with Google</button>
    </div>
  );
}
```

---

## 5. Add 2FA Page (New)

Create `frontend/src/pages/admin/AdminTwoFAPage.jsx`:

```javascript
import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminAuthContext } from "../../contexts/AdminAuthContext";
import { apiClient } from "../../lib/api";
import { supabaseAdmin } from "../../lib/supabase";

export default function AdminTwoFAPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useContext(AdminAuthContext);
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) {
    navigate("/admin/login");
    return null;
  }

  const handleVerify = async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabaseAdmin.auth.getSession();

      if (!session?.access_token) throw new Error("No token");

      await apiClient.verifyLogin2FA(session.access_token, code);

      localStorage.removeItem("pending2FA");
      navigate("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="2fa-container">
      <h1>Two-Factor Authentication</h1>
      <p>Enter the 6-digit code from your authenticator app</p>

      <input
        type="text"
        maxLength="6"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="000000"
      />

      {error && <div className="error">{error}</div>}

      <button onClick={handleVerify} disabled={loading || code.length !== 6}>
        {loading ? "Verifying..." : "Verify"}
      </button>
    </div>
  );
}
```

---

## 6. Add 2FA Setup (For Super Admin)

Create `frontend/src/pages/admin/AdminSecurityPage.jsx`:

```javascript
import { useContext, useState } from "react";
import { AdminAuthContext } from "../../contexts/AdminAuthContext";
import { apiClient } from "../../lib/api";
import { supabaseAdmin } from "../../lib/supabase";

export default function AdminSecurityPage() {
  const { adminProfile } = useContext(AdminAuthContext);
  const [showQR, setShowQR] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [verifyCode, setVerifyCode] = useState("");

  if (adminProfile?.role !== "super_admin") {
    return <div>Access denied</div>;
  }

  const handleSetup2FA = async () => {
    try {
      const {
        data: { session },
      } = await supabaseAdmin.auth.getSession();

      const result = await apiClient.setup2FA(session.access_token);

      setQrCode(result.qrCodeUrl);
      setShowQR(true);
    } catch (error) {
      console.error("Setup 2FA error:", error);
    }
  };

  const handleVerify2FA = async () => {
    try {
      const {
        data: { session },
      } = await supabaseAdmin.auth.getSession();

      await apiClient.verify2FA(session.access_token, {
        secret: qrCode, // You'll need to extract this from QR setup
        token: verifyCode,
      });

      setShowQR(false);
      setVerifyCode("");
      alert("2FA enabled!");
    } catch (error) {
      console.error("Verify 2FA error:", error);
    }
  };

  return (
    <div className="security-container">
      <h1>Security Settings</h1>

      {!showQR ? (
        <button onClick={handleSetup2FA}>Setup 2FA</button>
      ) : (
        <div>
          <img src={qrCode} alt="QR Code" />
          <input
            type="text"
            placeholder="6-digit code"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            maxLength="6"
          />
          <button onClick={handleVerify2FA}>Verify</button>
        </div>
      )}
    </div>
  );
}
```

---

## 7. Update Routes

Add to `frontend/src/App.jsx`:

```javascript
import AdminTwoFAPage from "./pages/admin/AdminTwoFAPage";
import AdminSecurityPage from "./pages/admin/AdminSecurityPage";

// In your admin routes:
<Route path="/admin/2fa" element={<AdminTwoFAPage />} />
<Route path="/admin/security" element={<ProtectedRoute><AdminSecurityPage /></ProtectedRoute>} />
```

---

## 8. Error Handling

Catch API errors properly:

```javascript
try {
  const result = await apiClient.getAnalyticsSummary(token);
} catch (error) {
  if (error.message.includes("401")) {
    // Token expired - redirect to login
    navigate("/admin/login");
  } else if (error.message.includes("403")) {
    // Permission denied
    toast.error("You don't have permission to access this");
  } else {
    // Other error
    toast.error(error.message);
  }
}
```

---

## ✅ Testing Checklist

- [ ] Backend running: `npm run dev` in `backend/nodejs/`
- [ ] Frontend running: `npm run dev` in `frontend/`
- [ ] `VITE_API_URL` set in frontend `.env.local`
- [ ] Google OAuth configured in Supabase
- [ ] Admin user exists in `admin_users` table
- [ ] Admin user has `is_active = true`
- [ ] Login flow works
- [ ] 2FA setup works (for super_admin)
- [ ] Analytics endpoints return data

---

**You're ready to integrate! 🎉**
