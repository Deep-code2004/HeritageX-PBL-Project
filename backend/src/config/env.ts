import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const localCorsOrigins = [
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

const postgresUrlSchema = z
  .string()
  .url("Must be a valid PostgreSQL connection URL")
  .refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol), {
    message: "Must use the postgres or postgresql protocol",
  });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: postgresUrlSchema,
  DIRECT_URL: postgresUrlSchema.optional(),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  CORS_ORIGINS: z.string().optional(),
  ADMIN_EMAIL: z.string().min(3, "ADMIN_EMAIL is required"),
  ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD must be at least 8 characters"),
});

export function parseEnvironment(source: NodeJS.ProcessEnv) {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(JSON.stringify(parsed.error.format(), null, 2));
  }

  const configuredCorsOrigins = parsed.data.CORS_ORIGINS?.trim();
  const corsOrigins = (configuredCorsOrigins ||
    (parsed.data.NODE_ENV === "production" ? "" : localCorsOrigins.join(",")))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const invalidOrigins = corsOrigins.filter((origin) => {
    try {
      const parsedOrigin = new URL(origin);
      return (
        !["http:", "https:"].includes(parsedOrigin.protocol) ||
        parsedOrigin.origin !== origin ||
        (parsed.data.NODE_ENV === "production" &&
          (parsedOrigin.protocol !== "https:" ||
            ["localhost", "127.0.0.1", "[::1]"].includes(parsedOrigin.hostname)))
      );
    } catch {
      return true;
    }
  });

  if (
    (parsed.data.NODE_ENV === "production" && corsOrigins.length === 0) ||
    invalidOrigins.length > 0
  ) {
    throw new Error(
      "CORS_ORIGINS must contain exact HTTP(S) origins without paths or wildcards; HTTPS non-local origins are required in production."
    );
  }

  if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.");
  }

  return {
    ...parsed.data,
    CORS_ORIGINS: corsOrigins,
  };
}

export const env = (() => {
  try {
    return parseEnvironment(process.env);
  } catch (error) {
    console.error(
      "❌ Environment configuration validation failed:",
      error instanceof Error ? error.message : "Unknown configuration error"
    );
    process.exit(1);
  }
})();
