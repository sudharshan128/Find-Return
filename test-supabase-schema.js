#!/usr/bin/env node
/**
 * Quick Supabase Schema & Data Verification
 * 
 * Run this to see:
 * 1. What tables actually exist
 * 2. How many items/users/claims exist
 * 3. Whether admin tables exist
 * 4. Sample data from each table
 */

// Load environment variables
const dotenv = require('dotenv');
const path = require('path');

// Try to load from backend .env
try {
  const envPath = path.join(__dirname, 'backend/nodejs/.env.local');
  dotenv.config({ path: envPath });
} catch (e) {
  // .env might not exist, that's ok
}

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Set these in backend/nodejs/.env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('\n======================================');
  console.log('SUPABASE SCHEMA VERIFICATION');
  console.log('======================================\n');

  try {
    // Get all public tables
    const { data: tables, error: tablesError } = await supabase.rpc('get_table_list', {}, {
      count: 'exact',
    });

    // Fallback: query information_schema directly
    let allTables = [];
    try {
      const { data } = await supabase
        .from('information_schema')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (data) {
        allTables = data.map(row => row.table_name);
      }
    } catch (e) {
      // Fallback: test existence of critical tables manually
      const criticalTables = [
        'items', 'user_profiles', 'categories', 'areas',
        'claims', 'item_images', 'chats', 'messages',
        'abuse_reports', 'audit_logs', 'admin_users',
        'admin_audit_logs', 'admin_messages', 'user_warnings',
        'user_restrictions', 'trust_score_history'
      ];

      console.log('Checking critical tables:');
      for (const tableName of criticalTables) {
        try {
          const { count } = await supabase
            .from(tableName)
            .select('id', { count: 'exact' });
          allTables.push(tableName);
          console.log(`  ✅ ${tableName}: ${count || 0} rows`);
        } catch (e) {
          console.log(`  ❌ ${tableName}: NOT FOUND`);
        }
      }
    }

    console.log('\n======================================');
    console.log('CRITICAL TABLES CHECK');
    console.log('======================================\n');

    const requiredTables = [
      'items',
      'user_profiles',
      'categories',
      'areas',
      'admin_users',
      'admin_audit_logs',
    ];

    for (const table of requiredTables) {
      try {
        const { count, data } = await supabase
          .from(table)
          .select('id', { count: 'exact' })
          .limit(1);

        const status = allTables.includes(table) ? '✅' : '❌';
        console.log(`${status} ${table}: ${count || 0} records`);
      } catch (e) {
        console.log(`❌ ${table}: ERROR - ${e.message}`);
      }
    }

    console.log('\n======================================');
    console.log('SAMPLE DATA');
    console.log('======================================\n');

    // Sample items
    try {
      const { data: items, count } = await supabase
        .from('items')
        .select('id, title, status, created_at, finder_id')
        .limit(3);

      console.log(`\nItems (${count} total):`);
      if (items?.length > 0) {
        items.forEach(item => {
          console.log(`  - ID: ${item.id.substring(0, 8)}...`);
          console.log(`    Title: ${item.title}`);
          console.log(`    Status: ${item.status}`);
          console.log(`    Finder: ${item.finder_id?.substring(0, 8) || 'N/A'}...`);
          console.log(`    Created: ${new Date(item.created_at).toLocaleDateString()}`);
        });
      } else {
        console.log('  No items found');
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }

    // Sample users
    try {
      const { data: users, count } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, email, created_at')
        .limit(3);

      console.log(`\nUser Profiles (${count} total):`);
      if (users?.length > 0) {
        users.forEach(user => {
          console.log(`  - ID: ${user.user_id.substring(0, 8)}...`);
          console.log(`    Name: ${user.full_name || 'N/A'}`);
          console.log(`    Email: ${user.email || 'N/A'}`);
          console.log(`    Created: ${new Date(user.created_at).toLocaleDateString()}`);
        });
      } else {
        console.log('  No users found');
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }

    // Sample claims
    try {
      const { data: claims, count } = await supabase
        .from('claims')
        .select('id, item_id, claimer_id, status, created_at')
        .limit(3);

      console.log(`\nClaims (${count} total):`);
      if (claims?.length > 0) {
        claims.forEach(claim => {
          console.log(`  - ID: ${claim.id.substring(0, 8)}...`);
          console.log(`    Item: ${claim.item_id.substring(0, 8)}...`);
          console.log(`    Claimer: ${claim.claimer_id.substring(0, 8)}...`);
          console.log(`    Status: ${claim.status}`);
          console.log(`    Created: ${new Date(claim.created_at).toLocaleDateString()}`);
        });
      } else {
        console.log('  No claims found');
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }

    // Admin users
    try {
      const { data: adminUsers, count } = await supabase
        .from('admin_users')
        .select('id, is_active, twofa_enabled')
        .limit(3);

      console.log(`\nAdmin Users (${count} total):`);
      if (adminUsers?.length > 0) {
        adminUsers.forEach(admin => {
          console.log(`  - ID: ${admin.id.substring(0, 8)}...`);
          console.log(`    Active: ${admin.is_active}`);
          console.log(`    2FA: ${admin.twofa_enabled}`);
        });
      } else {
        console.log('  No admin users found');
      }
    } catch (e) {
      console.log(`  Admin users table not found or error: ${e.message}`);
    }

    console.log('\n======================================');
    console.log('VERIFICATION COMPLETE');
    console.log('======================================\n');
    console.log('Next Steps:');
    console.log('1. If admin_users shows "not found", apply supabase/admin_schema.sql');
    console.log('2. If items/users/claims show 0, you need test data');
    console.log('3. Run: npm run dev (to start servers)');
    console.log('4. Open: http://localhost:5173 (frontend)');
    console.log('5. Open: http://localhost:3000 (backend)');

  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

checkSchema();
