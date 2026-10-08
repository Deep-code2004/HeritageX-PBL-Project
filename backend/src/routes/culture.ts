import { Request, Response, Router } from "express";
import { prisma } from "../config/prisma";
import { sendError, sendSuccess } from "../utils/response";

export const cultureRouter = Router();

// GET /api/culture
cultureRouter.get("/", async (_req: Request, res: Response): Promise<any> => {
  const sections = await prisma.culture.findMany({
    orderBy: { createdAt: "asc" },
  });
  return sendSuccess(res, sections);
});

// GET /api/culture/:id
cultureRouter.get("/:id", async (req: Request, res: Response): Promise<any> => {
  const id = String(req.params.id);
  const section = await prisma.culture.findUnique({
    where: { id },
  });

  if (!section) {
    return sendError(res, "NOT_FOUND", "Culture section not found", undefined, 404);
  }

  return sendSuccess(res, section);
});
