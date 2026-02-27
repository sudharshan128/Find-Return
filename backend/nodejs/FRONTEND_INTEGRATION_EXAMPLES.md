# 📱 FRONTEND INTEGRATION EXAMPLES

**Framework:** React + TypeScript  
**Auth:** Supabase OAuth (unchanged)  
**API Client:** Fetch API or Axios  

---

## ✅ CHECKLIST: What Stays the Same

- ✅ `AdminAuthContext` - **NO CHANGES**
- ✅ `ProtectedRoute` - **NO CHANGES**
- ✅ Supabase OAuth flow - **NO CHANGES**
- ✅ Loading states - **NO CHANGES**
- ✅ Error handling UI - **NO CHANGES**
- ✅ Session management - **NO CHANGES**

---

## 📝 Example 1: Simple Fetch Helper

**File:** `src/api/backendClient.ts`

```typescript
/**
 * Backend API Client
 * Handles:
 * - Authorization header (Bearer token)
 * - Error handling
 * - JSON parsing
 * - Type safety
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3000";

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export async function backendFetch<T>(
  endpoint: string,
  accessToken: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        ...options?.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data as ApiError,
      };
    }

    return {
      success: true,
      data: data as T,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        error: error instanceof Error ? error.message : "Unknown error",
        code: "FETCH_ERROR",
      },
    };
  }
}

// Convenience methods
export const backendApi = {
  get: <T,>(
    endpoint: string,
    accessToken: string
  ) => backendFetch<T>(endpoint, accessToken, { method: "GET" }),

  post: <T,>(
    endpoint: string,
    accessToken: string,
    body?: unknown
  ) =>
    backendFetch<T>(endpoint, accessToken, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T,>(
    endpoint: string,
    accessToken: string,
    body?: unknown
  ) =>
    backendFetch<T>(endpoint, accessToken, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T,>(
    endpoint: string,
    accessToken: string
  ) => backendFetch<T>(endpoint, accessToken, { method: "DELETE" }),
};
```

**Usage:**
```typescript
import { backendApi } from "@/api/backendClient";

const { success, data, error } = await backendApi.get<AnalyticsSummary>(
  "/api/admin/analytics/summary",
  accessToken
);

if (!success) {
  console.error("Error:", error?.error);
  return;
}

console.log("Analytics:", data);
```

---

## 🎯 Example 2: Admin Dashboard Component

**File:** `src/pages/AdminDashboard.tsx`

```typescript
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { backendApi } from "@/api/backendClient";

interface AnalyticsSummary {
  total_items: number;
  total_claims: number;
  active_users: number;
  pending_items: number;
  successful_claims: number;
  avg_claim_time_hours: number;
}

export function AdminDashboard() {
  // UNCHANGED: Use existing auth context
  const { session, loading: authLoading } = useAdminAuth();

  // API state
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Fetch data when session available
  useEffect(() => {
    if (!session?.access_token) return;

    fetchAnalytics();
  }, [session?.access_token]);

  async function fetchAnalytics() {
    try {
      setApiLoading(true);
      setApiError(null);

      // Call backend API instead of Supabase
      const { success, data, error } = await backendApi.get<AnalyticsSummary>(
        "/api/admin/analytics/summary",
        session!.access_token
      );

      if (!success) {
        setApiError(error?.error || "Failed to fetch analytics");
        return;
      }

      setAnalytics(data || null);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setApiLoading(false);
    }
  }

  // UNCHANGED: Reuse existing loading state UI
  if (authLoading) {
    return <div className="p-4">Loading...</div>;
  }

  // UNCHANGED: Reuse existing error state UI
  if (apiError) {
    return (
      <div className="p-4 bg-red-50 text-red-800">
        <p>Error: {apiError}</p>
        <button onClick={fetchAnalytics} className="mt-2">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {analytics ? (
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Total Items"
            value={analytics.total_items}
          />
          <StatCard
            label="Total Claims"
            value={analytics.total_claims}
          />
          <StatCard
            label="Active Users"
            value={analytics.active_users}
          />
          <StatCard
            label="Pending Items"
            value={analytics.pending_items}
          />
          <StatCard
            label="Successful Claims"
            value={analytics.successful_claims}
          />
          <StatCard
            label="Avg Claim Time (hrs)"
            value={analytics.avg_claim_time_hours.toFixed(1)}
          />
        </div>
      ) : (
        <div>No data available</div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="p-4 bg-white rounded-lg border">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}
```

---

