/**
 * Authentication Context
 * Manages user authentication state using Supabase
 * Handles Google OAuth, session management, and user profiles
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, db, supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [dbReady, setDbReady] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  // Fetch user profile from database
  const fetchProfile = useCallback(async (userId) => {
    try {
      console.log('[AUTH] Fetching profile for user:', userId);
      
      // Add timeout to profile fetch - max 5 seconds for better UX
      const profilePromise = db.users.get(userId);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout after 5s')), 5000)
      );
      
      const data = await Promise.race([profilePromise, timeoutPromise]);
      setProfile(data);
      setDbReady(true);
      console.log('[AUTH] Profile fetched successfully');
      return data;
    } catch (error) {
      console.error('[AUTH] Error fetching profile:', error);
      
      // Check if it's a "not found" error (404 / PGRST116)
      if (error.code === 'PGRST116' || error.message?.includes('rows')) {
        console.log('[AUTH] User profile not found, auto-creating...');
        try {
          // Get the user object from auth
          const user = await auth.getUser();
          if (user) {
            // Create profile automatically
            const { data: newProfile, error: createError } = await supabase
              .from('user_profiles')
              .insert({
                user_id: userId,
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email.split('@')[0],
                avatar_url: user.user_metadata?.avatar_url || null,
                role: 'user',
                account_status: 'active',
                trust_score: 100,
              })
              .select()
              .single();
            
            if (createError) {
              console.error('[AUTH] Failed to create profile:', createError);
              throw createError;
            }
            
            console.log('[AUTH] Profile auto-created successfully');
            setProfile(newProfile);
            setDbReady(true);
            return newProfile;
          }
        } catch (createErr) {
          console.error('[AUTH] Auto-create profile failed:', createErr);
          setDbReady(false);
          setProfile(null);
          return null;
        }
      }
      
      // Check if it's a "table doesn't exist" error
      if (error.message?.includes('relation') || error.code === '42P01') {
        console.warn('[AUTH] Database tables not set up yet. Please run the SQL migration.');
        setDbReady(false);
      }
      setProfile(null);
      return null;
    }
  }, []);

  // Initialize auth state - CRITICAL FIX: Ensure loading is set to false in all paths
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        console.log('[AUTH] Starting auth initialization...');
        const session = await auth.getSession();
        
        if (!mounted) return;

        if (session?.user) {
          console.log('[AUTH] Session found, user:', session.user.email);
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          console.log('[AUTH] No session found');
          setUser(null);
          setProfile(null);
        }
        setSessionError(null);
      } catch (error) {
        console.error('[AUTH] Auth init error:', error);
        if (mounted) {
          setSessionError(error.message);
          setUser(null);
          setProfile(null);
        }
      } finally {
        // CRITICAL: Always set loading to false, in both success and error paths
        if (mounted) {
          console.log('[AUTH] Auth initialization complete');
          setInitializing(false);
          setLoading(false);
        }
      }
    };

    initAuth();

    // Safety timeout: force initializing to false after 5 seconds
    // This prevents infinite loading if auth gets stuck
    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn('[AUTH] Timeout: Forcing initializing to false after 5s');
        setInitializing(false);
        setLoading(false);
      }
    }, 5000);

    // Cleanup
    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [fetchProfile]);

  // Listen to auth state changes
  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] Auth event:', event);
        
        try {
          if (event === 'INITIAL_SESSION' || (event === 'SIGNED_IN' && session?.user)) {
            console.log('[AUTH] User signed in:', session?.user?.email);
            if (mounted && session?.user) {
              setUser(session.user);
              console.log('[AUTH] About to fetch profile...');
              try {
                await fetchProfile(session.user.id);
                console.log('[AUTH] Profile fetch completed');
              } catch (profileErr) {
                console.error('[AUTH] Profile fetch failed:', profileErr);
              }
              setSessionError(null);
              console.log('[AUTH] Setting initializing to false');
              setInitializing(false); // Mark init complete after profile fetched
              if (event === 'SIGNED_IN') {
                toast.success('Welcome!');
              }
            }
          } else if (event === 'SIGNED_OUT') {
            console.log('[AUTH] User signed out');
            if (mounted) {
              setUser(null);
              setProfile(null);
              setSessionError(null);
              setInitializing(false); // Mark init complete
              toast.success('Signed out successfully');
            }
          } else if (event === 'USER_UPDATED' && session?.user) {
            console.log('[AUTH] User updated');
            if (mounted) setUser(session.user);
            await fetchProfile(session.user.id);
          } else if (event === 'TOKEN_REFRESHED') {
            // Token refreshed successfully
            if (mounted) setSessionError(null);
          } else if (event === 'PASSWORD_RECOVERY') {
            // Handle password recovery if needed
          }
        } catch (error) {
          console.error('[AUTH] Error handling auth event:', error);
          if (mounted) {
            setSessionError(error.message);
            console.log('[AUTH] Setting initializing to false due to error');
            setInitializing(false); // Mark init complete even on error
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  // Sign in with Google
  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      await auth.signInWithGoogle();
    } catch (error) {
      console.error('Sign in error:', error);
      toast.error('Failed to sign in with Google');
      setLoading(false);
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    setLoading(true);
    try {
      // Attempt to sign out from Supabase
      await auth.signOut();
      
      // Force clear local state
      setUser(null);
      setProfile(null);
      setInitializing(false);
      setSessionError(null);
      
      console.log('[AUTH] Sign out successful');
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('[AUTH] Sign out error:', error);
      
      // Even if remote sign out fails, clear local state
      setUser(null);
      setProfile(null);
      setInitializing(false);
      setSessionError(error.message || 'Sign out failed');
      
      // Still show success if local state cleared, as session is effectively ended
      if (error.message?.includes('network') || error.message?.includes('timeout')) {
        console.log('[AUTH] Network error during sign out, but local session cleared');
        toast.success('Signed out (offline)');
      } else {
        toast.error('Failed to sign out completely');
        throw error;
      }
    } finally {
      setLoading(false);
    }
  };

  // Update profile
  const updateProfile = async (updates) => {
    if (!user) throw new Error('Not authenticated');
    
    try {
      const data = await db.users.update(user.id, updates);
      setProfile(data);
      toast.success('Profile updated');
      return data;
    } catch (error) {
      console.error('Update profile error:', error);
      toast.error('Failed to update profile');
      throw error;
    }
  };

  // Refresh profile
  const refreshProfile = async () => {
    if (!user) return null;
    return fetchProfile(user.id);
  };

  // Check if user is admin
  const isAdmin = profile?.role === 'admin';

  // Check if user is banned
  const isBanned = profile?.is_banned === true;

  const value = {
    user,
    profile,
    loading,
    initializing,
    authLoading: initializing,  // Alias for backward compatibility
    dbReady,
    sessionError,
    isAuthenticated: !!user,
    hasProfile: !!profile,
    isAdmin,
    isBanned,
    signInWithGoogle,
    signOut,
    updateProfile,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
