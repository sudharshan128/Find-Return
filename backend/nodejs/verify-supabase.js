#!/usr/bin/env node
/**
 * SUPABASE STATE VERIFICATION SCRIPT
 * Checks: Schema, RLS, Admin User, Connectivity
 * Run: node verify-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load .env from current directory
require('dotenv').config({ path: path.join(__dirname, '.env') });

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
      'items', 'claims', 'chats', 'messages', 'categories', 'areas', 'user_profiles',
      'item_images', 'audit_logs', 'abuse_reports',
      'admin_users', 'admin_audit_logs', 'user_restrictions', 'user_warnings',
      'trust_score_history', 'claim_admin_notes', 'admin_messages', 'item_moderation_log',
    ];

    let missingTables = [];
    for (const table of requiredTables) {
      const { error } = await supabaseService
        .from(table)
        .select('*', { count: 'exact' })
        .limit(1);

      // Error code PGRST116 = empty table, which is OK
      if (error && error.code !== 'PGRST116') {
        missingTables.push(table);
      }
    }

    if (missingTables.length === 0) {
      checks.schema.status = '✅ APPLIED';
      checks.schema.details = [`✅ All ${requiredTables.length} required tables exist`];
      console.log(`✅ All ${requiredTables.length} required tables found`);
    } else {
      checks.schema.status = '❌ MISSING';
      checks.schema.details = [`❌ Missing tables: ${missingTables.join(', ')}`];
      console.log(`❌ Missing tables: ${missingTables.join(', ')}`);
      console.log('   ACTION: Run supabase/schema.sql and supabase/admin_schema.sql');
    }
  } catch (error) {
    checks.schema.status = '❌ ERROR';
    checks.schema.details = [`Error: ${error.message}`];
    console.log(`❌ Schema check failed: ${error.message}`);
  }
}

async function verifyRLS() {
  console.log('\n🔐 CHECKING RLS POLICIES...');
  try {
    // Test: Try to read admin_users with anon key (should be blocked)
    const { data, error } = await supabaseAnon
      .from('admin_users')
      .select('id')
      .limit(1);

    if (error && (error.code === 'PGRST301' || error.message.includes('permission'))) {
      checks.rls.status = '✅ BLOCKING';
      checks.rls.details = ['✓ Anon key blocked from admin_users (RLS active)'];
      console.log('✅ RLS correctly blocks anon access to admin_users');
    } else if (error) {
      checks.rls.status = '⚠️  UNKNOWN';
      checks.rls.details = [`⚠️ ${error.message}`];
      console.log(`⚠️  Could not verify RLS: ${error.message}`);
    } else if (data && data.length > 0) {
      checks.rls.status = '❌ NOT BLOCKING';
      checks.rls.details = ['❌ Anon key can read admin_users - SECURITY ISSUE!'];
      console.log('❌ SECURITY ISSUE: Anon key can read admin_users!');
      console.log('   ACTION: Run supabase/admin_rls.sql to enable RLS');
    } else {
      checks.rls.status = '✅ BLOCKING';
      checks.rls.details = ['✓ Anon key blocked from admin_users'];
      console.log('✅ RLS correctly blocks anon access (empty or restricted)');
    }

    // Test service role can access (should succeed)
    const { data: serviceData, error: serviceError } = await supabaseService
      .from('admin_users')
      .select('id')
      .limit(1);

    if (!serviceError) {
      checks.rls.details.push('✓ Service role key can access admin_users (expected)');
      console.log('✅ Service role key can access admin tables (expected)');
    }
  } catch (error) {
    checks.rls.status = '❌ ERROR';
    checks.rls.details = [`Error: ${error.message}`];
    console.log(`❌ RLS check failed: ${error.message}`);
  }
}

async function verifyAdminUser() {
  console.log('\n👤 CHECKING ADMIN USER...');
  try {
    const { data, error } = await supabaseService
      .from('admin_users')
      .select('id, email, role, is_active')
      .eq('email', 'sudharshancse123@gmail.com')
      .single();

    if (error && error.code === 'PGRST116') {
      checks.adminUser.status = '⚠️  MISSING';
      checks.adminUser.details = ['⚠️ Admin user sudharshancse123@gmail.com not found'];
      console.log('⚠️  Admin user not found: sudharshancse123@gmail.com');
      console.log('   ACTION: Insert admin user or verify auth user exists');
    } else if (error) {
      checks.adminUser.status = '❌ ERROR';
      checks.adminUser.details = [`Error: ${error.message}`];
      console.log(`❌ Admin user check failed: ${error.message}`);
    } else if (data) {
      if (data.role === 'super_admin' && data.is_active) {
        checks.adminUser.status = '✅ CONFIGURED';
        checks.adminUser.details = [
          `✅ Email: ${data.email}`,
          `✅ Role: ${data.role}`,
          `✅ Active: ${data.is_active}`,
          `✅ User ID: ${data.id}`,
        ];
        console.log('✅ Admin user found and properly configured');
        console.log(`   Email: ${data.email}`);
        console.log(`   Role: ${data.role}`);
        console.log(`   Active: ${data.is_active}`);
        console.log(`   User ID: ${data.id}`);
      } else {
        checks.adminUser.status = '⚠️  MISCONFIGURED';
        checks.adminUser.details = [
          `⚠️ Found but inactive or wrong role: role=${data.role}, active=${data.is_active}`,
        ];
        console.log(`⚠️  Admin user found but misconfigured`);
        console.log(`   Role: ${data.role} (should be super_admin)`);
        console.log(`   Active: ${data.is_active} (should be true)`);
      }
    }
  } catch (error) {
    checks.adminUser.status = '❌ ERROR';
    checks.adminUser.details = [`Error: ${error.message}`];
    console.log(`❌ Admin user check failed: ${error.message}`);
  }
}

async function verifyConnectivity() {
  console.log('\n🔌 CHECKING CONNECTIVITY...');
  try {
    // Test anon key
    const anonTest = await supabaseAnon.from('categories').select('id').limit(1);
    const anonOk = !anonTest.error;

    // Test service role key
    const serviceTest = await supabaseService.from('categories').select('id').limit(1);
    const serviceOk = !serviceTest.error;

    if (anonOk && serviceOk) {
      checks.connectivity.status = '✅ OK';
      checks.connectivity.details = [
        '✅ Anon key connectivity: SUCCESS',
        '✅ Service role key connectivity: SUCCESS',
      ];
      console.log('✅ Anon key connectivity: SUCCESS');
      console.log('✅ Service role key connectivity: SUCCESS');
    } else if (anonOk) {
      checks.connectivity.status = '⚠️  PARTIAL';
      checks.connectivity.details = [
        '✅ Anon key: OK',
        `❌ Service role key: ${serviceTest.error?.message}`,
      ];
      console.log('✅ Anon key connectivity: SUCCESS');
      console.log(`❌ Service role key failed: ${serviceTest.error?.message}`);
    } else if (serviceOk) {
      checks.connectivity.status = '⚠️  PARTIAL';
      checks.connectivity.details = [
        `❌ Anon key: ${anonTest.error?.message}`,
        '✅ Service role key: OK',
      ];
      console.log(`❌ Anon key failed: ${anonTest.error?.message}`);
      console.log('✅ Service role key connectivity: SUCCESS');
    } else {
      checks.connectivity.status = '❌ FAILED';
      checks.connectivity.details = [
        `❌ Anon key: ${anonTest.error?.message}`,
        `❌ Service role key: ${serviceTest.error?.message}`,
      ];
      console.log(`❌ Anon key failed: ${anonTest.error?.message}`);
      console.log(`❌ Service role key failed: ${serviceTest.error?.message}`);
    }
  } catch (error) {
    checks.connectivity.status = '❌ ERROR';
    checks.connectivity.details = [`Error: ${error.message}`];
    console.log(`❌ Connectivity check failed: ${error.message}`);
  }
}

function printSummary() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║              VERIFICATION SUMMARY                  ║');
  console.log('╚════════════════════════════════════════════════════╝');

  console.log(`\nSCHEMA               ${checks.schema.status}`);
  checks.schema.details.forEach((d) => console.log(`  └─ ${d}`));

  console.log(`\nRLS                  ${checks.rls.status}`);
  checks.rls.details.forEach((d) => console.log(`  └─ ${d}`));

  console.log(`\nADMIN USER           ${checks.adminUser.status}`);
  checks.adminUser.details.forEach((d) => console.log(`  └─ ${d}`));

  console.log(`\nCONNECTIVITY         ${checks.connectivity.status}`);
  checks.connectivity.details.forEach((d) => console.log(`  └─ ${d}`));

  const allOk = 
    checks.schema.status.includes('✅') &&
    (checks.rls.status.includes('✅') || checks.rls.status.includes('BLOCKING')) &&
    (checks.adminUser.status.includes('✅') || checks.adminUser.status.includes('CONFIGURED')) &&
    checks.connectivity.status.includes('✅');

  console.log('\n' + '═'.repeat(54));
  if (allOk) {
    console.log('🟢 VERDICT: SUPABASE STATE OK - READY FOR OPERATIONS');
  } else {
    console.log('🔴 VERDICT: ISSUES FOUND - SEE ABOVE FOR ACTIONS');
  }
  console.log('═'.repeat(54) + '\n');

  process.exit(allOk ? 0 : 1);
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║     SUPABASE STATE VERIFICATION SCRIPT              ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log(`\nConnecting to: ${supabaseUrl}\n`);

  await verifySchema();
  await verifyRLS();
  await verifyAdminUser();
  await verifyConnectivity();

  printSummary();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
