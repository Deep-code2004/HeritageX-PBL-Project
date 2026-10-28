import { Prisma, VerificationStatus } from "@prisma/client";
import { Request, Response, Router } from "express";
import { prisma } from "../config/prisma";
import { distanceKm } from "../utils/geo";
import { sendError, sendSuccess } from "../utils/response";
import { requireAuth, csrfProtection } from "../middleware/auth";
import { submitReviewHandler } from "./user";

export const heritageRouter = Router();

// POST /api/heritage/:id/reviews (Authenticated review submission)
heritageRouter.post("/:id/reviews", requireAuth, csrfProtection, submitReviewHandler);

// GET /api/heritage/nearby (Must precede /:idOrSlug to avoid route conflict)
heritageRouter.get("/nearby", async (req: Request, res: Response): Promise<any> => {
  const lat = req.query.lat ? Number(req.query.lat) : 23.0235; // Default Ahmedabad center
  const lng = req.query.lng ? Number(req.query.lng) : 72.586;
  const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : 10;
  const category = req.query.category ? String(req.query.category) : undefined;

  if (isNaN(lat) || isNaN(lng)) {
    return sendError(res, "INVALID_COORDINATES", "Latitude and longitude must be valid numbers");
  }

  const whereClause: Prisma.HeritageSiteWhereInput = {
    verification: VerificationStatus.VERIFIED,
  };

  if (category) {
    whereClause.categoryName = { equals: category, mode: "insensitive" };
  }

  const allSites = await prisma.heritageSite.findMany({
    where: whereClause,
  });

  const sitesWithDistance = allSites
    .map((site) => {
      const dist = distanceKm(lat, lng, site.latitude, site.longitude);
      return {
        ...site,
        distanceKm: Number(dist.toFixed(2)),
      };
    })
    .filter((site) => site.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return sendSuccess(res, sitesWithDistance);
});

// GET /api/heritage
heritageRouter.get("/", async (req: Request, res: Response): Promise<any> => {
  const q = req.query.q ? String(req.query.q).trim() : undefined;
  const category = req.query.category ? String(req.query.category).trim() : undefined;
  const interest = req.query.interest ? String(req.query.interest).trim().toLowerCase() : undefined;
  const minRating = req.query.minRating ? Number(req.query.minRating) : undefined;
  const sort = req.query.sort ? String(req.query.sort).toLowerCase() : "rating";
  const page = Math.max(1, req.query.page ? parseInt(String(req.query.page), 10) : 1);
  const limit = Math.min(50, Math.max(1, req.query.limit ? parseInt(String(req.query.limit), 10) : 20));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.HeritageSiteWhereInput = {
    verification: VerificationStatus.VERIFIED,
  };

  if (category) {
    whereClause.categoryName = { equals: category, mode: "insensitive" };
  }

  if (interest) {
    whereClause.interests = { has: interest };
  }

  if (minRating && !isNaN(minRating)) {
    whereClause.rating = { gte: minRating };
  }

  if (q) {
    whereClause.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { shortDescription: { contains: q, mode: "insensitive" } },
      { history: { contains: q, mode: "insensitive" } },
      { culturalSignificance: { contains: q, mode: "insensitive" } },
      { categoryName: { contains: q, mode: "insensitive" } },
      { tags: { has: q } },
    ];
  }

  // Ordering
  let orderBy: Prisma.HeritageSiteOrderByWithRelationInput = { rating: "desc" };
  if (sort === "name") {
    orderBy = { name: "asc" };
  } else if (sort === "duration") {
    orderBy = { durationMinutes: "asc" };
  } else if (sort === "new") {
    orderBy = { createdAt: "desc" };
  } else if (sort === "reviews") {
    orderBy = { reviewCount: "desc" };
  }

  const [total, sites] = await Promise.all([
    prisma.heritageSite.count({ where: whereClause }),
    prisma.heritageSite.findMany({
      where: whereClause,
      orderBy,
      skip,
      take: limit,
      include: {
        category: {
          select: { id: true, name: true, slug: true, color: true },
        },
      },
    }),
  ]);

  return sendSuccess(res, sites, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/heritage/:idOrSlug
heritageRouter.get("/:idOrSlug", async (req: Request, res: Response): Promise<any> => {
  const idOrSlug = String(req.params.idOrSlug);
  const isNumeric = /^\d+$/.test(idOrSlug);

  const site = await prisma.heritageSite.findFirst({
    where: isNumeric
      ? { id: parseInt(idOrSlug, 10), verification: VerificationStatus.VERIFIED }
      : { slug: idOrSlug.toLowerCase(), verification: VerificationStatus.VERIFIED },
    include: {
      category: true,
      reviews: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          author: true,
          rating: true,
          comment: true,
          helpful: true,
          createdAt: true,
        },
      },
    },
  });

  if (!site) {
    return sendError(res, "NOT_FOUND", "Heritage site not found", undefined, 404);
  }

  const nearbySelect = {
    id: true,
    name: true,
    slug: true,
    categoryName: true,
    image: true,
    latitude: true,
    longitude: true,
    rating: true,
    duration: true,
  } as const;
  let nearbySites = await prisma.heritageSite.findMany({
    where: {
      id: { in: site.nearbyPlaces ?? [] },
      verification: VerificationStatus.VERIFIED,
    },
    select: nearbySelect,
  });

  if (nearbySites.length === 0) {
    const nearbyCandidates = await prisma.heritageSite.findMany({
      where: {
        id: { not: site.id },
        verification: VerificationStatus.VERIFIED,
      },
      select: nearbySelect,
    });

    nearbySites = nearbyCandidates
      .map((nearbySite) => ({
        ...nearbySite,
        distanceKm: distanceKm(
          site.latitude,
          site.longitude,
          nearbySite.latitude,
          nearbySite.longitude
        ),
      }))
      .filter((nearbySite) => nearbySite.distanceKm <= 5)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5);
  }

  return sendSuccess(res, {
    ...site,
    nearby: nearbySites,
  });
});
