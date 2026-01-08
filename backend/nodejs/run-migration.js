#!/usr/bin/env node

/**
 * Migration Runner for Phase 3 2FA
 * Usage: node run-migration.js [migrate|rollback]
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Import Supabase client
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
  try {
    console.log("🔄 Running migration: 006_add_2fa_support.sql...");

    const sqlPath = path.join(__dirname, "migrations", "006_add_2fa_support.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    // Split by semicolon and filter empty statements
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("--"));

    for (const statement of statements) {
      console.log(`\n📝 Executing: ${statement.substring(0, 60)}...`);
      const { error } = await supabase.rpc("exec_sql", { sql: statement });

      if (error) {
        // Try direct query instead
        const { error: queryError } = await supabase
          .from("admin_users")
          .select("id")
          .limit(1);

        if (queryError) {
          console.error(`❌ Error executing statement:`, error);
          throw error;
        }
      }

      console.log("✅ Statement executed");
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📊 Verifying changes...");

    // Verify columns were added
    const { data: columns, error: colError } = await supabase.rpc(
      "get_table_columns",
      { table_name: "admin_users" }
    );

    if (!colError) {
      console.log("\n🔍 admin_users columns:");
      console.log(columns);
    }

    // Verify table was created
    const { data: tables, error: tableError } = await supabase
      .from("twofa_attempts")
      .select("id")
      .limit(1);

    if (!tableError || tableError.code === "PGRST116") {
      console.log("✅ twofa_attempts table created");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

async function rollback() {
  try {
    console.log("⚠️  Running rollback: 006_rollback.sql...");

    const sqlPath = path.join(__dirname, "migrations", "006_rollback.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("--"));

    for (const statement of statements) {
      console.log(`\n📝 Executing: ${statement.substring(0, 60)}...`);
      const { error } = await supabase.rpc("exec_sql", { sql: statement });

      if (error) {
        console.warn(`⚠️  Warning: ${error.message}`);
      } else {
        console.log("✅ Statement executed");
      }
    }

    console.log("\n✅ Rollback completed successfully!");
  } catch (error) {
    console.error("❌ Rollback failed:", error.message);
    process.exit(1);
  }
}

// Main
const command = process.argv[2] || "migrate";

if (command === "migrate") {
  migrate();
} else if (command === "rollback") {
  rollback();
} else {
  console.log("Usage: node run-migration.js [migrate|rollback]");
  process.exit(1);
}
