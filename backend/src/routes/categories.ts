import { VerificationStatus } from "@prisma/client";
import { Request, Response, Router } from "express";
import { prisma } from "../config/prisma";
import { sendSuccess } from "../utils/response";

export const categoriesRouter = Router();

// GET /api/categories
categoriesRouter.get("/", async (_req: Request, res: Response): Promise<any> => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          sites: {
            where: { verification: VerificationStatus.VERIFIED },
          },
        },
      },
    },
  });

  const formatted = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    color: c.color,
    siteCount: c._count.sites,
  }));

  return sendSuccess(res, formatted);
});
