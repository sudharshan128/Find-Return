-- ============================================================
-- CREATE TEST DATA FOR ADMIN DASHBOARD
-- ============================================================
-- Run this to populate your database with sample data
-- for testing the admin dashboard charts
-- ============================================================

-- Get your user ID (replace with your actual UUID)
-- Find your UUID by running: SELECT user_id FROM user_profiles WHERE email = 'your@email.com';

-- Example: Get first user's ID
DO $$
DECLARE
  test_user_id UUID;
  test_category_id UUID;
  test_area_id UUID;
  test_item_id UUID;
BEGIN
  -- Get first user
  SELECT user_id INTO test_user_id FROM user_profiles LIMIT 1;
  
  -- Get first category
  SELECT id INTO test_category_id FROM categories WHERE is_active = true LIMIT 1;
  
  -- Get first area
  SELECT id INTO test_area_id FROM areas WHERE is_active = true LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found. Please create a user account first.';
  END IF;

  -- Create 5 test items (spread over last 5 days)
  FOR i IN 1..5 LOOP
    INSERT INTO items (
      finder_id,
      category_id,
      area_id,
      title,
      description,
      status,
      date_found,
      created_at
    ) VALUES (
      test_user_id,
      test_category_id,
      test_area_id,
      'Test Item ' || i,
      'This is a test item for dashboard testing',
      CASE 
        WHEN i = 5 THEN 'returned'
        WHEN i = 4 THEN 'claimed'
        ELSE 'active'
      END,
      CURRENT_DATE - (i || ' days')::INTERVAL,
      NOW() - (i || ' days')::INTERVAL
    ) RETURNING id INTO test_item_id;

    -- Create claims for items 4 and 5
    IF i IN (4, 5) THEN
      INSERT INTO claims (
        item_id,
        claimant_id,
        status,
        created_at
      ) VALUES (
        test_item_id,
        test_user_id,
        CASE WHEN i = 5 THEN 'approved' ELSE 'pending' END,
        NOW() - (i || ' days')::INTERVAL
      );
    END IF;
  END LOOP;

  -- Create 2 test abuse reports
  INSERT INTO abuse_reports (
    reporter_id,
    report_type,
    target_type,
    target_id,
    reason,
    description,
    status,
    created_at
  ) VALUES 
    (
      test_user_id,
      'spam',
      'item',
      test_item_id,
      'suspicious_activity',
      'Test report 1',
      'pending',
      NOW() - INTERVAL '1 day'
    ),
    (
      test_user_id,
      'inappropriate',
      'item',
      test_item_id,
      'harassment',
      'Test report 2',
      'pending',
      NOW() - INTERVAL '2 days'
    );

  RAISE NOTICE 'Test data created successfully!';
  RAISE NOTICE 'Created: 5 items, 2 claims, 2 reports';
END $$;

-- Verify the data was created
SELECT 
  (SELECT COUNT(*) FROM items WHERE created_at >= NOW() - INTERVAL '7 days') as items_last_7_days,
  (SELECT COUNT(*) FROM claims WHERE created_at >= NOW() - INTERVAL '7 days') as claims_last_7_days,
  (SELECT COUNT(*) FROM abuse_reports WHERE created_at >= NOW() - INTERVAL '7 days') as reports_last_7_days;

SELECT 'Test data created! Refresh your admin dashboard.' as status;