## 🔐 Example 3: Admin Actions (Super Admin Only)

**File:** `src/pages/AdminUsers.tsx`

```typescript
import { useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { backendApi } from "@/api/backendClient";

interface BanUserRequest {
  reason: string;
}

export function AdminUsers() {
  const { session } = useAdminAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banLoading, setBanLoading] = useState(false);
  const [banError, setBanError] = useState<string | null>(null);

  async function handleBanUser(userId: string) {
    if (!session?.access_token) return;

    try {
      setBanLoading(true);
      setBanError(null);

      // Call backend API to ban user
      const { success, error } = await backendApi.post<void>(
        `/api/admin/users/${userId}/ban`,
        session.access_token,
        { reason: banReason } as BanUserRequest
      );

      if (!success) {
        setBanError(error?.error || "Failed to ban user");
        return;
      }

      alert("User banned successfully");
      setSelectedUserId(null);
      setBanReason("");
    } catch (err) {
      setBanError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBanLoading(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      {selectedUserId && (
        <div className="p-4 bg-yellow-50 border rounded-lg mb-6">
          <h2 className="font-bold mb-4">Ban User</h2>

          {banError && (
            <div className="p-2 bg-red-100 text-red-800 rounded mb-4">
              {banError}
            </div>
          )}

          <textarea
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Reason for banning..."
            className="w-full p-2 border rounded mb-4"
          />

          <button
            onClick={() => handleBanUser(selectedUserId)}
            disabled={banLoading || !banReason}
            className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {banLoading ? "Banning..." : "Confirm Ban"}
          </button>

          <button
            onClick={() => setSelectedUserId(null)}
            className="ml-2 px-4 py-2 border rounded"
          >
            Cancel
          </button>
        </div>
      )}

      {/* User list goes here */}
    </div>
  );
}
```

---

## 🎣 Example 4: React Query Integration (Optional)

**File:** `src/hooks/useAdminApi.ts`

```typescript
import { useQuery, useMutation, UseQueryResult } from "@tanstack/react-query";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { backendApi } from "@/api/backendClient";

/**
 * Hook for admin API queries
 * Automatically includes access token
 * Handles loading, error, and caching
 */
export function useAdminQuery<T>(
  endpoint: string,
  enabled = true
): UseQueryResult<T> {
  const { session } = useAdminAuth();

  return useQuery({
    queryKey: [endpoint],
    queryFn: async () => {
      const { success, data, error } = await backendApi.get<T>(
        endpoint,
        session!.access_token
      );

      if (!success) {
        throw new Error(error?.error || "API error");
      }

      return data as T;
    },
    enabled: enabled && !!session?.access_token,
  });
}

/**
 * Hook for admin API mutations (POST, PUT, DELETE)
 */
export function useAdminMutation<T>(
  method: "post" | "put" | "delete" = "post"
) {
  const { session } = useAdminAuth();

  return useMutation({
    mutationFn: async ({
      endpoint,
      body,
    }: {
      endpoint: string;
      body?: unknown;
    }) => {
      const { success, data, error } = await backendApi[method]<T>(
        endpoint,
        session!.access_token,
        body
      );

      if (!success) {
        throw new Error(error?.error || "API error");
      }

      return data as T;
    },
  });
}
```

**Usage:**
```typescript
import { useAdminQuery, useAdminMutation } from "@/hooks/useAdminApi";

export function MyComponent() {
  // Query
  const { data: analytics, isLoading } = useAdminQuery<AnalyticsSummary>(
    "/api/admin/analytics/summary"
  );

  // Mutation
  const banUserMutation = useAdminMutation("post");

  const handleBan = async (userId: string) => {
    await banUserMutation.mutateAsync({
      endpoint: `/api/admin/users/${userId}/ban`,
      body: { reason: "Spam" },
    });
  };

  return <div>{/* UI */}</div>;
}
```

---

## 🔌 Example 5: Axios Integration (Alternative)

**File:** `src/api/axiosClient.ts`

```typescript
import axios from "axios";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3000";

const axiosClient = axios.create({
  baseURL: BACKEND_URL,
});

// Interceptor to add access token
export function setupAxiosInterceptors() {
  axiosClient.interceptors.request.use((config) => {
    // Get from context or localStorage
    const token = localStorage.getItem("sb-access-token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  // Error interceptor for 401/403
  axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Token expired, redirect to login
        window.location.href = "/login";
      }

      return Promise.reject(error);
    }
  );
}

export default axiosClient;
```

