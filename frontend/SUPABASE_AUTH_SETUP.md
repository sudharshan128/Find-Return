# Supabase Google OAuth Configuration Guide

## Overview
This guide explains how to set up Google OAuth for the Lost & Found Bangalore application.

---

## Step 1: Google Cloud Console Setup

### 1.1 Create OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Select **Web application**

### 1.2 Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**
2. Choose **External** user type
3. Fill in app information:
   - App name: `Lost & Found Bangalore`
   - User support email: `your-email@domain.com`
   - App logo (optional)
   - App domain: `your-production-domain.com`
   - Developer contact email

### 1.3 Set Authorized URIs

**Authorized JavaScript Origins:**
```
http://localhost:5173
http://localhost:3000
https://your-production-domain.com
```

**Authorized Redirect URIs:**
```
https://<your-supabase-project>.supabase.co/auth/v1/callback
```

### 1.4 Get Your Credentials
- Copy the **Client ID**
- Copy the **Client Secret**

---

## Step 2: Supabase Dashboard Configuration

### 2.1 Enable Google Provider
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication > Providers**
3. Find **Google** and click **Enable**
4. Enter your Google credentials:
   - **Client ID**: From Google Cloud Console
   - **Client Secret**: From Google Cloud Console

### 2.2 Configure Redirect URLs
In **Authentication > URL Configuration**:

**Site URL:**
```
http://localhost:5173 (development)
https://your-production-domain.com (production)
```

**Redirect URLs (add all):**
```
http://localhost:5173/auth/callback
http://localhost:3000/auth/callback
https://your-production-domain.com/auth/callback
```

---

## Step 3: Database Setup for User Profiles

### 3.1 Create User Profile Trigger
Run this SQL in Supabase SQL Editor to automatically create user profiles:

```sql
-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id,
    email,
    full_name,
    avatar_url,
    role,
    account_status,
    trust_score,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    'user',
    'active',
    50, -- Default trust score
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Also handle updates (for profile picture changes etc.)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

---

## Step 4: Environment Variables

### 4.1 Frontend `.env` File
Create `.env` in `frontend/` directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4.2 Get Your Keys
1. Go to Supabase Dashboard > **Settings > API**
2. Copy **Project URL** → `VITE_SUPABASE_URL`
3. Copy **anon public** key → `VITE_SUPABASE_ANON_KEY`

---

## Step 5: Testing

### 5.1 Test Locally
1. Start your dev server: `npm run dev`
2. Navigate to `/login`
3. Click "Continue with Google"
4. Complete Google sign-in
5. Verify redirect to home page
6. Check user profile was created in `user_profiles` table

### 5.2 Common Issues

**Issue: Redirect URI mismatch**
- Ensure the redirect URI in Google Cloud Console matches exactly
- Format: `https://<project>.supabase.co/auth/v1/callback`

**Issue: CORS errors**
- Add your domain to Supabase URL Configuration
- Verify Site URL is set correctly

**Issue: Profile not created**
- Check the trigger function was created
- Look at Supabase logs for errors

---

## Security Notes

1. **Never expose your Client Secret** - it should only be in Supabase
2. **Use PKCE flow** - Supabase handles this automatically
3. **No localStorage** - Supabase manages sessions securely
4. **HTTPS required** - Production must use HTTPS
5. **Validate server-side** - Always verify sessions on the server

---

## Production Checklist

- [ ] Set production domain in Google Cloud Console
- [ ] Update Site URL in Supabase to production domain
- [ ] Add production redirect URL
- [ ] Test full auth flow on production
- [ ] Enable email verification (optional)
- [ ] Set up proper CORS policies
- [ ] Configure session timeouts as needed
