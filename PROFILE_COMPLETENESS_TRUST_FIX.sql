-- ============================================================
-- PROFILE COMPLETENESS TRUST SCORE FIX
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- Problem: Adding phone number increases trust score (+5),
--          but clearing the phone number does NOT decrease it.
-- Fix:     A BEFORE UPDATE trigger that adjusts trust_score
--          symmetrically for each tracked completeness field.
-- ============================================================

-- ── 1. Drop old trigger/function if they exist ──────────────
DROP TRIGGER IF EXISTS trg_profile_completeness_trust ON public.user_profiles;
DROP FUNCTION IF EXISTS fn_profile_completeness_trust();

-- ── 2. Function: bidirectional completeness adjustment ──────
CREATE OR REPLACE FUNCTION fn_profile_completeness_trust()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  delta INTEGER := 0;
BEGIN
  -- phone number: +5 when filled, -5 when cleared
  IF (OLD.phone IS NULL OR trim(OLD.phone) = '') AND (NEW.phone IS NOT NULL AND trim(NEW.phone) <> '') THEN
    delta := delta + 5;
  ELSIF (OLD.phone IS NOT NULL AND trim(OLD.phone) <> '') AND (NEW.phone IS NULL OR trim(NEW.phone) = '') THEN
    delta := delta - 5;
  END IF;

  -- full_name: +5 when filled, -5 when cleared
  IF (OLD.full_name IS NULL OR trim(OLD.full_name) = '') AND (NEW.full_name IS NOT NULL AND trim(NEW.full_name) <> '') THEN
    delta := delta + 5;
  ELSIF (OLD.full_name IS NOT NULL AND trim(OLD.full_name) <> '') AND (NEW.full_name IS NULL OR trim(NEW.full_name) = '') THEN
    delta := delta - 5;
  END IF;

  -- Apply delta clamped to [0, 100]
  IF delta <> 0 THEN
    NEW.trust_score := GREATEST(0, LEAST(100, COALESCE(NEW.trust_score, 50) + delta));
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. Attach trigger to user_profiles BEFORE UPDATE ────────
CREATE TRIGGER trg_profile_completeness_trust
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_profile_completeness_trust();

-- ── 4. Verify ────────────────────────────────────────────────
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'user_profiles'
  AND trigger_name = 'trg_profile_completeness_trust';
