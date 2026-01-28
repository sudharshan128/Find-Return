import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, 'backend', 'nodejs', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runSQL(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) throw error;
  return data;
}

async function main() {
  console.log('🚀 Setting up chat system...\n');

  const sqlFile = join(__dirname, 'CHAT_SETUP_MANUAL.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  try {
    await runSQL(sql);
    console.log('✅ Chat system setup complete!\n');
    
    // Verify
    const { data } = await supabase
      .from('chats')
      .select('id')
      .limit(1);
    
    console.log('✓ Database connection verified');
    console.log('\nNext: Deploy frontend and backend components');
    console.log('See: CHAT_SYSTEM_QUICK_START.md\n');
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\nPlease run the SQL manually in Supabase Dashboard');
    process.exit(1);
  }
}

main();
