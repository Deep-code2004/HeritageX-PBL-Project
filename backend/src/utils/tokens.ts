import crypto from "crypto";
import { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: "15m",
  });
}

export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(40).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function getCookieOptions(
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days
): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken?: string
): void {
  // Access token cookie (15 min)
  res.cookie("hx_access_token", accessToken, getCookieOptions(15 * 60 * 1000));

  // Refresh token cookie (7 days)
  if (refreshToken) {
    res.cookie(
      "hx_refresh_token",
      refreshToken,
      getCookieOptions(7 * 24 * 60 * 60 * 1000)
    );
  }
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie("hx_access_token", { path: "/" });
  res.clearCookie("hx_refresh_token", { path: "/" });
}
