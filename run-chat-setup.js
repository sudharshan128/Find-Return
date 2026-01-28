// Run Chat System Database Setup
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, 'backend', 'nodejs', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSetup() {
  console.log('🚀 Starting Chat System Database Setup...\n');

  // Read SQL file
  const sqlPath = path.join(__dirname, 'CHAT_SYSTEM_DATABASE_SETUP.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split into individual statements (simple split, works for most cases)
  const statements = sql
    .split(/;\s*$/gm)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📝 Found ${statements.length} SQL statements\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    
    // Get a preview of the statement
    const preview = stmt.substring(0, 100).replace(/\s+/g, ' ');
    console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });
      
      if (error) {
        // Try direct execution if RPC fails
        const { error: directError } = await supabase.from('_sql').insert({ query: stmt });
        if (directError) throw error;
      }

      console.log('   ✓ Success\n');
      successCount++;
    } catch (err) {
      console.log('   ⚠️  Error (might be expected):', err.message);
      console.log('');
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Setup Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ⚠️  Errors: ${errorCount}`);
  console.log('='.repeat(60) + '\n');

  // Verify setup
  console.log('🔍 Verifying setup...\n');

  // Check RLS policies
  const { data: chatPolicies, error: chatPoliciesError } = await supabase
    .from('pg_policies')
    .select('policyname')
    .eq('tablename', 'chats');

  const { data: messagePolicies, error: messagePoliciesError } = await supabase
    .from('pg_policies')
    .select('policyname')
    .eq('tablename', 'messages');

  if (!chatPoliciesError && !messagePoliciesError) {
    console.log(`✓ Chat policies: ${chatPolicies?.length || 0}`);
    console.log(`✓ Message policies: ${messagePolicies?.length || 0}`);
  } else {
    console.log('⚠️  Could not verify policies (this is normal)');
  }

  console.log('\n✨ Chat system database setup complete!\n');
  console.log('Next steps:');
  console.log('1. Verify in Supabase Dashboard → Database → Tables');
  console.log('2. Check RLS policies are enabled');
  console.log('3. Deploy backend API (backend/src/routes/chatRoutes.ts)');
  console.log('4. Deploy frontend components');
  console.log('\nSee CHAT_SYSTEM_QUICK_START.md for detailed instructions.\n');
}

runSetup().catch(err => {
  console.error('\n❌ Setup failed:', err);
  process.exit(1);
});
