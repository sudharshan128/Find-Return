-- ============================================================
-- ADMIN DASHBOARD DATA DIAGNOSTIC
-- Check if data exists for dashboard metrics
-- ============================================================

-- 1. Check items (last 14 days)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as new_items,
  COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned_items
FROM items
WHERE created_at >= NOW() - INTERVAL '14 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 2. Check claims (last 14 days)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as new_claims
FROM claims
WHERE created_at >= NOW() - INTERVAL '14 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

--3. Check abuse reports (last 14 days)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as new_reports
FROM abuse_reports
WHERE created_at >= NOW() - INTERVAL '14 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 4. Check users (last 14 days) - THIS ONE WORKS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as new_users
FROM user_profiles
WHERE created_at >= NOW() - INTERVAL '14 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 5. Quick summary
SELECT 
  (SELECT COUNT(*) FROM items) as total_items,
  (SELECT COUNT(*) FROM claims) as total_claims,
  (SELECT COUNT(*) FROM abuse_reports) as total_reports,
  (SELECT COUNT(*) FROM user_profiles) as total_users;
