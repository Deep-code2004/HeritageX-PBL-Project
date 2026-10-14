import * as argon2 from "argon2";
import { Request, Response, Router } from "express";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { csrfProtection, requireAuth } from "../middleware/auth";
import { authRateLimiter } from "../middleware/rateLimiter";
import { sendError, sendSuccess } from "../utils/response";
import {
  clearAuthCookies,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  setAuthCookies,
} from "../utils/tokens";
import { loginSchema, registerSchema } from "../validators/auth";

export const authRouter = Router();

// Apply auth rate limiter and CSRF defense to auth mutations
authRouter.use(authRateLimiter);
authRouter.use(csrfProtection);

// POST /api/auth/register
authRouter.post("/register", async (req: Request, res: Response): Promise<any> => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return sendError(
      res,
      "VALIDATION_ERROR",
      "Registration validation failed",
      result.error.errors,
      422
    );
  }

  const { name, email, password } = result.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    return sendError(res, "EMAIL_EXISTS", "A user with this email already exists", undefined, 409);
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "USER",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  // Issue session tokens
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const { token: refreshToken, tokenHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  setAuthCookies(res, accessToken, refreshToken);

  return sendSuccess(
    res,
    {
      user,
      accessToken,
    },
    undefined,
    201
  );
});

// POST /api/auth/login
authRouter.post("/login", async (req: Request, res: Response): Promise<any> => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, "VALIDATION_ERROR", "Login validation failed", result.error.errors, 422);
  }

  let { emailOrUsername, password } = result.data;
  emailOrUsername = emailOrUsername.trim().toLowerCase();

  // If user enters admin username, map to ADMIN_EMAIL
  const searchEmail =
    emailOrUsername === "heritagex_admin" ? env.ADMIN_EMAIL.toLowerCase() : emailOrUsername;

  const user = await prisma.user.findUnique({
    where: { email: searchEmail },
  });

  if (!user) {
    return sendError(res, "INVALID_CREDENTIALS", "Invalid email or password", undefined, 401);
  }

  // Account lockout check
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / (60 * 1000)
    );
    return sendError(
      res,
      "ACCOUNT_LOCKED",
      `Account is temporarily locked. Try again in ${minutesLeft} minute(s).`,
      undefined,
      403
    );
  }

  const validPassword = await argon2.verify(user.passwordHash, password);
  if (!validPassword) {
    const failedLogins = user.failedLogins + 1;
    let lockedUntil: Date | null = null;

    if (failedLogins >= 5) {
      lockedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 min lock
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins,
        lockedUntil,
      },
    });

    return sendError(res, "INVALID_CREDENTIALS", "Invalid email or password", undefined, 401);
  }

  // Reset login failures on success
  if (user.failedLogins > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const { token: refreshToken, tokenHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  setAuthCookies(res, accessToken, refreshToken);

  return sendSuccess(res, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
  });
});

// POST /api/auth/admin/login
authRouter.post("/admin/login", async (req: Request, res: Response): Promise<any> => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, "VALIDATION_ERROR", "Login validation failed", result.error.errors, 422);
  }

  let { emailOrUsername, password } = result.data;
  emailOrUsername = emailOrUsername.trim().toLowerCase();

  const searchEmail =
    emailOrUsername === "heritagex_admin" ? env.ADMIN_EMAIL.toLowerCase() : emailOrUsername;

  const user = await prisma.user.findUnique({
    where: { email: searchEmail },
  });

  if (!user || user.role !== "ADMIN") {
    return sendError(res, "INVALID_CREDENTIALS", "Invalid admin credentials", undefined, 401);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / (60 * 1000)
    );
    return sendError(
      res,
      "ACCOUNT_LOCKED",
      `Admin account is temporarily locked. Try again in ${minutesLeft} minute(s).`,
      undefined,
      403
    );
  }

  const validPassword = await argon2.verify(user.passwordHash, password);
  if (!validPassword) {
    const failedLogins = user.failedLogins + 1;
    let lockedUntil: Date | null = null;
    if (failedLogins >= 5) {
      lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins, lockedUntil },
    });
    return sendError(res, "INVALID_CREDENTIALS", "Invalid admin credentials", undefined, 401);
  }

  if (user.failedLogins > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const { token: refreshToken, tokenHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  setAuthCookies(res, accessToken, refreshToken);

  return sendSuccess(res, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
  });
});

// POST /api/auth/refresh
authRouter.post("/refresh", async (req: Request, res: Response): Promise<any> => {
  const token = req.cookies?.hx_refresh_token || req.body?.refreshToken;

  if (!token) {
    return sendError(res, "MISSING_REFRESH_TOKEN", "Refresh token is required", undefined, 401);
  }

  const tokenHash = hashToken(token);
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    !storedToken ||
    storedToken.revokedAt ||
    storedToken.expiresAt < new Date() ||
    !storedToken.user.isActive
  ) {
    clearAuthCookies(res);
    return sendError(res, "INVALID_REFRESH_TOKEN", "Invalid or revoked refresh token", undefined, 401);
  }

  // Token rotation: Revoke existing token
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });

  // Issue new access and refresh token
  const newAccessToken = generateAccessToken({
    userId: storedToken.user.id,
    email: storedToken.user.email,
    name: storedToken.user.name,
    role: storedToken.user.role,
  });

  const { token: newRefreshToken, tokenHash: newHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: storedToken.user.id,
      tokenHash: newHash,
      expiresAt,
    },
  });

  setAuthCookies(res, newAccessToken, newRefreshToken);

  return sendSuccess(res, {
    accessToken: newAccessToken,
  });
});

// POST /api/auth/logout
authRouter.post("/logout", async (req: Request, res: Response): Promise<any> => {
  const token = req.cookies?.hx_refresh_token || req.body?.refreshToken;
  if (token) {
    const tokenHash = hashToken(token);
    await prisma.refreshToken
      .updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => {});
  }

  clearAuthCookies(res);
  return sendSuccess(res, { message: "Successfully logged out" });
});

// GET /api/auth/me
authRouter.get("/me", requireAuth, async (req: Request, res: Response): Promise<any> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      preference: true,
      _count: {
        select: {
          saved: true,
          itineraries: true,
          reviews: true,
        },
      },
    },
  });

  if (!user) {
    clearAuthCookies(res);
    return sendError(res, "USER_NOT_FOUND", "User session expired or not found", undefined, 401);
  }

  return sendSuccess(res, { user });
});