**Usage:**
```typescript
import axiosClient, { setupAxiosInterceptors } from "@/api/axiosClient";

// In App.tsx or main.tsx
setupAxiosInterceptors();

// In components
const { data: analytics } = await axiosClient.get("/api/admin/analytics/summary");
```

---

## 🛡️ Example 6: Error Handling Best Practices

**File:** `src/components/AdminApiError.tsx`

```typescript
export interface BackendError {
  error: string;
  code: string;
  details?: unknown;
}

export function AdminApiError({ error }: { error: BackendError | null }) {
  if (!error) return null;

  // Map error codes to user-friendly messages
  const messages: Record<string, string> = {
    MISSING_TOKEN: "Please log in again",
    INVALID_TOKEN: "Your session has expired",
    FORBIDDEN: "You don't have permission for this action",
    NOT_FOUND: "Resource not found",
    INTERNAL_ERROR: "Server error, please try again",
    RATE_LIMITED: "Too many requests, please wait",
  };

  const message = messages[error.code] || error.error;

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <p className="font-semibold text-red-800">Error</p>
      <p className="text-red-700 mt-1">{message}</p>
      {process.env.NODE_ENV === "development" && (
        <details className="mt-2 text-xs text-red-600">
          <summary>Details</summary>
          <pre className="mt-1 bg-white p-2 rounded">
            {JSON.stringify(error, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
```

---

## 📋 Migration Checklist

### Before Integration
- [ ] Backend running on `http://localhost:3000`
- [ ] Frontend can access `process.env.REACT_APP_BACKEND_URL`
- [ ] Supabase OAuth still works

### Add Backend Client
- [ ] Create `src/api/backendClient.ts`
- [ ] Test with `backendApi.get()` in console

### Update API Calls
- [ ] List all Supabase direct queries
- [ ] Replace with backend API calls
- [ ] Test each endpoint

### Error Handling
- [ ] Use `AdminApiError` component
- [ ] Handle 401 (expired token)
- [ ] Handle 403 (not admin)
- [ ] Handle 500 (server error)

### Deploy
- [ ] Set `REACT_APP_BACKEND_URL` in production
- [ ] Test login → data fetch flow
- [ ] Verify non-admin users get 403

---

## 🚀 Common Patterns

### Pattern 1: Loading State with Skeleton
```typescript
import { Skeleton } from "@/components/Skeleton";

export function AdminStats() {
  const { data: analytics, isLoading } = useAdminQuery<Analytics>(
    "/api/admin/analytics/summary"
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return <div>{/* Real content */}</div>;
}
```

### Pattern 2: Optimistic Updates
```typescript
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: banUserMutation,
  onMutate: async (userId) => {
    // Optimistically update UI
    await queryClient.cancelQueries({ queryKey: ["/api/admin/users"] });
    const prev = queryClient.getQueryData(["/api/admin/users"]);

    queryClient.setQueryData(["/api/admin/users"], (old: any) =>
      old.filter((u: any) => u.id !== userId)
    );

    return { prev };
  },
  onError: (err, userId, context) => {
    // Rollback on error
    if (context?.prev) {
      queryClient.setQueryData(["/api/admin/users"], context.prev);
    }
  },
});
```

### Pattern 3: Infinite Scroll
```typescript
import { useInfiniteQuery } from "@tanstack/react-query";

const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ["audit-logs"],
  queryFn: ({ pageParam = 0 }) =>
    backendApi.get(`/api/admin/audit-logs?page=${pageParam}`, token),
  getNextPageParam: (lastPage, pages) => pages.length,
});
```

---

## ✅ Validation

**Test these scenarios:**

1. ✅ User logs in → Access token obtained
2. ✅ Frontend calls `/api/admin/analytics/summary`
3. ✅ Backend receives Authorization header
4. ✅ Backend verifies JWT
5. ✅ Backend checks admin status
6. ✅ Data returned to frontend
7. ✅ Non-admin user gets 403
8. ✅ Expired token gets 401
9. ✅ Missing token gets 401

---

## 📚 Reference

| File | Purpose |
|------|---------|
| `src/api/backendClient.ts` | HTTP client with auth header |
| `src/hooks/useAdminApi.ts` | React Query hooks |
| `src/api/axiosClient.ts` | Axios setup (alternative) |
| `src/components/AdminApiError.tsx` | Error display |
| `src/pages/AdminDashboard.tsx` | Example page |

---

**Status:** ✅ **EXAMPLES COMPLETE & READY TO USE**

