/**
 * Admin Authentication Context
 * Handles admin-specific authentication with role verification
 * 
 * SECURITY HARDENED - Phase 2
 * - Session revocation checking
 * - Force logout capability
 * - Rate limiting on auth operations
 * - Session start tracking
 * - Real IP capture via Edge Function
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAuth } from '../lib/adminAuthClient';
import { adminAPIClient } from '../lib/apiClient';
import { 
  isSessionRevoked, 
  recordSessionStart, 
  clearSessionData,
  checkRateLimit,
  clearRateLimit,
  logSecurityEvent,
  getClientInfo,
  clearClientInfoCache
} from '../lib/securityUtils';
import toast from 'react-hot-toast';

const AdminAuthContext = createContext(null);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();

  // STEP 2.3: 2FA State (Hidden by Default)
  const [requires2FA, setRequires2FA] = useState(false);
  const [pending2FAUser, setPending2FAUser] = useState(null); // User waiting for 2FA verification

  // Current session tracking
  const currentSessionId = useRef(null);

  // Session timeout (30 minutes default)
  const SESSION_TIMEOUT = (adminProfile?.session_timeout_minutes || 30) * 60 * 1000;
  // Use ref so mouse/keyboard events don't trigger re-renders
  const lastActivityRef = useRef(Date.now());
  const [sessionRevoked, setSessionRevoked] = useState(false);

  // Check session revocation periodically
  const checkSessionRevocation = useCallback(async () => {
    if (!adminProfile?.id) return false;
    
    try {
      // securityUtils prefers backend API now; don't pass client-side supabase
      const revoked = await isSessionRevoked(undefined, adminProfile.id);
      if (revoked) {
        setSessionRevoked(true);
        toast.error('Your session has been revoked. Please contact an administrator.');
        await signOut('session_revoked');
        return true;
      }
    } catch (error) {
      console.error('Error checking session revocation:', error);
    }
    return false;
  }, [adminProfile?.id]);

  // Check admin access via BACKEND
  const verifyAdmin = useCallback(async (authUser, accessToken) => {
    if (!authUser || !accessToken) {
      console.log('[Admin Auth] Missing authUser or accessToken');
      setAdminProfile(null);
      return null;
    }

    try {
      // ✓ CRITICAL FIX: Call backend instead of querying Supabase directly
      // Backend will:
      // 1. Verify the access token
      // 2. Check admin_users table with service role
      // 3. Verify role and active status
      // 4. Return admin profile if valid
      
      console.log('[Admin Auth] Verifying admin with backend for:', authUser.email);
      adminAPIClient.setAccessToken(accessToken);
      
      // Add timeout to prevent hanging (with longer timeout for initial page load)
      const verifyPromise = adminAPIClient.auth.verify().catch(err => {
        console.error('[Admin Auth] Verify request failed:', err.message);
        throw err;
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          const timeoutErr = new Error('Backend verification timeout - /admin/auth/verify endpoint is slow or not responding');
          timeoutErr.isTimeout = true;
          reject(timeoutErr);
        }, 5000);
      });
      
      let response;
      try {
        response = await Promise.race([verifyPromise, timeoutPromise]);
      } catch (raceError) {
        console.error('[Admin Auth] Promise.race failed:', raceError.message);
        throw raceError;
      }
      
      console.log('[Admin Auth] Backend verification response:', response);
      
      if (!response || !response.admin) {
        console.warn('[Admin Auth] Verification returned no admin');
        setAdminProfile(null);
        return null;
      }

      const adminData = response.admin;

      if (!adminData.is_active) {
        console.warn('[Admin Auth] Admin account is deactivated:', adminData.email);
        setAdminProfile(null);
        return null;
      }

      // Check if 2FA is required
      if (response.requiresTwoFA) {
        console.log('[Admin Auth] 2FA required for:', adminData.email);
        setRequires2FA(true);
        setPending2FAUser(adminData);
        setAdminProfile(null); // Don't set profile yet
        return null;
      }

      console.log('[Admin Auth] Admin verified successfully:', adminData.email);
      setAdminProfile(adminData);
      setRequires2FA(false);
      return adminData;
    } catch (error) {
      console.error('[Admin Auth] Verification error:', {
        message: error.message,
        status: error.status,
        isTimeout: error.isTimeout,
      });
      
      // Ensure we don't leave UI in loading state
      setAdminProfile(null);
      setRequires2FA(false);
      
      // If backend fails, don't silently fail
      const message = error.data?.error || error.message || 'Verification failed. Backend may not be running.';
      console.error('[Admin Auth] Backend error details:', message);
      
      // FIX: Don't throw - just return null and log
      // This prevents crashing the error boundary
      if (error.isTimeout) {
        console.warn('[Admin Auth] Backend verification timed out - backend may not be running');
        // Don't show toast on timeout - user will see "Not authenticated" redirect instead
      } else if (error.status === 403) {
        toast.error('Access denied. You are not authorized as an admin.');
      } else if (error.status >= 500) {
        toast.error('Backend error. Please check that the backend server is running (npm run dev in backend/nodejs).');
      } else if (error.message?.includes('Access token not set')) {
        console.warn('[Admin Auth] No access token available');
      } else {
        // Only show generic error for unexpected issues
        console.warn('[Admin Auth] Verification failed:', message);
      }
      
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    let initTimeout;

    const initializeAuth = async () => {
      try {
        console.log('[ADMIN AUTH] Starting initialization...');
        
        // STEP 1: Get current Supabase session
        let session = null;
        try {
          session = await adminAuth.getSession();
          console.log('[ADMIN AUTH] Session fetch result:', {
            hasSession: !!session?.user,
            email: session?.user?.email,
            hasAccessToken: !!session?.access_token,
          });
        } catch (sessionError) {
          console.error('[ADMIN AUTH] Failed to get session:', sessionError.message);
          // Continue anyway - session might not exist yet
        }
        
        if (!mounted) return;
        
        // STEP 2: If we have a session, verify admin role
        if (session?.user && session?.access_token) {
          console.log('[ADMIN AUTH] Session found, verifying admin role:', session.user.email);
          setUser(session.user);
          
          try {
            const admin = await verifyAdmin(session.user, session.access_token);
            
            if (!mounted) return;
            
            if (admin) {
              console.log('[ADMIN AUTH] Admin verified:', admin.email);
              setAdminProfile(admin);
            } else if (!requires2FA) {
              console.log('[ADMIN AUTH] User is not an admin or verification failed, clearing session');
              // Not an admin and no 2FA pending, sign out
              try {
                await adminAuth.signOut();
              } catch (e) {
                console.error('[ADMIN AUTH] Error signing out:', e.message);
              }
              setUser(null);
              setAdminProfile(null);
            }
          } catch (verifyError) {
            console.error('[ADMIN AUTH] Unexpected error during verification:', verifyError.message);
            if (mounted) {
              setUser(null);
              setAdminProfile(null);
            }
          }
        } else {
          console.log('[ADMIN AUTH] No session found - user needs to login');
          setUser(null);
          setAdminProfile(null);
        }
      } catch (error) {
        console.error('[ADMIN AUTH] Unexpected initialization error:', error);
        if (mounted) {
          setUser(null);
          setAdminProfile(null);
          // Don't show toast here - just log
        }
      } finally {
        if (mounted) {
          console.log('[ADMIN AUTH] Initialization complete');
          setLoading(false);
          setInitializing(false);
        }
      }
    };

    // Add timeout to prevent indefinite loading state
    initTimeout = setTimeout(() => {
      if (mounted && initializing) {
        console.warn('[ADMIN AUTH] Initialization timeout after 10s - forcing completion');
        setLoading(false);
        setInitializing(false);
      }
    }, 10000); // 10 second timeout

    initializeAuth();

    // STEP 3: Listen for auth state changes (e.g., logout from another tab)
    const { data: { subscription } } = adminAuth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('[ADMIN AUTH] Auth state changed:', event);

        if (event === 'SIGNED_IN' && session?.user && session?.access_token) {
          console.log('[ADMIN AUTH] User signed in:', session.user.email);
          setUser(session.user);
          
          try {
            const admin = await verifyAdmin(session.user, session.access_token);
            
            if (!mounted) return;
            
            if (!admin && !requires2FA) {
              console.log('[ADMIN AUTH] Not an admin, denying access:', session.user.email);
              toast.error('Access denied. You are not authorized as an admin.');
              try {
                await adminAuth.signOut();
              } catch (e) {
                console.error('[ADMIN AUTH] Error signing out:', e.message);
              }
              setUser(null);
              setAdminProfile(null);
            } else if (admin) {
              console.log('[ADMIN AUTH] Admin signed in successfully:', admin.email);
              setAdminProfile(admin);
              toast.success(`Welcome, ${admin.full_name || admin.email}`);
              navigate('/admin', { replace: true });
            }
          } catch (error) {
            console.error('[ADMIN AUTH] Error verifying admin on sign in:', error.message);
            setUser(null);
            setAdminProfile(null);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('[ADMIN AUTH] User signed out');
          setUser(null);
          setAdminProfile(null);
          navigate('/admin/login', { replace: true });
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(initTimeout);
      subscription?.unsubscribe();
    };
  }, [verifyAdmin, requires2FA, navigate]);

  // Session timeout handler
  useEffect(() => {
    if (!adminProfile) return;

    const checkTimeout = async () => {
      const now = Date.now();
      
      // Check session timeout
      if (now - lastActivityRef.current > SESSION_TIMEOUT) {
        toast.error('Session expired. Please sign in again.');
        signOut('session_timeout');
        return;
      }
      
      // Check session revocation
      await checkSessionRevocation();
    };

    const interval = setInterval(checkTimeout, 60000); // Check every minute

    // Reset activity on user interaction - use ref to avoid state update re-renders
    const resetActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('mousemove', resetActivity);
    window.addEventListener('keydown', resetActivity);
    window.addEventListener('click', resetActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      window.removeEventListener('click', resetActivity);
    };
  }, [adminProfile, SESSION_TIMEOUT, checkSessionRevocation]);

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      
      // Rate limit check for login attempts
      const rateLimitKey = 'login:google-oauth';
      const rateCheck = checkRateLimit(rateLimitKey, 'analyst', 'login');
      if (!rateCheck.allowed) {
        toast.error(rateCheck.message);
        setLoading(false);
        return;
      }
      
      await adminAuth.signInWithGoogle();
    } catch (error) {
      console.error('Sign in error:', error);
      toast.error('Failed to sign in. Please try again.');
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async (reason = 'user_initiated') => {
    try {
      setLoading(true);
      
      // Log the sign out event
      if (adminProfile) {
        try {
          await logSecurityEvent(supabase, {
            adminId: adminProfile.id,
            adminEmail: adminProfile.email,
            adminRole: adminProfile.role,
            action: 'admin_signout',
            reason: reason,
            metadata: { signout_reason: reason }
          });
        } catch (logError) {
          console.warn('[ADMIN AUTH] Failed to log sign out event:', logError);
          // Continue with sign out even if logging fails
        }
      }
      
      // End the current session in database
      if (currentSessionId.current) {
        try {
          await adminAuth.endSession(currentSessionId.current);
          currentSessionId.current = null;
        } catch (sessionError) {
          console.warn('[ADMIN AUTH] Failed to end session:', sessionError);
          // Continue with sign out even if session end fails
        }
      }
      
      // Clear all session data and cache
      clearSessionData();
      clearClientInfoCache();
      
      // Attempt to sign out from Supabase
      try {
        await adminAuth.signOut();
      } catch (supabaseError) {
        console.warn('[ADMIN AUTH] Supabase sign out error:', supabaseError);
        // Continue even if Supabase sign out fails
      }
      
      // Force clear local state
      setUser(null);
      setAdminProfile(null);
      setSessionRevoked(false);
      
      if (reason === 'user_initiated') {
        toast.success('Signed out successfully');
      }
      
      // Redirect after state is cleared
      setTimeout(() => navigate('login', { replace: true }), 100);
    } catch (error) {
      console.error('[ADMIN AUTH] Sign out error:', error);
      // Even if there's an error, force clear state and redirect
      setUser(null);
      setAdminProfile(null);
      setSessionRevoked(false);
      toast.error('Failed to sign out completely');
      setTimeout(() => navigate('login', { replace: true }), 100);
    } finally {
      setLoading(false);
    }
  };

  // Check permissions
  const hasPermission = (requiredRole) => {
    if (!adminProfile) return false;

    const roleHierarchy = {
      super_admin: 3,
      moderator: 2,
      analyst: 1,
    };

    const userLevel = roleHierarchy[adminProfile.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    return userLevel >= requiredLevel;
  };

  // Check if user is super admin
  const isSuperAdmin = () => adminProfile?.role === 'super_admin';

  // Check if user is moderator or above
  const isModerator = () => hasPermission('moderator');

  // Check if user is analyst or above
  const isAnalyst = () => hasPermission('analyst');

  // Force logout a specific admin (Super Admin only)
  const forceLogoutUser = async (targetAdminId, reason) => {
    if (!isSuperAdmin()) {
      toast.error('Only Super Admins can force logout users');
      return { success: false };
    }
    
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .update({
          force_logout_at: new Date().toISOString(),
          force_logout_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetAdminId);
      
      if (error) throw error;
      
      // Log the security event
      await logSecurityEvent(supabase, {
        adminId: adminProfile.id,
        adminEmail: adminProfile.email,
        adminRole: adminProfile.role,
        action: 'force_logout_user',
        targetType: 'admin_user',
        targetId: targetAdminId,
        reason: reason,
        severity: 'warning',
        metadata: { forced_user_id: targetAdminId }
      });
      
      toast.success('User session revoked successfully');
      return { success: true };
    } catch (error) {
      console.error('Error forcing logout:', error);
      toast.error('Failed to revoke user session');
      return { success: false, error };
    }
  };

  const value = {
    user,
    adminProfile,
    loading,
    initializing,
    isAuthenticated: !!user && !!adminProfile,
    sessionRevoked,
    signInWithGoogle,
    signOut,
    hasPermission,
    isSuperAdmin,
    isModerator,
    isAnalyst,
    forceLogoutUser,
    checkSessionRevocation,
    // STEP 2.3: 2FA Support (Hidden by Default)
    requires2FA,
    setRequires2FA,
    pending2FAUser,
    setPending2FAUser,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export default AdminAuthContext;
