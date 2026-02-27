import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { generalLimiter } from "./middleware/rateLimit";
import { checkMaintenanceMode } from "./middleware/settings.middleware";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import twoFARoutes from "./routes/twofa.routes";
import chatRoutes from "./routes/chatRoutes";
import notificationsRoutes from "./routes/notifications.routes";
import trustScoreRoutes from "./routes/trustScore.routes";
import userRoutes from "./routes/user.routes";

/**
 * EXPRESS APPLICATION SETUP
 * SECURITY-FIRST ARCHITECTURE
 */

export function createApp(): Express {
  const app = express();

  // ============================================
  // SECURITY MIDDLEWARE
  // ============================================

  // Helmet - Set security HTTP headers
  app.use(helmet());

  // CORS - Lock to frontend origin
  const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:5173",
    process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    "http://localhost:5174", // Support both ports during development
    "http://localhost:5175", // Support port 5175 during development
    "http://localhost:5176", // Support port 5176 during development
  ];

  app.use(
    cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (same-site requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 3600,
    })
  );

  // Body parsing — images never pass through this API (Supabase Storage direct upload),
  // so 512 KB is ample for any JSON payload and limits memory-exhaustion attacks.
  app.use(express.json({ limit: "512kb" }));
  app.use(express.urlencoded({ limit: "512kb", extended: true }));

  // General rate limiting
  app.use(generalLimiter);

  // ============================================
  // LOGGING MIDDLEWARE
  // ============================================
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Log response when sent
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 400 ? "[ERROR]" : "[INFO]";
      console.log(
        `${logLevel} ${req.method} ${req.path} - Status: ${res.statusCode} - ${duration}ms`
      );
    });

    next();
  });

  // ============================================
  // HEALTH CHECK (before maintenance middleware - always available)
  // ============================================
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================
  // SETTINGS ENFORCEMENT MIDDLEWARE
  // ============================================
  
  // Check maintenance mode (applies to all routes except admin and health)
  app.use(checkMaintenanceMode);

  // ============================================
  // API HEALTH CHECK (after maintenance middleware - respects maintenance mode)
  // ============================================
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================
  // TEST ENDPOINT (after maintenance middleware)
  // ============================================
  
  // Test endpoint (will be blocked by maintenance mode)
  app.get("/api/test", (_req: Request, res: Response) => {
    res.json({
      message: "Test endpoint working - maintenance mode is OFF",
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================
  // API ROUTES
  // ============================================

  // Authentication routes
  app.use("/api/admin/auth", authRoutes);

  // Admin routes
  app.use("/api/admin", adminRoutes);

  // 2FA routes
  app.use("/api/admin/2fa", twoFARoutes);

  // Notifications routes
  app.use("/api/admin/notifications", notificationsRoutes);

  // Chat routes
  app.use("/api/chats", chatRoutes);

  // Trust Score routes
  app.use("/api/trust-score", trustScoreRoutes);
  app.use("/api/user", userRoutes);

  // ============================================
  // 404 HANDLER
  // ============================================
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: "Not found",
      code: "NOT_FOUND",
      path: req.path,
    });
  });

  // ============================================
  // ERROR HANDLER
  // ============================================
  app.use((_err: any, _req: Request, _res: Response, _next: NextFunction) => {
    console.error("[ERROR]", _err);

    const statusCode = _err.statusCode || 500;
    // Never expose internal error details or stack traces to clients in production
    const message =
      process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal server error'
        : _err.message || 'Internal server error';

    _res.status(statusCode).json({
      error: message,
      code: _err.code || "SERVER_ERROR",
    });
  });

  return app;
}
