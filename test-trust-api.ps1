# ============================================
# Trust Score System - API Testing Script
# Test all backend endpoints
# ============================================

# Configuration
$baseUrl = "http://localhost:3000/api/trust-score"
$userToken = "YOUR_USER_TOKEN_HERE"  # Replace with actual JWT token
$adminToken = "YOUR_ADMIN_TOKEN_HERE"  # Replace with actual admin JWT token

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Trust Score API Testing Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Get current user's trust score
Write-Host "Test 1: GET /api/trust-score/me" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/me" `
        -Method Get `
        -Headers @{
            "Authorization" = "Bearer $userToken"
            "Content-Type" = "application/json"
        }
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host "Trust Score: $($response.data.trust_score)" -ForegroundColor White
    Write-Host "Trust Level: $($response.data.trust_level)" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "❌ FAILED: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 2: Get user's trust history
Write-Host "Test 2: GET /api/trust-score/me/logs" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/me/logs?limit=10" `
        -Method Get `
        -Headers @{
            "Authorization" = "Bearer $userToken"
            "Content-Type" = "application/json"
        }
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host "Total Events: $($response.data.Count)" -ForegroundColor White
    if ($response.data.Count -gt 0) {
        Write-Host "Latest Event: $($response.data[0].actionType) ($($response.data[0].pointsChange) points)" -ForegroundColor White
    }
    Write-Host ""
} catch {
    Write-Host "❌ FAILED: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 3: Get user's trust summary
Write-Host "Test 3: GET /api/trust-score/me/summary" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/me/summary" `
        -Method Get `
        -Headers @{
            "Authorization" = "Bearer $userToken"
            "Content-Type" = "application/json"
        }
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host "Total Events: $($response.data.totalTrustEvents)" -ForegroundColor White
    Write-Host "Positive Events: $($response.data.positiveEvents)" -ForegroundColor White
    Write-Host "Negative Events: $($response.data.negativeEvents)" -ForegroundColor White
    Write-Host "Points Earned: +$($response.data.totalPointsEarned)" -ForegroundColor Green
    Write-Host "Points Lost: $($response.data.totalPointsLost)" -ForegroundColor Red
    Write-Host ""
} catch {
    Write-Host "❌ FAILED: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 4: Admin - Get specific user's trust score
Write-Host "Test 4: GET /api/trust-score/admin/user/:userId (Admin)" -ForegroundColor Yellow
$targetUserId = Read-Host "Enter user ID to check (or press Enter to skip)"
if ($targetUserId) {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/admin/user/$targetUserId" `
            -Method Get `
            -Headers @{
                "Authorization" = "Bearer $adminToken"
                "Content-Type" = "application/json"
            }
        Write-Host "✅ SUCCESS" -ForegroundColor Green
        Write-Host "User: $($response.data.name)" -ForegroundColor White
        Write-Host "Trust Score: $($response.data.trust_score)" -ForegroundColor White
        Write-Host "Trust Level: $($response.data.trust_level)" -ForegroundColor White
        Write-Host ""
    } catch {
        Write-Host "❌ FAILED: $_" -ForegroundColor Red
        Write-Host ""
    }
} else {
    Write-Host "⏭️  SKIPPED" -ForegroundColor Gray
    Write-Host ""
}

# Test 5: Admin - Flag user
Write-Host "Test 5: POST /api/trust-score/admin/flag-user (Admin)" -ForegroundColor Yellow
$flagUserId = Read-Host "Enter user ID to flag (or press Enter to skip)"
if ($flagUserId) {
    $flagReason = Read-Host "Enter reason for flagging"
    try {
        $body = @{
            userId = $flagUserId
            reason = $flagReason
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$baseUrl/admin/flag-user" `
            -Method Post `
            -Headers @{
                "Authorization" = "Bearer $adminToken"
                "Content-Type" = "application/json"
            } `
            -Body $body
        
        Write-Host "✅ SUCCESS" -ForegroundColor Green
        Write-Host "Previous Score: $($response.data.previousScore)" -ForegroundColor White
        Write-Host "New Score: $($response.data.newScore)" -ForegroundColor White
        Write-Host "Points Changed: $($response.data.newScore - $response.data.previousScore)" -ForegroundColor Red
        Write-Host ""
    } catch {
        Write-Host "❌ FAILED: $_" -ForegroundColor Red
        Write-Host ""
    }
} else {
    Write-Host "⏭️  SKIPPED" -ForegroundColor Gray
    Write-Host ""
}

# Test 6: Admin - Override trust score
Write-Host "Test 6: POST /api/trust-score/admin/override (Admin)" -ForegroundColor Yellow
$overrideUserId = Read-Host "Enter user ID to override (or press Enter to skip)"
if ($overrideUserId) {
    $newScore = Read-Host "Enter new score (0-100)"
    $overrideReason = Read-Host "Enter reason for override"
    
    try {
        $body = @{
            userId = $overrideUserId
            newScore = [int]$newScore
            reason = $overrideReason
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$baseUrl/admin/override" `
            -Method Post `
            -Headers @{
                "Authorization" = "Bearer $adminToken"
                "Content-Type" = "application/json"
            } `
            -Body $body
        
        Write-Host "✅ SUCCESS" -ForegroundColor Green
        Write-Host "Previous Score: $($response.data.previousScore)" -ForegroundColor White
        Write-Host "New Score: $($response.data.newScore)" -ForegroundColor White
        Write-Host "Previous Level: $($response.data.previousLevel)" -ForegroundColor White
        Write-Host "New Level: $($response.data.newLevel)" -ForegroundColor White
        Write-Host ""
    } catch {
        Write-Host "❌ FAILED: $_" -ForegroundColor Red
        Write-Host ""
    }
} else {
    Write-Host "⏭️  SKIPPED" -ForegroundColor Gray
    Write-Host ""
}

# Test 7: Admin - Get analytics
Write-Host "Test 7: GET /api/trust-score/admin/analytics (Admin)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/admin/analytics" `
        -Method Get `
        -Headers @{
            "Authorization" = "Bearer $adminToken"
            "Content-Type" = "application/json"
        }
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host "Total Users: $($response.data.totalUsers)" -ForegroundColor White
    Write-Host "Average Score: $($response.data.averageScore)" -ForegroundColor White
    Write-Host "Distribution:" -ForegroundColor White
    foreach ($level in $response.data.distribution) {
        Write-Host "  $($level.trustLevel): $($level.count) users" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "❌ FAILED: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 8: Admin - Get leaderboard
Write-Host "Test 8: GET /api/trust-score/admin/leaderboard (Admin)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/admin/leaderboard?limit=10" `
        -Method Get `
        -Headers @{
            "Authorization" = "Bearer $adminToken"
            "Content-Type" = "application/json"
        }
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host "Top 10 Users:" -ForegroundColor White
    $rank = 1
    foreach ($user in $response.data) {
        Write-Host "$rank. $($user.name) - Score: $($user.trustScore) ($($user.trustLevel))" -ForegroundColor Gray
        $rank++
    }
    Write-Host ""
} catch {
    Write-Host "❌ FAILED: $_" -ForegroundColor Red
    Write-Host ""
}

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Testing Complete!" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Check Supabase logs for any errors" -ForegroundColor White
Write-Host "2. Run TEST_TRUST_SCORE.sql in Supabase SQL Editor" -ForegroundColor White
Write-Host "3. Test automatic triggers (email verify, claim approve, etc.)" -ForegroundColor White
Write-Host "4. Set up daily cron job for maintenance" -ForegroundColor White
Write-Host ""
