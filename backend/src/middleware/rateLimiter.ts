import rateLimit from "express-rate-limit";
import { sendError } from "../utils/response";

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(
      res,
      "RATE_LIMIT_EXCEEDED",
      "Too many requests from this IP, please try again after 15 minutes",
      undefined,
      429
    );
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 login/register attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(
      res,
      "AUTH_RATE_LIMIT_EXCEEDED",
      "Too many authentication attempts, please try again in 15 minutes",
      undefined,
      429
    );
  },
});
