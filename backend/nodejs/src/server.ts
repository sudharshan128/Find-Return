import "dotenv/config";
import { createApp } from "./app";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";

/**
 * SERVER ENTRY POINT
 * Handles startup and graceful shutdown
 */

// Validate required environment variables
const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingEnvVars.length > 0) {
  console.error(
    `[ERROR] Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
  process.exit(1);
}

// Create Express app
const app = createApp();

// Render injects PORT automatically; fallback to 3000 for local dev
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(
    `[SERVER] Running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`
  );
  console.log(`[SERVER] Frontend origin: ${process.env.FRONTEND_URL}`);
  
  // Setup daily trust score maintenance (runs at midnight)
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running daily trust score maintenance...');
    try {
      const { error } = await supabaseAdmin.rpc('daily_trust_maintenance');
      if (error) {
        console.error('[CRON] Daily maintenance error:', error);
      } else {
        console.log('[CRON] Daily trust maintenance completed successfully');
      }
    } catch (err: any) {
      console.error('[CRON] Daily maintenance exception:', err.message);
    }
  });
  console.log('[CRON] Trust score maintenance scheduled (midnight daily)');
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const gracefulShutdown = (signal: string) => {
  console.log(`[SERVER] Received ${signal}, shutting down gracefully...`);

  server.close(() => {
    console.log("[SERVER] HTTP server closed");
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("[ERROR] Force shutdown - requests took too long to complete");
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("[ERROR] Uncaught exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("[ERROR] Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});
