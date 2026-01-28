// ============================================================
// BACKEND CHAT API ROUTES - Production Ready with Security
// ============================================================

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

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
        item:items!inner(id, title, item_type, images),
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
    const { limit = 50, before } = req.query;

    // Verify user is participant
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select(`
        *,
        item:items!inner(id, title, item_type, images),
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
      .limit(parseInt(limit as string));

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
    const { message_text } = req.body;

    // Validate input
    if (!message_text || message_text.trim().length === 0) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    if (message_text.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
    }

    // Rate limiting
    if (!checkRateLimit(user.id)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    }

    // Verify user is participant and chat is active
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Authorization check
    if (chat.finder_id !== user.id && chat.claimant_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to send messages in this chat' });
    }

    // Status checks
    if (!chat.enabled) {
      return res.status(403).json({ error: 'Chat is disabled' });
    }

    if (chat.is_closed) {
      return res.status(403).json({ error: 'Chat is closed' });
    }

    if (chat.is_frozen) {
      return res.status(403).json({ error: 'Chat is frozen by an administrator' });
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
      resource_type: 'message',
      resource_id: message.id,
      details: { chat_id: chatId, message_length: message_text.length },
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
    const { reason } = req.body;

    const { data: chat, error } = await supabase
      .from('chats')
      .update({
        is_frozen: true,
        frozen_at: new Date().toISOString(),
        frozen_by: user.id,
        freeze_reason: reason || 'Administrative action',
      })
      .eq('id', chatId)
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'chat_frozen',
      resource_type: 'chat',
      resource_id: chatId,
      details: { reason },
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

    const { data: chat, error } = await supabase
      .from('chats')
      .update({
        is_frozen: false,
        frozen_at: null,
        frozen_by: null,
        freeze_reason: null,
      })
      .eq('id', chatId)
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'chat_unfrozen',
      resource_type: 'chat',
      resource_id: chatId,
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
      const { messageId } = req.params;

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
        resource_type: 'message',
        resource_id: messageId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }
);

export default router;
