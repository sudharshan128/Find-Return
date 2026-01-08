/**
 * Authentication Context
 * Manages user authentication state using Supabase
 * Handles Google OAuth, session management, and user profiles
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, db } from '../lib/supabase';
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
      const data = await db.users.get(userId);
      setProfile(data);
      setDbReady(true);
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Check if it's a "table doesn't exist" error
      if (error.message?.includes('relation') || error.code === '42P01') {
        console.warn('Database tables not set up yet. Please run the SQL migration.');
        setDbReady(false);
      }
      setProfile(null);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const session = await auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
        setSessionError(null);
      } catch (error) {
        console.error('Auth init error:', error);
        setSessionError(error.message);
      } finally {
        setInitializing(false);
        setLoading(false);
      }
    };

    initAuth();
  }, [fetchProfile]);

  // Listen to auth state changes
  useEffect(() => {
    const { data: { subscription } } = auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          setLoading(true);
          await fetchProfile(session.user.id);
          setLoading(false);
          setSessionError(null);
          toast.success('Welcome!');
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setSessionError(null);
          toast.success('Signed out successfully');
        } else if (event === 'USER_UPDATED' && session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else if (event === 'TOKEN_REFRESHED') {
          // Token refreshed successfully
          setSessionError(null);
        } else if (event === 'PASSWORD_RECOVERY') {
          // Handle password recovery if needed
        }
      }
    );

    return () => subscription.unsubscribe();
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
      await auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
      throw error;
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
