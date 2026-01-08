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
import { adminAuth, supabase } from '../lib/adminSupabase';
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

  // Current session tracking
  const currentSessionId = useRef(null);

  // Session timeout (30 minutes default)
  const SESSION_TIMEOUT = (adminProfile?.session_timeout_minutes || 30) * 60 * 1000;
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [sessionRevoked, setSessionRevoked] = useState(false);

  // Check session revocation periodically
  const checkSessionRevocation = useCallback(async () => {
    if (!adminProfile?.id) return false;
    
    try {
      const revoked = await isSessionRevoked(supabase, adminProfile.id);
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

  // Check admin access
  const verifyAdmin = useCallback(async (authUser) => {
    if (!authUser) {
      setAdminProfile(null);
      return null;
    }

    try {
      // Check admin_users table (don't wait for IP during auth - do it in background)
      const adminData = await adminAuth.getAdminProfile(authUser.id);
      
      if (!adminData) {
        // User is authenticated but not an admin
        console.warn('[Security] User is not an admin:', authUser.email);
        // Log attempt in background (non-blocking)
        adminAuth.logLoginAttempt(authUser.email, false, 'not_admin').catch(e => console.error('Log error:', e));
        return null;
      }

      if (!adminData.is_active) {
        console.warn('[Security] Admin account is deactivated:', authUser.email);
        adminAuth.logLoginAttempt(authUser.email, false, 'inactive_account').catch(e => console.error('Log error:', e));
        return null;
      }

      // Update last login (background, non-blocking)
      adminAuth.updateLastLogin(adminData.id).catch(e => console.error('Update login error:', e));
      adminAuth.logLoginAttempt(authUser.email, true).catch(e => console.error('Log error:', e));
      
      // Create session (background, non-blocking)
      adminAuth.createSession(adminData.id).then(session => {
        if (session) currentSessionId.current = session.id;
      }).catch(e => console.error('Session error:', e));
      
      // Record session start for revocation checking
      recordSessionStart();
      
      // Clear any login rate limits on success
      clearRateLimit(`login:${authUser.email}`);

      setAdminProfile(adminData);
      return adminData;
    } catch (error) {
      console.error('[Security] Error verifying admin:', error);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('[ADMIN AUTH] Starting initialization...');
        const session = await adminAuth.getSession();
        
        if (session?.user && mounted) {
          console.log('[ADMIN AUTH] Session found, verifying admin:', session.user.email);
          setUser(session.user);
          const admin = await verifyAdmin(session.user);
          
          if (!admin) {
            console.log('[ADMIN AUTH] User is not an admin, signing out:', session.user.email);
            // Not an admin, sign out
            await adminAuth.signOut();
            setUser(null);
          } else {
            console.log('[ADMIN AUTH] Admin verified:', admin.email);
            setAdminProfile(admin);
          }
        } else {
          console.log('[ADMIN AUTH] No session found');
        }
      } catch (error) {
        console.error('[ADMIN AUTH] Initialization error:', error);
      } finally {
        if (mounted) {
          console.log('[ADMIN AUTH] Initialization complete');
          setLoading(false);
          setInitializing(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = adminAuth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('[ADMIN AUTH] Auth state changed:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[ADMIN AUTH] User signed in:', session.user.email);
          setUser(session.user);
          const admin = await verifyAdmin(session.user);
          
          if (!admin) {
            console.log('[ADMIN AUTH] Not an admin, denying access:', session.user.email);
            toast.error('Access denied. You are not authorized as an admin.');
            await adminAuth.signOut();
            setUser(null);
            setAdminProfile(null);
            navigate('login', { replace: true });
          } else {
            console.log('[ADMIN AUTH] Admin signed in successfully:', admin.email);
            setAdminProfile(admin);
            toast.success(`Welcome, ${admin.full_name || admin.email}`);
            navigate('/admin', { replace: true });
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('[ADMIN AUTH] User signed out');
          setUser(null);
          setAdminProfile(null);
          navigate('login', { replace: true });
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Session timeout handler
  useEffect(() => {
    if (!adminProfile) return;

    const checkTimeout = async () => {
      const now = Date.now();
      
      // Check session timeout
      if (now - lastActivity > SESSION_TIMEOUT) {
        toast.error('Session expired. Please sign in again.');
        signOut('session_timeout');
        return;
      }
      
      // Check session revocation
      await checkSessionRevocation();
    };

    const interval = setInterval(checkTimeout, 60000); // Check every minute

    // Reset activity on user interaction
    const resetActivity = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', resetActivity);
    window.addEventListener('keydown', resetActivity);
    window.addEventListener('click', resetActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      window.removeEventListener('click', resetActivity);
    };
  }, [adminProfile, lastActivity, SESSION_TIMEOUT, checkSessionRevocation]);

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
        await logSecurityEvent(supabase, {
          adminId: adminProfile.id,
          adminEmail: adminProfile.email,
          adminRole: adminProfile.role,
          action: 'admin_signout',
          reason: reason,
          metadata: { signout_reason: reason }
        });
      }
      
      // End the current session in database
      if (currentSessionId.current) {
        await adminAuth.endSession(currentSessionId.current);
        currentSessionId.current = null;
      }
      
      // Clear all session data and cache
      clearSessionData();
      clearClientInfoCache();
      
      await adminAuth.signOut();
      setUser(null);
      setAdminProfile(null);
      setSessionRevoked(false);
      
      if (reason === 'user_initiated') {
        toast.success('Signed out successfully');
      }
      navigate('login', { replace: true });
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
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
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export default AdminAuthContext;
