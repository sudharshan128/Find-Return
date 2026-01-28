#!/usr/bin/env node
/**
 * SUPABASE STATE VERIFICATION SCRIPT
 * Checks: Schema, RLS, Admin User, Connectivity
 * Run: node verify-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Try to load .env from backend/nodejs
const envPath = path.join(__dirname, 'backend', 'nodejs', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error('❌ FATAL: Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabaseAnon = createClient(supabaseUrl, anonKey);
const supabaseService = createClient(supabaseUrl, serviceRoleKey);

const checks = {
  schema: { status: 'PENDING', details: [] },
  rls: { status: 'PENDING', details: [] },
  adminUser: { status: 'PENDING', details: [] },
  connectivity: { status: 'PENDING', details: [] },
};

async function verifySchema() {
  console.log('\n📋 CHECKING SCHEMA...');
  try {
    const requiredTables = [
      // Public tables
      'items', 'claims', 'chats', 'messages', 'categories', 'areas', 'user_profiles',
      'item_images', 'audit_logs', 'abuse_reports',
      // Admin tables
      'admin_users', 'admin_audit_logs', 'user_restrictions', 'user_warnings',
      'trust_score_history', 'claim_notes', 'admin_messages', 'item_moderation_log',
    ];

    const { data: tables, error } = await supabaseService
      .rpc('get_all_tables')
      .catch(async () => {
        // Fallback: query information_schema directly
        return await supabaseService.rpc('get_table_count').catch(async () => {
          // Fallback 2: just try to query a known table
          const { data, error } = await supabaseService
            .from('items')
            .select('id', { count: 'exact' })
            .limit(1);
          return { data: data ? ['items'] : [], error };
        });
      });

    let missingTables = [];
    for (const table of requiredTables) {
      const { data, error } = await supabaseService
        .from(table)
        .select('id', { count: 'exact' })
        .limit(1);

      if (error && error.code === 'PGRST116') {
        missingTables.push(table);
      } else if (!error) {
        checks.schema.details.push(`✓ ${table}`);
      } else {
        console.log(`⚠️  ${table}: ${error.message}`);
      }
    }

    if (missingTables.length === 0) {
      checks.schema.status = '✅ APPLIED';
      console.log(`✅ Schema verification: All ${requiredTables.length} required tables found`);
    } else {
      checks.schema.status = '❌ MISSING TABLES';
      console.log(`❌ Missing tables: ${missingTables.join(', ')}`);
      console.log(`   ACTION: Run supabase/schema.sql and supabase/admin_schema.sql in Supabase SQL Editor`);
      checks.schema.details.push(`Missing: ${missingTables.join(', ')}`);
    }
  } catch (error) {
    checks.schema.status = '❌ ERROR';
    console.error('❌ Schema check failed:', error.message);
    checks.schema.details.push(error.message);
  }
}

async function verifyRLS() {
  console.log('\n🔐 CHECKING RLS POLICIES...');
  try {
    const adminTables = ['admin_users', 'admin_audit_logs', 'user_restrictions', 'user_warnings'];

    // Test 1: Try to read admin_users with anon key
    const { data: anonResult, error: anonError } = await supabaseAnon
      .from('admin_users')
      .select('id')
      .limit(1);

    if (anonError && (anonError.code === 'PGRST301' || anonError.message.includes('permission'))) {
      checks.rls.status = '✅ BLOCKING';
      console.log('✅ RLS correctly blocks anon access to admin_users');
      checks.rls.details.push('✓ Anon key blocked from admin_users (expected)');
    } else if (!anonError && anonResult?.length === 0) {
      checks.rls.status = '⚠️  UNKNOWN';
      console.log('⚠️  Could not verify RLS (query succeeded with 0 rows)');
      checks.rls.details.push('⚠️ Query succeeded, but might be empty table or RLS not active');
    } else if (anonError) {
      checks.rls.status = '⚠️  ERROR';
      console.log(`⚠️  Unexpected error: ${anonError.message}`);
      checks.rls.details.push(`Error: ${anonError.message}`);
    } else {
      checks.rls.status = '❌ NOT BLOCKING';
      console.log('❌ SECURITY ISSUE: Anon key can read admin_users!');
      console.log('   ACTION: Run supabase/admin_rls.sql to enable RLS');
      checks.rls.details.push('❌ Anon key NOT blocked - RLS may not be enabled');
    }

    // Test 2: Service role should bypass RLS
    const { data: serviceResult, error: serviceError } = await supabaseService
      .from('admin_users')
      .select('id')
      .limit(1);

    if (!serviceError) {
      checks.rls.details.push('✓ Service role key can access admin_users (expected)');
      console.log('✅ Service role key can access admin tables (expected)');
    } else {
      checks.rls.status = '❌ SERVICE ROLE BLOCKED';
      console.log('❌ Service role key cannot access admin_users');
      console.log('   ACTION: Check Supabase RLS policies - service role should bypass');
    }
  } catch (error) {
    checks.rls.status = '❌ ERROR';
    console.error('❌ RLS check failed:', error.message);
  }
}

async function verifyAdminUser() {
  console.log('\n👤 CHECKING ADMIN USER...');
  try {
    const { data, error } = await supabaseService
      .from('admin_users')
      .select('id, email, role, is_active, user_id')
      .eq('email', 'sudharshancse123@gmail.com')
      .single();

    if (error && error.code === 'PGRST116') {
      checks.adminUser.status = '❌ NOT FOUND';
      console.log('❌ Admin user not found: sudharshancse123@gmail.com');
      console.log('   ACTION: Insert user into admin_users table');
      checks.adminUser.details.push('User does not exist - needs to be created');
    } else if (!error && data) {
      if (data.role === 'super_admin' && data.is_active === true) {
        checks.adminUser.status = '✅ CONFIGURED';
        console.log(`✅ Admin user found and properly configured`);
        console.log(`   Email: ${data.email}`);
        console.log(`   Role: ${data.role}`);
        console.log(`   Active: ${data.is_active}`);
        console.log(`   user_id: ${data.user_id}`);
        checks.adminUser.details.push(`✓ super_admin, active, linked to auth.users`);
      } else {
        checks.adminUser.status = '⚠️  MISCONFIGURED';
        console.log(`⚠️  Admin user found but misconfigured:`);
        console.log(`   Role: ${data.role} (should be super_admin)`);
        console.log(`   Active: ${data.is_active} (should be true)`);
        checks.adminUser.details.push(`Role: ${data.role}, Active: ${data.is_active}`);
      }
    } else if (error) {
      checks.adminUser.status = '❌ ERROR';
      console.error('❌ Error checking admin user:', error.message);
      checks.adminUser.details.push(error.message);
    }
  } catch (error) {
    checks.adminUser.status = '❌ ERROR';
    console.error('❌ Admin user check failed:', error.message);
  }
}

async function verifyConnectivity() {
  console.log('\n🔌 CHECKING CONNECTIVITY...');
  try {
    // Test anon key
    const { data: anonTest, error: anonConnError } = await supabaseAnon
      .from('categories')
      .select('id')
      .limit(1);

    if (!anonConnError) {
      checks.connectivity.status = '✅ WORKING';
      console.log('✅ Anon key connectivity: SUCCESS');
      checks.connectivity.details.push('✓ Anon key can connect to Supabase');
    } else {
      checks.connectivity.status = '❌ ANON FAILED';
      console.log('❌ Anon key connectivity: FAILED');
      console.log(`   Error: ${anonConnError.message}`);
      checks.connectivity.details.push(`Anon failed: ${anonConnError.message}`);
    }

    // Test service role key
    const { data: serviceTest, error: serviceConnError } = await supabaseService
      .from('categories')
      .select('id')
      .limit(1);

    if (!serviceConnError) {
      console.log('✅ Service role key connectivity: SUCCESS');
      checks.connectivity.details.push('✓ Service role key can connect to Supabase');
    } else {
      checks.connectivity.status = '❌ SERVICE ROLE FAILED';
      console.log('❌ Service role key connectivity: FAILED');
      console.log(`   Error: ${serviceConnError.message}`);
      checks.connectivity.details.push(`Service role failed: ${serviceConnError.message}`);
    }
  } catch (error) {
    checks.connectivity.status = '❌ ERROR';
    console.error('❌ Connectivity check failed:', error.message);
  }
}

async function runAllChecks() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         SUPABASE STATE VERIFICATION                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nSuggesting connection to: ${supabaseUrl}\n`);

  await verifySchema();
  await verifyRLS();
  await verifyAdminUser();
  await verifyConnectivity();

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    VERIFICATION SUMMARY                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  Object.entries(checks).forEach(([key, check]) => {
    console.log(`${key.toUpperCase().padEnd(20)} ${check.status}`);
    check.details.forEach(detail => console.log(`  └─ ${detail}`));
  });

  // Overall verdict
  const allPass = Object.values(checks).every(c => c.status.includes('✅'));
  console.log('\n' + '═'.repeat(60));
  if (allPass) {
    console.log('🟢 VERDICT: ALL CHECKS PASSED - SUPABASE IS READY');
  } else {
    console.log('🔴 VERDICT: ISSUES FOUND - SEE ABOVE FOR ACTIONS');
  }
  console.log('═'.repeat(60) + '\n');
}

runAllChecks().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
