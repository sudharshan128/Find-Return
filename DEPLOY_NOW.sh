#!/bin/bash
# Safe Deployment Script - UI Improvements Only
# Run this to deploy tested, safe changes to production

echo "🚀 Deploying Settings UI + Admin Analytics (Safe Changes)"
echo ""

cd "$(dirname "$0")"

# Stage only the safe files
git add frontend/src/pages/SettingsPage.jsx
git add frontend/src/pages/HomePage.jsx
git add backend/nodejs/src/services/supabase.ts
git add frontend/src/admin/pages/AdminDashboardPage.jsx

echo "✅ Staged 4 files for deployment"
echo ""

# Show what's being deployed
echo "📦 Changes to deploy:"
git status --short

echo ""
echo "📝 Commit message:"
echo "feat: Modern Settings UI + Enhanced Admin Analytics"
echo ""
echo "- Redesigned Settings page with modern SaaS aesthetics"
echo "- Removed database warning banner from HomePage"
echo "- Added weekly/monthly user growth metrics to admin"
echo "- Color-coded trust scores with animated progress bars"
echo ""

# Commit
git commit -m "feat: Modern Settings UI + Enhanced Admin Analytics

- Redesigned Settings page with modern SaaS aesthetics
- Removed database warning banner from HomePage  
- Added weekly/monthly user growth metrics to admin dashboard
- Color-coded trust scores with animated progress bars

Deploy: Settings + HomePage + Admin Analytics (Safe changes only)"

echo ""
echo "✅ Committed changes"
echo ""
echo "🚀 Pushing to main branch..."
git push origin main

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "📊 Next steps:"
echo "1. Wait for your hosting platform to rebuild"
echo "2. Visit your live website"
echo "3. Test Settings page (/settings)"
echo "4. Check admin dashboard if you're admin"
echo ""
echo "⚠️  If you see 400 errors on Settings:"
echo "   → Check if RLS policies are in production Supabase"
echo "   → Run rls.sql in production if needed"
echo ""
