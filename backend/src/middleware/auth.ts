import { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/response";
import { TokenPayload, verifyAccessToken } from "../utils/tokens";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): Response | void {
  // Allow safe read methods without header
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const customHeader = req.headers["x-requested-with"];
  if (!customHeader || customHeader !== "HeritageX") {
    return sendError(
      res,
      "CSRF_VALIDATION_FAILED",
      "Missing or invalid X-Requested-With anti-CSRF header",
      undefined,
      403
    );
  }

  return next();
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Response | void {
  const token =
    req.cookies?.hx_access_token ||
    req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return sendError(
      res,
      "UNAUTHORIZED",
      "Authentication required to access this resource",
      undefined,
      401
    );
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return sendError(
      res,
      "INVALID_OR_EXPIRED_TOKEN",
      "Access token is invalid or expired. Please refresh your session.",
      undefined,
      401
    );
  }

  req.user = payload;
  return next();
}

export function requireRole(requiredRole: "USER" | "ADMIN") {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", undefined, 401);
    }

    if (req.user.role !== requiredRole && req.user.role !== "ADMIN") {
      return sendError(
        res,
        "FORBIDDEN",
        `Access restricted to ${requiredRole} users only`,
        undefined,
        403
      );
    }

    return next();
  };
}
