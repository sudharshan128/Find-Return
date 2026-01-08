-- ============================================================
-- TEST DATA FOR LOST & FOUND BANGALORE
-- ============================================================
-- Run this in Supabase SQL Editor to add sample items
-- 
-- IMPORTANT: First create a test user by signing in with Google,
-- then get their user_id from user_profiles table
-- ============================================================

-- Step 1: Check existing users (run this first to get a user_id)
-- SELECT user_id, email, full_name FROM user_profiles LIMIT 5;

-- Step 2: Create a test user profile if none exists
-- This creates a system user for test data
DO $$
DECLARE
    test_user_id UUID;
    electronics_cat UUID;
    documents_cat UUID;
    wallets_cat UUID;
    keys_cat UUID;
    koramangala_area UUID;
    indiranagar_area UUID;
    mg_road_area UUID;
    whitefield_area UUID;
BEGIN
    -- Check if test user exists
    SELECT user_id INTO test_user_id FROM user_profiles WHERE email = 'test@lostfound.local' LIMIT 1;
    
    -- If no test user, use existing user or create one
    IF test_user_id IS NULL THEN
        SELECT user_id INTO test_user_id FROM user_profiles LIMIT 1;
    END IF;
    
    -- If still no user, we can't proceed
    IF test_user_id IS NULL THEN
        RAISE NOTICE 'No users found. Please sign in with Google first to create a user.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Using user_id: %', test_user_id;
    
    -- Get category IDs
    SELECT id INTO electronics_cat FROM categories WHERE slug = 'electronics';
    SELECT id INTO documents_cat FROM categories WHERE slug = 'documents';
    SELECT id INTO wallets_cat FROM categories WHERE slug = 'wallets-bags';
    SELECT id INTO keys_cat FROM categories WHERE slug = 'keys';
    
    -- Get area IDs
    SELECT id INTO koramangala_area FROM areas WHERE slug = 'koramangala';
    SELECT id INTO indiranagar_area FROM areas WHERE slug = 'indiranagar';
    SELECT id INTO mg_road_area FROM areas WHERE slug = 'mg-road';
    SELECT id INTO whitefield_area FROM areas WHERE slug = 'whitefield';
    
    -- Insert test items
    INSERT INTO items (finder_id, category_id, area_id, title, description, date_found, location_details, security_question, status)
    VALUES
    (
        test_user_id,
        electronics_cat,
        koramangala_area,
        'iPhone 14 Pro - Space Black',
        'Found this iPhone near Sony World Signal in Koramangala. Screen is intact, phone is locked. Has a clear case with some stickers on the back.',
        CURRENT_DATE - INTERVAL '2 days',
        'Near Sony World Signal, Koramangala 4th Block. Found on the footpath around 6 PM.',
        'What is the wallpaper image on the lock screen?',
        'active'
    ),
    (
        test_user_id,
        wallets_cat,
        indiranagar_area,
        'Brown Leather Wallet with Cards',
        'Found a premium leather wallet near 100 Feet Road, Indiranagar. Contains some cards (names not disclosed for privacy). No cash inside.',
        CURRENT_DATE - INTERVAL '1 day',
        '100 Feet Road, near the Starbucks outlet. Found around 8 AM while jogging.',
        'What is the name on the Aadhaar card inside?',
        'active'
    ),
    (
        test_user_id,
        keys_cat,
        mg_road_area,
        'Car Keys with Honda Keychain',
        'Found car keys near MG Road Metro Station exit. Has Honda logo on the remote and a small teddy bear keychain attached.',
        CURRENT_DATE - INTERVAL '3 days',
        'Outside MG Road Metro Station, Exit 2. Found on a bench around 5:30 PM.',
        'How many keys are on the keyring (excluding the car remote)?',
        'active'
    ),
    (
        test_user_id,
        documents_cat,
        whitefield_area,
        'Driving License and PAN Card',
        'Found important documents in a small pouch near ITPL Main Road, Whitefield. Documents appear to belong to someone working in the tech park area.',
        CURRENT_DATE,
        'Near ITPL Main Road bus stop, found in the morning around 9 AM.',
        'What is the date of birth printed on the driving license?',
        'active'
    ),
    (
        test_user_id,
        electronics_cat,
        indiranagar_area,
        'AirPods Pro (2nd Gen) Case',
        'Found AirPods Pro case near Toit Brewpub, Indiranagar. The case has AirPods inside. Has some scratches on the case.',
        CURRENT_DATE - INTERVAL '4 days',
        'Outside Toit Brewpub, found on a table in the outdoor seating area around 11 PM.',
        'What is the engraving text on the back of the case (if any)?',
        'active'
    );
    
    -- Update user stats
    UPDATE user_profiles 
    SET items_found_count = items_found_count + 5 
    WHERE user_id = test_user_id;
    
    RAISE NOTICE 'Successfully inserted 5 test items!';
END $$;

-- Verify the items were created
SELECT 
    i.id,
    i.title,
    c.name as category,
    a.name as area,
    i.status,
    i.date_found
FROM items i
JOIN categories c ON i.category_id = c.id
JOIN areas a ON i.area_id = a.id
ORDER BY i.created_at DESC
LIMIT 10;
