import { VerificationStatus } from "@prisma/client";
import { Request, Response, Router } from "express";
import { prisma } from "../config/prisma";
import { sendError, sendSuccess } from "../utils/response";

export const walksRouter = Router();

// GET /api/walks
walksRouter.get("/", async (_req: Request, res: Response): Promise<any> => {
  const walks = await prisma.heritageWalk.findMany({
    orderBy: { createdAt: "asc" },
  });

  // Hydrate stops with full site objects
  const allSiteIds = Array.from(new Set(walks.flatMap((w) => w.route)));
  const sites = await prisma.heritageSite.findMany({
    where: {
      id: { in: allSiteIds },
      verification: VerificationStatus.VERIFIED,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      categoryName: true,
      image: true,
      duration: true,
      latitude: true,
      longitude: true,
      rating: true,
    },
  });

  const siteMap = new Map(sites.map((s) => [s.id, s]));

  const enrichedWalks = walks.map((walk) => ({
    ...walk,
    stopSites: walk.route.map((id) => siteMap.get(id)).filter(Boolean),
  }));

  return sendSuccess(res, enrichedWalks);
});

// GET /api/walks/:id
walksRouter.get("/:id", async (req: Request, res: Response): Promise<any> => {
  const id = String(req.params.id);
  const walk = await prisma.heritageWalk.findUnique({
    where: { id },
  });

  if (!walk) {
    return sendError(res, "NOT_FOUND", "Heritage walk not found", undefined, 404);
  }

  const stopSites = await prisma.heritageSite.findMany({
    where: {
      id: { in: walk.route },
      verification: VerificationStatus.VERIFIED,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      categoryName: true,
      image: true,
      duration: true,
      latitude: true,
      longitude: true,
      rating: true,
    },
  });

  return sendSuccess(res, {
    ...walk,
    stopSites,
  });
});
