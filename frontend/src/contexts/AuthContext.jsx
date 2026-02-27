/**
 * Authentication Context
 * Manages user authentication state using Supabase
 * Handles Google OAuth, session management, and user profiles
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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

  // Build a minimal in-memory profile from auth metadata (used as fallback when DB is unreachable)
  const buildFallbackProfile = useCallback((authUser) => {
    if (!authUser) return null;
    return {
      user_id: authUser.id,
      email: authUser.email,
      full_name:
        authUser.user_metadata?.full_name ||
        authUser.email?.split('@')[0] ||
        'User',
      avatar_url: authUser.user_metadata?.avatar_url || null,
      role: 'user',
      account_status: 'active',
      trust_score: 50,
      _isFallback: true, // flag so UI can show a soft warning if desired
    };
  }, []);

  // Fetch user profile from database
  const fetchProfile = useCallback(async (userId) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      console.log('[AUTH] Fetching profile for user:', userId);

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (error) throw error;
      console.log('[AUTH] Profile fetched successfully:', data);

      // Auto-patch null email / full_name from auth metadata so the
      // profile always has these fields populated, even for older rows.
      if (!data.email || !data.full_name) {
        try {
          const authUser = await auth.getUser();
          if (authUser) {
            const patches = {};
            if (!data.email && authUser.email) patches.email = authUser.email;
            if (!data.full_name) {
              patches.full_name =
                authUser.user_metadata?.full_name ||
                authUser.email?.split('@')[0] ||
                'User';
            }
            if (Object.keys(patches).length > 0) {
              const { data: patched, error: patchErr } = await supabase
                .from('user_profiles')
                .update(patches)
                .eq('user_id', userId)
                .select()
                .single();
              if (!patchErr && patched) {
                console.log('[AUTH] Patched missing profile fields:', patches);
                setProfile(patched);
                setDbReady(true);
                return patched;
              }
            }
          }
        } catch (patchErr) {
          console.warn('[AUTH] Could not auto-patch profile fields:', patchErr);
        }
      }

      setProfile(data);
      setDbReady(true);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[AUTH] Error fetching profile:', error);

      // AbortError = our 8s timeout fired — fall through to fallback below
      const isTimeout = error.name === 'AbortError' || error.message?.includes('timeout');
      const isNetwork = error.message?.includes('network') || error.message?.includes('Failed to fetch');

      // Check if it's a "not found" error (404 / PGRST116)
      if (error.code === 'PGRST116' || error.message?.includes('rows')) {
        try {
          // Get the user object from auth
          const user = await auth.getUser();
          if (user) {
            // Fetch default trust score from settings
            let defaultTrustScore = 50; // Fallback default
            try {
              const { data: settingsData } = await supabase
                .from('system_settings')
                .select('setting_value')
                .eq('setting_key', 'default_trust_score')
                .single();
              if (settingsData?.setting_value) {
                defaultTrustScore = settingsData.setting_value;
              }
            } catch (settingsErr) {
              // use fallback
            }

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
                trust_score: defaultTrustScore,
              })
              .select()
              .single();
            
            if (createError) {
              console.error('[AUTH] Failed to create profile:', createError);
              throw createError;
            }
            
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

      // Timeout or network error — use auth metadata as a fallback profile so
      // the app stays functional instead of rendering everything as null.
      if (isTimeout || isNetwork) {
        try {
          const authUser = await auth.getUser();
          if (authUser) {
            const fallback = buildFallbackProfile(authUser);
            console.warn('[AUTH] Using fallback profile from auth metadata due to DB timeout:', fallback);
            setProfile(fallback);
            setDbReady(false);
            return fallback;
          }
        } catch (authErr) {
          console.error('[AUTH] Could not build fallback profile:', authErr);
        }
      }

      setProfile(null);
      return null;
    }
  }, [buildFallbackProfile]);

  // Ref to prevent duplicate profile fetches from concurrent auth events
  const profileFetchingRef = useRef(false);
  // Suppress auth events fired during the startup clear (avoids spurious toasts)
  const startingUpRef = useRef(true);

  // Initialize auth state — always starts logged out.
  // In-memory session storage means there is nothing to restore on a fresh page
  // load or refresh; the only way a session exists here is if we're mid-flow
  // within the same tab (e.g. OAuth callback redirect chain).
  useEffect(() => {
    let mounted = true;

    // One-time cleanup: remove any stale Supabase tokens that may have been
    // written to localStorage by a previous version of this app.
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-'))
      .forEach(k => localStorage.removeItem(k));

    const initAuth = async () => {
      try {
        const session = await auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          // Mid-flow session (e.g. OAuth callback just processed the URL hash);
          // let the SIGNED_IN event handler take care of setting user + profile.
        } else {
          // No session in memory — start clean (normal path on every page load).
          setUser(null);
          setProfile(null);
        }
      } catch (_) {
        // Ignore — in-memory storage never throws, but guard anyway.
      }

      if (mounted) {
        setSessionError(null);
        setInitializing(false);
        setLoading(false);
        startingUpRef.current = false;
      }
    };

    initAuth();

    return () => { mounted = false; };
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = auth.onAuthStateChange(
      async (event, session) => {
        try {
          // INITIAL_SESSION is handled entirely by initAuth above.
          // Only handle SIGNED_IN (fresh OAuth login) here.
          if (event === 'SIGNED_IN' && session?.user) {
            if (profileFetchingRef.current) return;
            profileFetchingRef.current = true;

            if (mounted) {
              setUser(session.user);
              try {
                await fetchProfile(session.user.id);
              } catch (profileErr) {
                console.error('[AUTH] Profile fetch failed on SIGNED_IN:', profileErr);
              }
              setSessionError(null);
              setInitializing(false);
              setLoading(false);
              toast.success('Welcome!');
            }
            profileFetchingRef.current = false;
          } else if (event === 'SIGNED_OUT') {
            profileFetchingRef.current = false;
            if (mounted && !startingUpRef.current) {
              setUser(null);
              setProfile(null);
              setSessionError(null);
              setInitializing(false);
              setLoading(false);
              toast.success('Signed out successfully');
            }
          } else if (event === 'USER_UPDATED' && session?.user) {
            if (mounted) setUser(session.user);
            await fetchProfile(session.user.id);
          } else if (event === 'TOKEN_REFRESHED') {
            if (mounted) setSessionError(null);
          }
        } catch (error) {
          console.error('[AUTH] Error handling auth event:', error);
          if (mounted) {
            setSessionError(error.message);
            setInitializing(false);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  // Subscribe to real-time trust score updates for the current user
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new;
          // Merge the new data into the current profile state
          setProfile((prev) => prev ? { ...prev, ...newData } : newData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Sign in with Google
  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      // Check if registration is enabled
      try {
        const { data: regSetting } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'enable_registration')
          .single();
        
        if (regSetting?.setting_value === false) {
          toast.error('Registration is currently disabled. Please contact support.');
          setLoading(false);
          return { error: new Error('Registration disabled') };
        }
      } catch (regErr) {
        console.warn('[AUTH] Could not check registration setting, proceeding...');;
      }

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
