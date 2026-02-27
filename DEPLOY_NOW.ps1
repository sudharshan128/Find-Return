# PowerShell Deployment Script - Safe Changes Only
# Run this to deploy tested, safe changes to production

Write-Host "`n🚀 Deploying Settings UI + Admin Analytics (Safe Changes)" -ForegroundColor Cyan
Write-Host ""

Set-Location "D:\Dream project\Return"

# Stage only the safe files
git add frontend/src/pages/SettingsPage.jsx
git add frontend/src/pages/HomePage.jsx
git add backend/nodejs/src/services/supabase.ts
git add frontend/src/admin/pages/AdminDashboardPage.jsx

Write-Host "✅ Staged 4 files for deployment" -ForegroundColor Green
Write-Host ""

# Show what's being deployed
Write-Host "📦 Changes to deploy:" -ForegroundColor Yellow
git status --short

Write-Host ""
Write-Host "📝 Commit message:" -ForegroundColor Yellow
Write-Host "feat: Modern Settings UI + Enhanced Admin Analytics" -ForegroundColor White
Write-Host ""
Write-Host "- Redesigned Settings page with modern SaaS aesthetics" -ForegroundColor Gray
Write-Host "- Removed database warning banner from HomePage" -ForegroundColor Gray
Write-Host "- Added weekly/monthly user growth metrics to admin" -ForegroundColor Gray
Write-Host "- Color-coded trust scores with animated progress bars" -ForegroundColor Gray
Write-Host ""

# Commit
git commit -m "feat: Modern Settings UI + Enhanced Admin Analytics

- Redesigned Settings page with modern SaaS aesthetics
- Removed database warning banner from HomePage  
- Added weekly/monthly user growth metrics to admin dashboard
- Color-coded trust scores with animated progress bars

Deploy: Settings + HomePage + Admin Analytics (Safe changes only)"

Write-Host ""
Write-Host "✅ Committed changes" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Pushing to main branch..." -ForegroundColor Cyan
git push origin main

Write-Host ""
Write-Host "✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Next steps:" -ForegroundColor Yellow
Write-Host "1. Wait for your hosting platform to rebuild" -ForegroundColor White
Write-Host "2. Visit your live website" -ForegroundColor White
Write-Host "3. Test Settings page (/settings)" -ForegroundColor White
Write-Host "4. Check admin dashboard if you're admin" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  If you see 400 errors on Settings:" -ForegroundColor Red
Write-Host "   → Check if RLS policies are in production Supabase" -ForegroundColor White
Write-Host "   → Run rls.sql in production if needed" -ForegroundColor White
Write-Host ""
