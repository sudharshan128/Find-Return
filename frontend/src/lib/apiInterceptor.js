/**
 * API Client with Maintenance Mode Handling
 * Intercepts 503 errors and redirects to maintenance page
 */

import { supabase } from './supabase';

/**
 * Wrapper for Supabase API calls that handles maintenance mode
 */
export async function apiCall(fn) {
  try {
    const result = await fn();
    return result;
  } catch (error) {
    // Check if it's a maintenance mode error (503)
    if (error?.status === 503 || error?.code === 'MAINTENANCE_MODE') {
      const message = error?.message || 'We are currently performing maintenance. Please check back soon.';
      sessionStorage.setItem('maintenanceMessage', message);
      window.location.href = '/maintenance';
      throw error;
    }
    throw error;
  }
}

/**
 * Check if maintenance mode is active
 * Returns true if we should redirect to maintenance page
 */
export async function checkMaintenanceStatus() {
  try {
    // Try to call a simple endpoint to check if maintenance mode is on
    const response = await fetch('/api/health');
    
    if (response.status === 503) {
      const data = await response.json();
      if (data.maintenance) {
        sessionStorage.setItem('maintenanceMessage', data.message);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Failed to check maintenance status:', error);
    return false;
  }
}

/**
 * Add global error handler for all API requests
 */
if (typeof window !== 'undefined') {
  // Intercept fetch globally
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    try {
      const response = await originalFetch(...args);
      
      // Check for maintenance mode (503)
      if (response.status === 503) {
        const clonedResponse = response.clone();
        try {
          const data = await clonedResponse.json();
          if (data.maintenance) {
            sessionStorage.setItem('maintenanceMessage', data.message || 'We are currently performing maintenance.');
            // Don't redirect on admin routes
            if (!window.location.pathname.startsWith('/admin')) {
              window.location.href = '/maintenance';
            }
          }
        } catch (e) {
          // Not JSON, ignore
        }
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  };
}

export { supabase };
