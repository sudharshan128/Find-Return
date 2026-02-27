// ============================================================
// BACKEND CHAT API ROUTES - Production Ready with Security
// ============================================================

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// ── Security helpers ──────────────────────────────────────────

/** Validate that a string is a well-formed UUID v4 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

/** Strip null bytes, control characters and limit length */
function sanitizeText(text: string, maxLen = 2000): string {
  return text
    .replace(/\0/g, '')            // null bytes
    .replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // C0 control chars (keep \t \n \r)
    .trim()
    .substring(0, maxLen);
}

// Rate limiting map (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Rate limit: 50 messages per minute per user
const RATE_LIMIT = {
  maxMessages: 50,
  windowMs: 60000, // 1 minute
};

// Helper: Check rate limit
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT.maxMessages) {
    return false;
  }

  userLimit.count++;
  return true;
}

// Middleware: Authenticate user with Supabase JWT
async function authenticateUser(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.substring(7);
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user account is active
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('account_status, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.account_status !== 'active') {
      return res.status(403).json({ error: 'Account not active' });
    }

    req.user = user;
    req.profile = profile;
    req.supabase = supabase;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// ============================================================
// GET /api/chats - Get user's chats
// ============================================================
router.get('/', authenticateUser, async (req: any, res: any) => {
  try {
    const { supabase, user } = req;

    const { data: chats, error } = await supabase
      .from('chats')
      .select(`
        *,
        item:items!inner(id, title, status, item_images(image_url, is_primary)),
        claim:claims!inner(id, status),
        finder:user_profiles!chats_finder_id_fkey(user_id, full_name, avatar_url),
        claimant:user_profiles!chats_claimant_id_fkey(user_id, full_name, avatar_url)
      `)
      .or(`finder_id.eq.${user.id},claimant_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Add participant info for each chat
    const enrichedChats = chats.map((chat: any) => ({
      ...chat,
      otherParticipant: chat.finder_id === user.id ? chat.claimant : chat.finder,
      unreadCount:
        chat.finder_id === user.id
          ? chat.finder_unread_count
          : chat.claimant_unread_count,
    }));

    res.json({ chats: enrichedChats });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// ============================================================
// GET /api/chats/:chatId - Get single chat with messages
// ============================================================
router.get('/:chatId', authenticateUser, async (req: any, res: any) => {
  try {
    const { supabase, user } = req;
    const { chatId } = req.params;

    if (!isValidUUID(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const rawLimit = parseInt(req.query.limit as string) || 50;
    const limit = Math.min(Math.max(rawLimit, 1), 100); // clamp 1–100
    const { before } = req.query;

    // Verify user is participant
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select(`
        *,
        item:items!inner(id, title, status, item_images(image_url, is_primary)),
        claim:claims!inner(id, status),
        finder:user_profiles!chats_finder_id_fkey(user_id, full_name, avatar_url),
        claimant:user_profiles!chats_claimant_id_fkey(user_id, full_name, avatar_url)
      `)
      .eq('id', chatId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check authorization
    if (chat.finder_id !== user.id && chat.claimant_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to view this chat' });
    }

    // Fetch messages
    let messagesQuery = supabase
      .from('messages')
      .select(`
        *,
        sender:user_profiles!messages_sender_id_fkey(user_id, full_name, avatar_url)
      `)
      .eq('chat_id', chatId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      messagesQuery = messagesQuery.lt('created_at', before);
    }

    const { data: messages, error: messagesError } = await messagesQuery;

    if (messagesError) throw messagesError;

    // Add participant info
    const enrichedChat = {
      ...chat,
      otherParticipant: chat.finder_id === user.id ? chat.claimant : chat.finder,
      unreadCount:
        chat.finder_id === user.id
          ? chat.finder_unread_count
          : chat.claimant_unread_count,
    };

    res.json({
      chat: enrichedChat,
      messages: messages.reverse(), // Return in chronological order
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// ============================================================
// POST /api/chats/:chatId/messages - Send a message
// ============================================================
router.post('/:chatId/messages', authenticateUser, async (req: any, res: any) => {
  try {
    const { supabase, user } = req;
    const { chatId } = req.params;

    // ── Input validation ──────────────────────────────────────
    if (!isValidUUID(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const rawText: unknown = req.body?.message_text;
    if (typeof rawText !== 'string' || rawText.trim().length === 0) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const message_text = sanitizeText(rawText);
    if (message_text.length === 0) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // ── Rate limiting ─────────────────────────────────────────
    if (!checkRateLimit(user.id)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    }

    // ── Fetch & verify chat ───────────────────────────────────
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (chat.finder_id !== user.id && chat.claimant_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to send messages in this chat' });
    }

    if (!chat.enabled) {
      return res.status(403).json({ error: 'Chat is disabled' });
    }

    if (chat.is_closed) {
      return res.status(403).json({ error: 'Chat is closed' });
    }

    // ── Block check (belt-and-suspenders over DB policy) ──────
    const otherUserId = chat.finder_id === user.id ? chat.claimant_id : chat.finder_id;
    const { data: blockRecord } = await supabase
      .from('blocked_users')
      .select('id')
      .or(
        `and(blocker_id.eq.${user.id},blocked_id.eq.${otherUserId}),` +
        `and(blocker_id.eq.${otherUserId},blocked_id.eq.${user.id})`
      )
      .limit(1);

    if (blockRecord && blockRecord.length > 0) {
      return res.status(403).json({ error: 'Cannot send messages — a block is active between participants' });
    }



    // Insert message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        message_text: message_text.trim(),
      })
      .select(`
        *,
        sender:user_profiles!messages_sender_id_fkey(user_id, full_name, avatar_url)
      `)
      .single();

    if (messageError) throw messageError;

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'message_sent',
      entity_type: 'message',
      entity_id: message.id,
      metadata: { chat_id: chatId, message_length: message_text.length },
    });

    res.status(201).json({ message });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ============================================================
// PUT /api/chats/:chatId/read - Mark messages as read
// ============================================================
router.put('/:chatId/read', authenticateUser, async (req: any, res: any) => {
  try {
    const { supabase, user } = req;
    const { chatId } = req.params;

    // Verify user is participant
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (chat.finder_id !== user.id && chat.claimant_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Mark all unread messages as read
    const { error: updateError } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('chat_id', chatId)
      .neq('sender_id', user.id)
      .eq('is_read', false);

    if (updateError) throw updateError;

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// ============================================================
// ADMIN ROUTES
// ============================================================

// Middleware: Check admin role
function requireAdmin(req: any, res: any, next: any) {
  if (!req.profile || !['admin', 'moderator'].includes(req.profile.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// PUT /api/chats/:chatId/freeze - Freeze a chat
router.put('/:chatId/freeze', authenticateUser, requireAdmin, async (req: any, res: any) => {
  try {
    const { supabase, user } = req;
    const { chatId } = req.params;

    if (!isValidUUID(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const rawReason: unknown = req.body?.reason;
    const reason = typeof rawReason === 'string'
      ? sanitizeText(rawReason, 500)
      : 'Frozen by administrator';

    const { data: chat, error } = await supabase
      .from('chats')
      .update({
        enabled: false,
        close_reason: reason || 'Frozen by administrator',
      })
      .eq('id', chatId)
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'chat_frozen',
      entity_type: 'chat',
      entity_id: chatId,
      metadata: { reason },
    });

    res.json({ chat });
  } catch (error) {
    console.error('Error freezing chat:', error);
    res.status(500).json({ error: 'Failed to freeze chat' });
  }
});

// PUT /api/chats/:chatId/unfreeze - Unfreeze a chat
router.put('/:chatId/unfreeze', authenticateUser, requireAdmin, async (req: any, res: any) => {
  try {
    const { supabase, user } = req;
    const { chatId } = req.params;

    if (!isValidUUID(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const { data: chat, error } = await supabase
      .from('chats')
      .update({
        enabled: true,
        close_reason: null,
      })
      .eq('id', chatId)
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'chat_unfrozen',
      entity_type: 'chat',
      entity_id: chatId,
    });

    res.json({ chat });
  } catch (error) {
    console.error('Error unfreezing chat:', error);
    res.status(500).json({ error: 'Failed to unfreeze chat' });
  }
});

// DELETE /api/chats/:chatId/messages/:messageId - Admin delete message
router.delete(
  '/:chatId/messages/:messageId',
  authenticateUser,
  requireAdmin,
  async (req: any, res: any) => {
    try {
      const { supabase, user } = req;
      const { chatId, messageId } = req.params;

      if (!isValidUUID(chatId) || !isValidUUID(messageId)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }

      // Soft delete
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted: true })
        .eq('id', messageId);

      if (error) throw error;

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'message_deleted_admin',
        entity_type: 'message',
        entity_id: messageId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }
);

// ============================================================
// PATCH /api/chats/:chatId/return - Mark item as returned
// Uses service role key to bypass RLS (finder's anon key
// triggers a policy cascade into user_profiles → 403).
// ============================================================
router.patch('/:chatId/return', authenticateUser, async (req: any, res: any) => {
  try {
    const { user } = req;
    const { chatId } = req.params;

    if (!isValidUUID(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    // Create a service-role client that bypasses RLS
    const adminClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch the chat so we can verify ownership and get item_id
    const { data: chat, error: chatErr } = await adminClient
      .from('chats')
      .select('id, finder_id, item_id, is_closed')
      .eq('id', chatId)
      .single();

    if (chatErr || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Only the finder can mark an item returned
    if (chat.finder_id !== user.id) {
      return res.status(403).json({ error: 'Only the finder can mark an item as returned' });
    }

    if (chat.is_closed) {
      return res.status(400).json({ error: 'Chat is already closed' });
    }

    const now = new Date().toISOString();

    // Update item status — service role bypasses all RLS
    const { error: itemErr } = await adminClient
      .from('items')
      .update({ status: 'returned', returned_at: now, updated_at: now })
      .eq('id', chat.item_id);

    if (itemErr) throw itemErr;

    // Close the chat
    const { error: closeErr } = await adminClient
      .from('chats')
      .update({ is_closed: true, closed_at: now, close_reason: 'Item returned to owner' })
      .eq('id', chatId);

    if (closeErr) throw closeErr;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error marking returned:', error);
    res.status(500).json({ error: error.message || 'Failed to mark as returned' });
  }
});

export default router;
