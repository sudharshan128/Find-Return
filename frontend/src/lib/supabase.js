/**
 * Supabase Client Configuration
 * Lost & Found Bangalore
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase config missing:', { url: !!supabaseUrl, key: !!supabaseAnonKey });
  throw new Error('Missing Supabase environment variables');
}

// File upload constants
export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// In-memory session storage — session survives SPA navigation (OAuth callback → home)
// but is completely lost on page refresh or opening a new tab, forcing re-login every visit.
const memoryStorage = (() => {
  const store = {};
  return {
    getItem:    (key) => store[key] ?? null,
    setItem:    (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
  };
})();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,      // must be true for OAuth PKCE flow to work
    detectSessionInUrl: true,  // picks up the access_token hash from Google redirect
    storage: memoryStorage,    // custom in-memory backend — never touches localStorage
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Helper: Generate public URL from storage_bucket and storage_path
export const getImageUrl = (image) => {
  if (!image) return null;
  
  // If image already has a full URL (legacy data), use it
  if (image.image_url) return image.image_url;
  
  // Generate URL from storage_bucket and storage_path
  if (image.storage_bucket && image.storage_path) {
    const { data } = supabase.storage
      .from(image.storage_bucket)
      .getPublicUrl(image.storage_path);
    return data?.publicUrl || null;
  }
  
  return null;
};

// Helper: Get primary image URL from images array
export const getPrimaryImageUrl = (images) => {
  if (!images || images.length === 0) return null;
  
  const primaryImage = images.find(img => img.is_primary) || images[0];
  return getImageUrl(primaryImage);
};

// Auth helpers
export const auth = {
  // Sign in with Google
  signInWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) throw error;
    return data;
  },

  // Sign out
  signOut: async () => {
    try {
      // Session lives in memory only (in-memory storage adapter), so just
      // call Supabase sign out — no localStorage tokens to manually clear.
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      console.log('[AUTH] Sign out successful');
    } catch (error) {
      console.error('[AUTH] Sign out error:', error);
      throw error;
    }
  },

  // Get current user
  getUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  // Get session
  getSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  // Listen to auth changes
  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// ---------------------------------------------------------------------------
// Simple in-memory cache for rarely-changing reference data
// Entries expire after 5 minutes so stale data is never served permanently.
// ---------------------------------------------------------------------------
const _cache = new Map(); // key → { data, expiresAt }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data) {
  _cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Database helpers
export const db = {
  // User Profiles (using new schema)
  users: {
    get: async (userId) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error) throw error;
      return data;
    },

    getCurrent: async () => {
      const user = await auth.getUser();
      if (!user) return null;
      return db.users.get(user.id);
    },

    update: async (userId, updates) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    getStats: async (userId) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('items_found_count, items_returned_count, claims_made_count, successful_claims_count, trust_score')
        .eq('user_id', userId)
        .single();
      if (error) throw error;
      return data;
    },

    // Get rate limit status for a user
    getRateLimitStatus: async (userId, actionType) => {
      const { data, error } = await supabase
        .from('rate_limits')
        .select('count, window_start')
        .eq('user_id', userId)
        .eq('action_type', actionType)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
      
      return data || { count: 0, window_start: new Date().toISOString() };
    },
  },

  // Categories
  categories: {
    getAll: async () => {
      const cached = cacheGet('categories');
      if (cached) return cached;

      const { data, error } = await supabase
        .from('categories')
        .select('id, name, icon, slug, display_order')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      const result = data || [];
      cacheSet('categories', result);
      return result;
    },
  },

  // Areas
  areas: {
    getAll: async () => {
      const cached = cacheGet('areas');
      if (cached) return cached;

      const { data, error } = await supabase
        .from('areas')
        .select('id, name, zone')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      const result = data || [];
      cacheSet('areas', result);
      return result;
    },

    getByZone: async (zone) => {
      const cacheKey = `areas_zone_${zone}`;
      const cached = cacheGet(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from('areas')
        .select('id, name, zone')
        .eq('zone', zone)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      const result = data || [];
      cacheSet(cacheKey, result);
      return result;
    },
  },

  // Items
  items: {
    create: async (itemData) => {
      console.log('[db.items.create] Starting item creation...');
      
      // Extract images array - it goes in item_images table, not items
      const { images, ...itemPayload } = itemData;
      
      console.log('[db.items.create] Item payload:', JSON.stringify(itemPayload, null, 2));
      console.log('[db.items.create] Images to save:', images?.length || 0);
      
      // Check max_items_per_user limit
      try {
        const { data: maxItemsSetting } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'max_items_per_user')
          .single();
        
        if (maxItemsSetting?.setting_value) {
          const maxItems = maxItemsSetting.setting_value;
          console.log('[db.items.create] Max items per user:', maxItems);
          
          // Count user's active items
          const { count: userItemCount } = await supabase
            .from('items')
            .select('*', { count: 'exact', head: true })
            .eq('finder_id', itemPayload.finder_id)
            .in('status', ['active', 'claimed']); // Count active and claimed items
          
          console.log('[db.items.create] User current item count:', userItemCount);
          
          if (userItemCount >= maxItems) {
            const error = new Error(`You have reached the maximum limit of ${maxItems} active items. Please delete or return some items before posting new ones.`);
            error.code = 'MAX_ITEMS_EXCEEDED';
            throw error;
          }
        }
      } catch (limitErr) {
        if (limitErr.code === 'MAX_ITEMS_EXCEEDED') {
          throw limitErr; // Re-throw limit error
        }
        console.warn('[db.items.create] Could not check item limit:', limitErr);
      }
      
      // Insert item 
      console.log('[db.items.create] Inserting item into database...');
      const { data, error } = await supabase
        .from('items')
        .insert(itemPayload)
        .select()
        .single();
      
      if (error) {
        // Log all possible error properties
        console.error('[db.items.create] ====== DETAILED ERROR INFO ======');
        console.error('[db.items.create] Status:', error.status);
        console.error('[db.items.create] statusText:', error.statusText);
        console.error('[db.items.create] Code:', error.code);
        console.error('[db.items.create] Message:', error.message);
        console.error('[db.items.create] Details:', error.details);
        console.error('[db.items.create] Hint:', error.hint);
        if (error.response) {
          console.error('[db.items.create] Response body:', error.response.body);
          console.error('[db.items.create] Response error:', error.response.error);
        }
        console.error('[db.items.create] Full error:', JSON.stringify(error, null, 2));
        console.error('[db.items.create] ====== END ERROR INFO ======');
        throw error;
      }
      
      console.log('[db.items.create] Item created successfully with ID:', data?.id);
      
      // Insert images into item_images table if provided
      // Actual schema: item_id, storage_bucket, storage_path, image_url, is_primary, sort_order
      if (images && images.length > 0 && data?.id) {
        console.log('[db.items.create] Inserting', images.length, 'images into item_images table...');
        
        const imageRecords = images.map((publicUrl, index) => {
          // Extract storage_path from public URL
          // URL format: https://<project>.supabase.co/storage/v1/object/public/item-images/<path>
          const pathMatch = publicUrl.match(/\/item-images\/(.+)$/);
          const storagePath = pathMatch ? pathMatch[1] : publicUrl;
          
          return {
            item_id: data.id,
            storage_bucket: 'item-images',
            storage_path: storagePath,
            image_url: publicUrl,  // Full public URL (required column)
            is_primary: index === 0,
            sort_order: index,
          };
        });
        
        console.log('[db.items.create] Image records to insert:', imageRecords);
        
        try {
          const { error: imgError } = await supabase
            .from('item_images')
            .insert(imageRecords);
          
          if (imgError) {
            console.error('[db.items.create] Failed to insert item images:', imgError);
            // Don't throw - item was created, images just failed
          } else {
            console.log('[db.items.create] Images saved successfully');
          }
        } catch (imgErr) {
          console.error('[db.items.create] Image insert error:', imgErr);
        }
      }
      
      console.log('[db.items.create] Complete! Returning data');
      return data;
    },

    get: async (itemId) => {
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          category:categories(id, name, icon, slug, description),
          area:areas(id, name, zone),
          finder:user_profiles!finder_id(user_id, full_name, avatar_url, trust_score, items_returned_count),
          images:item_images(id, image_url, storage_bucket, storage_path, is_primary),
          claims(count)
        `)
        .eq('id', itemId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Item not found or has been removed');

      // Flatten the claims aggregate into claim_count
      data.claim_count = data.claims?.[0]?.count ?? 0;
      delete data.claims;

      return data;
    },

    search: async (filters = {}) => {
      try {
        let query = supabase
          .from('items')
          .select(`
            *,
            category:categories(id, name, icon, slug),
            area:areas(id, name, zone),
            images:item_images(id, image_url, storage_bucket, storage_path, is_primary)
          `, { count: 'exact' });

        // Filter by status - map UI values to DB enum values
        // DB enum: active, claimed, returned, expired, removed
        if (filters.status === 'unclaimed' || filters.status === 'active') {
          query = query.eq('status', 'active');
        } else if (filters.status === 'pending') {
          // "pending" in UI means "claimed" in DB (item has been claimed but not returned)
          query = query.eq('status', 'claimed');
        } else if (filters.status) {
          query = query.eq('status', filters.status);
        }

        // Category filter
        if (filters.categoryId) {
          query = query.eq('category_id', filters.categoryId);
        }

        // Area filter
        if (filters.areaId) {
          query = query.eq('area_id', filters.areaId);
        }

        // Text search
        if (filters.search) {
          query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
        }

        // Pagination and ordering
        query = query
          .order('created_at', { ascending: false })
          .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 20) - 1);

        const { data, error, count } = await query;
        
        if (error) throw error;
        return { data: data || [], count: count || 0 };
      } catch (err) {
        console.error('Search error:', err);
        throw err;
      }
    },

    getByUser: async (userId) => {
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          category:categories(name, icon),
          area:areas(name),
          images:item_images(id, image_url, storage_bucket, storage_path, is_primary)
        `)
        .eq('finder_id', userId)
        .neq('status', 'removed')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    update: async (itemId, updates) => {
      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    delete: async (itemId) => {
      const { error } = await supabase
        .from('items')
        .update({ status: 'removed' })
        .eq('id', itemId);
      if (error) throw error;
    },

    // Mark item as returned (handover complete)
    markReturned: async (itemId, claimId = null) => {
      // Update item status to 'closed' (schema enum: unclaimed, claimed, closed, flagged, deleted)
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .update({ 
          status: 'closed',
          closed_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .select()
        .single();
      if (itemError) throw itemError;
      
      return itemData;
    },

    incrementView: async (itemId) => {
      const { error } = await supabase.rpc('increment_view_count', { p_item_id: itemId });
      if (error) console.error('Failed to increment view count:', error);
    },

    // Get user's daily upload count
    getUserDailyUploadCount: async (userId) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count, error } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('finder_id', userId)
        .gte('created_at', today.toISOString());
      
      if (error) throw error;
      return count || 0;
    },
  },

  // Item Images (separate table)
  itemImages: {
    create: async (imageData) => {
      const { data, error } = await supabase
        .from('item_images')
        .insert(imageData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    createMany: async (images) => {
      const { data, error } = await supabase
        .from('item_images')
        .insert(images)
        .select();
      if (error) throw error;
      return data;
    },

    getForItem: async (itemId) => {
      const { data, error } = await supabase
        .from('item_images')
        .select('*')
        .eq('item_id', itemId)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },

    delete: async (imageId) => {
      const { error } = await supabase
        .from('item_images')
        .delete()
        .eq('id', imageId);
      if (error) throw error;
    },

    setPrimary: async (imageId, itemId) => {
      // First unset all as primary
      await supabase
        .from('item_images')
        .update({ is_primary: false })
        .eq('item_id', itemId);
      
      // Then set the selected one
      const { error } = await supabase
        .from('item_images')
        .update({ is_primary: true })
        .eq('id', imageId);
      if (error) throw error;
    },
  },

  // Note: Images are now stored in item_images table

  // Claims
  claims: {
    create: async (claimData) => {
      const { data, error } = await supabase
        .from('claims')
        .insert(claimData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    getForItem: async (itemId) => {
      const { data, error } = await supabase
        .from('claims')
        .select(`
          *,
          claimant:user_profiles(user_id, full_name, avatar_url, trust_score)
        `)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    getByUser: async (userId) => {
      const { data, error } = await supabase
        .from('claims')
        .select(`
          *,
          item:items(
            id, 
            title, 
            status, 
            finder_id,
            images:item_images(id, image_url, storage_bucket, storage_path, is_primary)
          )
        `)
        .eq('claimant_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    getUserClaimCount: async (itemId, userId) => {
      const { count, error } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', itemId)
        .eq('claimant_id', userId);
      if (error) throw error;
      return count || 0;
    },

    // Get user's daily claim count
    getUserDailyClaimCount: async (userId) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count, error } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })
        .eq('claimant_id', userId)
        .gte('created_at', today.toISOString());
      
      if (error) throw error;
      return count || 0;
    },

    updateStatus: async (claimId, status, rejectionReason = null) => {
      // Only send status — the DB trigger handle_claim_status_change()
      // automatically sets reviewed_at, chat_enabled, item status, etc.
      const updates = { status };
      const { data, error } = await supabase
        .from('claims')
        .update(updates)
        .eq('id', claimId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    withdraw: async (claimId) => {
      const { data, error } = await supabase
        .from('claims')
        .update({ status: 'withdrawn' })
        .eq('id', claimId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  },

  // Chats
  chats: {
    create: async (chatData) => {
      const { data, error } = await supabase
        .from('chats')
        .insert(chatData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    getOrCreate: async (itemId, claimId, finderId, claimantId) => {
      // First try to find existing chat
      const { data: existingChat } = await supabase
        .from('chats')
        .select('*')
        .eq('item_id', itemId)
        .eq('claim_id', claimId)
        .single();
      
      if (existingChat) return existingChat;
      
      // Create new chat
      const { data, error } = await supabase
        .from('chats')
        .insert({
          item_id: itemId,
          claim_id: claimId,
          finder_id: finderId,
          claimant_id: claimantId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    getForUser: async (userId) => {
      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          item:items(
            id, 
            title,
            images:item_images(id, image_url, storage_bucket, storage_path, is_primary)
          ),
          messages:messages(id, message_text, created_at, sender_id, is_read)
        `)
        .or(`finder_id.eq.${userId},claimant_id.eq.${userId}`)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    get: async (chatId) => {
      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          item:items(id, title, finder_id),
          claim:claims(id, claimant_id)
        `)
        .eq('id', chatId)
        .single();
      if (error) throw error;
      return data;
    },

    close: async (chatId, reason) => {
      const user = await auth.getUser();
      const { error } = await supabase
        .from('chats')
        .update({ 
          is_closed: true, 
          closed_at: new Date().toISOString(),
          closed_by: user.id,
          close_reason: reason,
        })
        .eq('id', chatId);
      if (error) throw error;
    },

    markRead: async (chatId, userId, isFinder) => {
      const field = isFinder ? 'finder_unread_count' : 'claimant_unread_count';
      console.log(`[db.chats.markRead] Setting ${field} to 0 for chat ${chatId}`);
      const { error } = await supabase
        .from('chats')
        .update({ [field]: 0 })
        .eq('id', chatId);
      if (error) {
        console.error('[db.chats.markRead] Error:', error);
        throw error;
      }
      console.log('[db.chats.markRead] Successfully marked as read');
    },
  },

  // Messages
  messages: {
    getForChat: async (chatId, limit = 50) => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:user_profiles(user_id, full_name, avatar_url)
        `)
        .eq('chat_id', chatId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },

    send: async (chatId, senderId, content) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: senderId,
          message_text: content,
          message_type: 'text',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    markRead: async (chatId, userId) => {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('chat_id', chatId)
        .neq('sender_id', userId)
        .eq('is_read', false);
      if (error) throw error;
    },
  },

  // Reports (abuse_reports table)
  reports: {
    create: async (reportData) => {
      const { data, error } = await supabase
        .from('abuse_reports')
        .insert(reportData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    getAll: async (status = null) => {
      let query = supabase
        .from('abuse_reports')
        .select(`
          *,
          reporter:user_profiles!reporter_id(user_id, full_name, email),
          target_user:user_profiles!target_user_id(user_id, full_name, email),
          target_item:items!target_item_id(id, title)
        `)
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    updateStatus: async (reportId, status, adminNotes, actionTaken) => {
      const user = await auth.getUser();
      const { error } = await supabase
        .from('abuse_reports')
        .update({ 
          status, 
          admin_notes: adminNotes,
          action_taken: actionTaken,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reportId);
      if (error) throw error;
    },

    getStats: async () => {
      const { data, error } = await supabase
        .from('abuse_reports')
        .select('status')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const stats = {
        total: data?.length || 0,
        pending: data?.filter(r => r.status === 'pending').length || 0,
        reviewing: data?.filter(r => r.status === 'reviewing').length || 0,
        resolved: data?.filter(r => r.status === 'resolved').length || 0,
        dismissed: data?.filter(r => r.status === 'dismissed').length || 0,
      };
      
      return stats;
    },
  },

  // Audit Logs
  auditLogs: {
    create: async (logData) => {
      const { error } = await supabase
        .from('audit_logs')
        .insert(logData);
      if (error) console.error('Failed to create audit log:', error);
    },

    getForEntity: async (entityType, entityId) => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    getRecent: async (limit = 20) => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          user:user_profiles(user_id, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  },

  // Admin stats
  admin: {
    getStats: async () => {
      // Get item counts
      const { count: totalItems } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'removed');

      const { count: activeItems } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { count: claimedItems } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'claimed');

      const { count: returnedItems } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'returned');

      const { count: flaggedItems } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('is_flagged', true);

      // Get user counts
      const { count: totalUsers } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      const { count: activeUsers } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('account_status', 'active');

      const { count: bannedUsers } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('account_status', 'banned');

      // Get pending reports
      const { count: pendingReports } = await supabase
        .from('abuse_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Get pending claims
      const { count: pendingClaims } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      return {
        items: {
          total: totalItems || 0,
          active: activeItems || 0,
          claimed: claimedItems || 0,
          returned: returnedItems || 0,
          flagged: flaggedItems || 0,
        },
        users: {
          total: totalUsers || 0,
          active: activeUsers || 0,
          banned: bannedUsers || 0,
        },
        pendingReports: pendingReports || 0,
        pendingClaims: pendingClaims || 0,
      };
    },

    // Get all items for admin
    getAllItems: async (filters = {}) => {
      let query = supabase
        .from('items')
        .select(`
          *,
          category:categories(id, name, icon, slug),
          area:areas(id, name, zone),
          finder:user_profiles!items_finder_id_fkey(user_id, full_name, email, avatar_url, trust_score),
          images:item_images(id, image_url, storage_bucket, storage_path, is_primary)
        `, { count: 'exact' });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.flagged) {
        query = query.eq('is_flagged', true);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 20) - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },

    // Get all users for admin
    getAllUsers: async (filters = {}) => {
      let query = supabase
        .from('user_profiles')
        .select('*', { count: 'exact' });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('account_status', filters.status);
      }

      if (filters.role && filters.role !== 'all') {
        query = query.eq('role', filters.role);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 20) - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },

    // Flag/unflag item
    flagItem: async (itemId, reason) => {
      const user = await auth.getUser();
      const { error } = await supabase
        .from('items')
        .update({
          is_flagged: true,
          flag_reason: reason,
          flagged_by: user.id,
          flagged_at: new Date().toISOString(),
        })
        .eq('id', itemId);
      if (error) throw error;
    },

    unflagItem: async (itemId) => {
      const { error } = await supabase
        .from('items')
        .update({
          is_flagged: false,
          flag_reason: null,
          flagged_by: null,
          flagged_at: null,
        })
        .eq('id', itemId);
      if (error) throw error;
    },

    // Ban/unban user
    banUser: async (userId, reason) => {
      const admin = await auth.getUser();
      const { error } = await supabase
        .from('user_profiles')
        .update({
          account_status: 'banned',
          ban_reason: reason,
          banned_at: new Date().toISOString(),
          banned_by: admin.id,
        })
        .eq('user_id', userId);
      if (error) throw error;
    },

    unbanUser: async (userId) => {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          account_status: 'active',
          ban_reason: null,
          banned_at: null,
          banned_by: null,
        })
        .eq('user_id', userId);
      if (error) throw error;
    },
  },
};

// Storage helpers
export const storage = {
  // Upload item image with timeout protection
  uploadItemImage: async (file, userId) => {
    if (!userId) {
      throw new Error('User ID is required for image upload');
    }
    
    console.log('[storage.uploadItemImage] Starting upload for:', file.name);
    console.log('[storage.uploadItemImage] File size:', file.size, 'bytes');
    console.log('[storage.uploadItemImage] User ID:', userId);
    console.log('[storage.uploadItemImage] Bucket: item-images');
    
    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File is larger than 5MB limit');
    }
    
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      throw new Error(`Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF`);
    }
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    console.log('[storage.uploadItemImage] Target path:', fileName);
    
    // Verify auth session before uploading
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    console.log('[storage.uploadItemImage] Auth session exists:', !!session);
    console.log('[storage.uploadItemImage] Session user ID:', session?.user?.id);
    if (!session) {
      throw new Error('Not authenticated. Please log in and try again.');
    }

    console.log('[storage.uploadItemImage] Calling Supabase storage upload...');
    
    const { data, error } = await supabase.storage
      .from('item-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });
    
    if (error) {
      console.error('[storage.uploadItemImage] Storage upload FAILED:');
      console.error('  message:', error.message);
      console.error('  statusCode:', error.statusCode);
      console.error('  error code:', error.error);
      console.error('  full error:', JSON.stringify(error));
      
      // Provide more helpful error messages
      if (error.message?.includes('policy') || error.statusCode === 403 || error.statusCode === '403') {
        throw new Error('Upload policy error. Please ensure you are logged in and your folder path is correct.');
      } else if (error.message?.includes('not found')) {
        throw new Error('Storage bucket "item-images" not found. Please run the SQL migration first.');
      } else if (error.statusCode === 400 || error.statusCode === '400') {
        throw new Error(`Upload rejected (400): ${error.message || 'Row-level security policy violation or invalid request'}`);
      }
      
      throw error;
    }
    
    if (!data?.path) {
      console.error('[storage.uploadItemImage] No path in response!', data);
      throw new Error('Upload failed: no path returned from Supabase');
    }
    
    console.log('[storage.uploadItemImage] Upload successful, path:', data.path);
    
    const { data: { publicUrl } } = supabase.storage
      .from('item-images')
      .getPublicUrl(data.path);
    
    console.log('[storage.uploadItemImage] Public URL:', publicUrl);
    
    if (!publicUrl) {
      throw new Error('Failed to generate public URL for uploaded image');
    }
    
    return {
      path: data.path,
      publicUrl,
    };
  },

  // Upload claim proof image - use item-images bucket
  uploadClaimImage: async (file, userId) => {
    const fileExt = file.name.split('.').pop();
    // RLS policy expects: {userId}/{path} format
    // So use: {userId}/claims/{timestamp}-{random}.{ext}
    const fileName = `${userId}/claims/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    console.log('[storage.uploadClaimImage] Starting upload');
    console.log('[storage.uploadClaimImage] File name:', file.name);
    console.log('[storage.uploadClaimImage] Storage path:', fileName);
    console.log('[storage.uploadClaimImage] User ID:', userId);
    
    try {
      // Upload to item-images bucket
      const { data, error } = await supabase.storage
        .from('item-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });
      
      if (error) {
        console.error('[storage.uploadClaimImage] Upload error:', error);
        throw error;
      }
      
      console.log('[storage.uploadClaimImage] Upload successful, path:', data.path);
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('item-images')
        .getPublicUrl(data.path);
      
      console.log('[storage.uploadClaimImage] Public URL:', publicUrl);
      
      return {
        path: data.path,
        publicUrl,
      };
    } catch (error) {
      console.error('[storage.uploadClaimImage] Fatal error:', error);
      throw error;
    }
  },

  // Upload avatar - use item-images bucket
  uploadAvatar: async (file, userId) => {
    const fileExt = file.name.split('.').pop();
    // RLS policy expects: {userId}/{path} format
    // So use: {userId}/avatar.{ext}
    const fileName = `${userId}/avatar.${fileExt}`;
    
    console.log('[storage.uploadAvatar] Starting upload');
    console.log('[storage.uploadAvatar] File name:', file.name);
    console.log('[storage.uploadAvatar] Storage path:', fileName);
    console.log('[storage.uploadAvatar] User ID:', userId);
    
    try {
      // Upload to item-images bucket
      const { data, error } = await supabase.storage
        .from('item-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });
      
      if (error) {
        console.error('[storage.uploadAvatar] Upload error:', error);
        throw error;
      }
      
      console.log('[storage.uploadAvatar] Upload successful, path:', data.path);
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('item-images')
        .getPublicUrl(data.path);
      
      console.log('[storage.uploadAvatar] Public URL:', publicUrl);
      
      return {
        path: data.path,
        publicUrl,
      };
    } catch (error) {
      console.error('[storage.uploadAvatar] Fatal error:', error);
      throw error;
    }
  },

  // Delete image
  deleteImage: async (bucket, path) => {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);
    if (error) throw error;
  },

  // Get signed URL for private images
  getSignedUrl: async (bucket, path, expiresIn = 3600) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },
};

// Realtime subscriptions
export const realtime = {
  // Subscribe to chat messages
  subscribeToChat: (chatId, callback) => {
    return supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        callback
      )
      .subscribe();
  },

  // Subscribe to item claims
  subscribeToClaims: (itemId, callback) => {
    return supabase
      .channel(`claims:${itemId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'claims',
          filter: `item_id=eq.${itemId}`,
        },
        callback
      )
      .subscribe();
  },

  // Unsubscribe
  unsubscribe: (channel) => {
    supabase.removeChannel(channel);
  },
};

export default supabase;
