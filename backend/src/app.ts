import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Request, Response } from "express";
import helmet from "helmet";
import hpp from "hpp";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { errorHandler } from "./middleware/errorHandler";
import { globalRateLimiter } from "./middleware/rateLimiter";
import { sendSuccess } from "./utils/response";

export const app = express();

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Compression
app.use(compression());

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser clients do not send Origin; browser origins must match exactly.
      if (!origin) return callback(null, true);
      return callback(null, env.CORS_ORIGINS.includes(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Body parsers with limits
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// Cookie parser
app.use(cookieParser());

// Request logging (clean pino format)
if (env.NODE_ENV !== "test") {
  app.use(
    pinoHttp({
      autoLogging: {
        ignore: (req) => req.url === "/api/health",
      },
    })
  );
}

// Global Rate Limiting
app.use(globalRateLimiter);

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  return sendSuccess(res, {
    status: "ok",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Readiness check verifies the database before the instance receives traffic.
app.get("/api/ready", async (_req: Request, res: Response): Promise<any> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return sendSuccess(res, {
      status: "ready",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "Unknown error";
    console.error("Readiness check failed: database is unavailable", errorName);
    return res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "The service is not ready",
      },
    });
  }
});

// Authentication Routes
import { authRouter } from "./routes/auth";
app.use("/api/auth", authRouter);

// Public Data Routes
import { categoriesRouter } from "./routes/categories";
import { cultureRouter } from "./routes/culture";
import { heritageRouter } from "./routes/heritage";
import { recommendationsRouter } from "./routes/recommendations";
import { walksRouter } from "./routes/walks";

app.use("/api/heritage", heritageRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/culture", cultureRouter);
app.use("/api/walks", walksRouter);
app.use("/api/recommendations", recommendationsRouter);

// User-Specific Data Routes
import { itineraryRouter, savedRouter, userRouter } from "./routes/user";
app.use("/api/me", userRouter);
app.use("/api/saved", savedRouter);
app.use("/api/itineraries", itineraryRouter);

// Admin-Only Routes
import { adminRouter } from "./routes/admin";
app.use("/api/admin", adminRouter);

// 404 handler for unknown routes
app.use("/api/*", (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "The requested API endpoint does not exist",
    },
  });
});

// Central Error Handler
app.use(errorHandler);
