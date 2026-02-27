import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { supabase } from "../services/supabase";

const router = Router();

/**
 * DELETE /api/user/account
 *
 * Permanently deletes the authenticated user's account and ALL related data:
 *   messages → chat_participants → claims → item_images → items →
 *   trust_logs → notifications → rate_limits → user_profiles → auth user
 *
 * Security: requires a valid Supabase JWT (requireAuth middleware).
 * Uses the service-role key so deletes bypass RLS.
 */
router.delete("/account", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  console.log(`[USER] Delete account request for user: ${userId}`);

  const adminClient = supabase.getServiceClient();

  try {
    // ── 1. Messages sent by user ─────────────────────────────────────
    const { error: msgErr } = await adminClient
      .from("messages")
      .delete()
      .eq("sender_id", userId);
    if (msgErr) console.warn("[USER DELETE] messages:", msgErr.message);

    // ── 2. Chat participant records ──────────────────────────────────
    const { error: cpErr } = await adminClient
      .from("chat_participants")
      .delete()
      .eq("user_id", userId);
    if (cpErr) console.warn("[USER DELETE] chat_participants:", cpErr.message);

    // ── 3. Claims made by the user ───────────────────────────────────
    const { error: claimErr } = await adminClient
      .from("claims")
      .delete()
      .eq("claimant_id", userId);
    if (claimErr) console.warn("[USER DELETE] claims:", claimErr.message);

    // ── 4. Item images for items posted by user ──────────────────────
    const { error: imgErr } = await adminClient
      .from("item_images")
      .delete()
      .eq("uploaded_by", userId);
    if (imgErr) console.warn("[USER DELETE] item_images:", imgErr.message);

    // ── 5. Items posted by user ──────────────────────────────────────
    const { error: itemErr } = await adminClient
      .from("items")
      .delete()
      .eq("user_id", userId);
    if (itemErr) console.warn("[USER DELETE] items:", itemErr.message);

    // ── 6. Trust score logs ──────────────────────────────────────────
    const { error: trustErr } = await adminClient
      .from("trust_logs")
      .delete()
      .eq("user_id", userId);
    if (trustErr) console.warn("[USER DELETE] trust_logs:", trustErr.message);

    // ── 7. Notifications ─────────────────────────────────────────────
    const { error: notifErr } = await adminClient
      .from("notifications")
      .delete()
      .eq("user_id", userId);
    if (notifErr) console.warn("[USER DELETE] notifications:", notifErr.message);

    // ── 8. Rate limit records ────────────────────────────────────────
    const { error: rlErr } = await adminClient
      .from("rate_limits")
      .delete()
      .eq("user_id", userId);
    if (rlErr) console.warn("[USER DELETE] rate_limits:", rlErr.message);

    // ── 9. User profile ──────────────────────────────────────────────
    const { error: profileErr } = await adminClient
      .from("user_profiles")
      .delete()
      .eq("user_id", userId);
    if (profileErr) console.warn("[USER DELETE] user_profiles:", profileErr.message);

    // ── 10. Auth user (permanent, cannot be undone) ──────────────────
    const { error: authErr } = await adminClient.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error("[USER DELETE] auth user deletion failed:", JSON.stringify(authErr));
      return res.status(500).json({
        error: `Failed to delete auth user: ${authErr.message}`,
        code: "AUTH_DELETE_FAILED",
      });
    }

    console.log(`[USER] Account permanently deleted: ${userId}`);
    return res.json({ success: true, message: "Account permanently deleted." });
  } catch (err: any) {
    console.error("[USER DELETE] Unexpected error:", err);
    return res.status(500).json({
      error: "Account deletion failed",
      code: "DELETE_ERROR",
    });
  }
});

export default router;
