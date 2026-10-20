import { Request, Response, Router } from "express";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { csrfProtection, requireAuth } from "../middleware/auth";
import { distanceKm } from "../utils/geo";
import { sendError, sendSuccess } from "../utils/response";

export const userRouter = Router();

// Protect all user routes with requireAuth & csrfProtection on state-changing methods
userRouter.use(requireAuth);
userRouter.use(csrfProtection);

/* -------------------------------------------------------------
   1. USER PREFERENCES: GET /api/me/preferences, PUT /api/me/preferences
------------------------------------------------------------- */
userRouter.get("/preferences", async (req: Request, res: Response): Promise<any> => {
  const pref = await prisma.preference.findUnique({
    where: { userId: req.user!.userId },
  });
  return sendSuccess(res, pref || { interests: [] });
});

const preferenceSchema = z.object({
  interests: z.array(z.string()).default([]),
  travelStyle: z.string().optional(),
  timeBudget: z.string().optional(),
  preferredArea: z.string().optional(),
});

userRouter.put("/preferences", async (req: Request, res: Response): Promise<any> => {
  const result = preferenceSchema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, "VALIDATION_ERROR", "Invalid preferences payload", result.error.errors, 422);
  }

  const { interests, travelStyle, timeBudget, preferredArea } = result.data;

  const pref = await prisma.preference.upsert({
    where: { userId: req.user!.userId },
    update: { interests, travelStyle, timeBudget, preferredArea },
    create: {
      userId: req.user!.userId,
      interests,
      travelStyle,
      timeBudget,
      preferredArea,
    },
  });

  return sendSuccess(res, pref);
});

/* -------------------------------------------------------------
   2. SAVED PLACES: /api/saved, /api/saved/:siteId, /api/saved/merge
------------------------------------------------------------- */
export const savedRouter = Router();
savedRouter.use(requireAuth);
savedRouter.use(csrfProtection);

// GET /api/saved
savedRouter.get("/", async (req: Request, res: Response): Promise<any> => {
  const saved = await prisma.savedPlace.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: "desc" },
    include: {
      site: {
        include: {
          category: true,
        },
      },
    },
  });

  return sendSuccess(res, saved.map((s) => s.site));
});

// POST /api/saved/merge (Merges guest localStorage saved sites upon login)
savedRouter.post("/merge", async (req: Request, res: Response): Promise<any> => {
  const result = z.object({
    siteIds: z.array(z.number().int().positive()).max(100),
  }).safeParse(req.body);
  if (!result.success) {
    return sendError(res, "VALIDATION_ERROR", "siteIds must contain at most 100 positive integers", result.error.errors, 422);
  }

  const validIds = [...new Set(result.data.siteIds)];
  const existingSites = await prisma.heritageSite.findMany({
    where: { id: { in: validIds } },
    select: { id: true },
  });

  for (const { id: siteId } of existingSites) {
    await prisma.savedPlace.upsert({
      where: {
        userId_siteId: {
          userId: req.user!.userId,
          siteId,
        },
      },
      update: {},
      create: {
        userId: req.user!.userId,
        siteId,
      },
    });
  }

  const allSaved = await prisma.savedPlace.findMany({
    where: { userId: req.user!.userId },
    include: { site: true },
  });

  return sendSuccess(res, {
    mergedCount: existingSites.length,
    savedSites: allSaved.map((savedPlace) => savedPlace.site),
  });
});

// POST /api/saved/:siteId (idempotent save)
savedRouter.post("/:siteId", async (req: Request, res: Response): Promise<any> => {
  const siteId = parseInt(String(req.params.siteId), 10);
  if (isNaN(siteId)) {
    return sendError(res, "INVALID_SITE_ID", "Site ID must be a valid integer");
  }

  const site = await prisma.heritageSite.findUnique({ where: { id: siteId } });
  if (!site) {
    return sendError(res, "NOT_FOUND", "Site does not exist", undefined, 404);
  }

  await prisma.savedPlace.upsert({
    where: {
      userId_siteId: {
        userId: req.user!.userId,
        siteId,
      },
    },
    update: {},
    create: {
      userId: req.user!.userId,
      siteId,
    },
  });

  return sendSuccess(res, { message: "Site saved successfully", siteId });
});

// DELETE /api/saved/:siteId
savedRouter.delete("/:siteId", async (req: Request, res: Response): Promise<any> => {
  const siteId = parseInt(String(req.params.siteId), 10);
  if (isNaN(siteId)) {
    return sendError(res, "INVALID_SITE_ID", "Site ID must be a valid integer");
  }

  await prisma.savedPlace.deleteMany({
    where: {
      userId: req.user!.userId,
      siteId,
    },
  });

  return sendSuccess(res, { message: "Site removed from saved places", siteId });
});

/* -------------------------------------------------------------
   3. ITINERARIES: /api/itineraries
------------------------------------------------------------- */
export const itineraryRouter = Router();
itineraryRouter.use(requireAuth);
itineraryRouter.use(csrfProtection);

// GET /api/itineraries
itineraryRouter.get("/", async (req: Request, res: Response): Promise<any> => {
  const itineraries = await prisma.itinerary.findMany({
    where: { userId: req.user!.userId },
    orderBy: { updatedAt: "desc" },
    include: {
      stops: {
        orderBy: { position: "asc" },
        include: { site: true },
      },
    },
  });

  return sendSuccess(res, itineraries);
});

// POST /api/itineraries
const createItinerarySchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  notes: z.string().max(2000).optional(),
  stops: z
    .array(
      z.object({
        siteId: z.number().int(),
        visitTime: z.string().max(20).optional(),
      })
    )
    .max(100, "An itinerary cannot contain more than 100 stops")
    .default([]),
});

const mergeItinerarySchema = createItinerarySchema.extend({
  title: z.string().min(1).max(100).default("My Ahmedabad Heritage Day"),
});

itineraryRouter.post("/merge", async (req: Request, res: Response): Promise<any> => {
  const result = mergeItinerarySchema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, "VALIDATION_ERROR", "Invalid itinerary payload", result.error.errors, 422);
  }

  const userId = req.user!.userId;
  const existing = await prisma.itinerary.findFirst({
    where: { userId, title: result.data.title },
    orderBy: { updatedAt: "desc" },
    include: { stops: { orderBy: { position: "asc" } } },
  });
  const bySite = new Map<number, { siteId: number; visitTime?: string }>();
  existing?.stops.forEach((stop) => bySite.set(stop.siteId, {
    siteId: stop.siteId,
    ...(stop.visitTime ? { visitTime: stop.visitTime } : {}),
  }));
  result.data.stops.forEach((stop) => {
    if (!bySite.has(stop.siteId)) bySite.set(stop.siteId, stop);
  });
  const stops = [...bySite.values()];

  const itinerary = existing
    ? await prisma.itinerary.update({
      where: { id: existing.id },
      data: {
        stops: {
          deleteMany: {},
          create: stops.map((stop, position) => ({
            siteId: stop.siteId,
            position,
            ...(stop.visitTime ? { visitTime: stop.visitTime } : {}),
          })),
        },
      },
      include: { stops: { orderBy: { position: "asc" }, include: { site: true } } },
    })
    : await prisma.itinerary.create({
      data: {
        userId,
        title: result.data.title,
        notes: result.data.notes,
        stops: {
          create: stops.map((stop, position) => ({
            siteId: stop.siteId,
            position,
            ...(stop.visitTime ? { visitTime: stop.visitTime } : {}),
          })),
        },
      },
      include: { stops: { orderBy: { position: "asc" }, include: { site: true } } },
    });

  return sendSuccess(res, itinerary);
});

itineraryRouter.post("/", async (req: Request, res: Response): Promise<any> => {
  const result = createItinerarySchema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, "VALIDATION_ERROR", "Invalid itinerary payload", result.error.errors, 422);
  }

  const { title, notes, stops } = result.data;

  const itinerary = await prisma.itinerary.create({
    data: {
      userId: req.user!.userId,
      title,
      notes,
      stops: {
        create: stops.map((s, idx) => ({
          siteId: s.siteId,
          position: idx,
          visitTime: s.visitTime,
        })),
      },
    },
    include: {
      stops: {
        orderBy: { position: "asc" },
        include: { site: true },
      },
    },
  });

  return sendSuccess(res, itinerary, undefined, 201);
});

// GET /api/itineraries/:id
itineraryRouter.get("/:id", async (req: Request, res: Response): Promise<any> => {
  const id = String(req.params.id);
  const itinerary = await prisma.itinerary.findFirst({
    where: { id, userId: req.user!.userId },
    include: {
      stops: {
        orderBy: { position: "asc" },
        include: { site: true },
      },
    },
  });

  if (!itinerary) {
    return sendError(res, "NOT_FOUND", "Itinerary not found", undefined, 404);
  }

  return sendSuccess(res, itinerary);
});

// PUT /api/itineraries/:id
itineraryRouter.put("/:id", async (req: Request, res: Response): Promise<any> => {
  const id = String(req.params.id);
  const existing = await prisma.itinerary.findFirst({
    where: { id, userId: req.user!.userId },
  });

  if (!existing) {
    return sendError(res, "NOT_FOUND", "Itinerary not found or access denied", undefined, 404);
  }

  const result = createItinerarySchema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, "VALIDATION_ERROR", "Invalid itinerary payload", result.error.errors, 422);
  }

  const { title, notes, stops } = result.data;

  // Replace stops in a transaction
  await prisma.$transaction([
    prisma.itineraryStop.deleteMany({ where: { itineraryId: id } }),
    prisma.itinerary.update({
      where: { id },
      data: {
        title,
        notes,
        stops: {
          create: stops.map((s, idx) => ({
            siteId: s.siteId,
            position: idx,
            visitTime: s.visitTime,
          })),
        },
      },
    }),
  ]);

  const updated = await prisma.itinerary.findUnique({
    where: { id },
    include: {
      stops: {
        orderBy: { position: "asc" },
        include: { site: true },
      },
    },
  });

  return sendSuccess(res, updated);
});

// DELETE /api/itineraries/:id
itineraryRouter.delete("/:id", async (req: Request, res: Response): Promise<any> => {
  const id = String(req.params.id);
  const existing = await prisma.itinerary.findFirst({
    where: { id, userId: req.user!.userId },
  });

  if (!existing) {
    return sendError(res, "NOT_FOUND", "Itinerary not found or access denied", undefined, 404);
  }

  await prisma.itinerary.delete({ where: { id } });
  return sendSuccess(res, { message: "Itinerary deleted successfully" });
});

// POST /api/itineraries/:id/optimize (Nearest-neighbor route sorting)
itineraryRouter.post("/:id/optimize", async (req: Request, res: Response): Promise<any> => {
  const id = String(req.params.id);
  const itinerary = await prisma.itinerary.findFirst({
    where: { id, userId: req.user!.userId },
    include: {
      stops: {
        include: { site: true },
      },
    },
  });

  if (!itinerary || !itinerary.stops.length) {
    return sendError(res, "NOT_FOUND", "Itinerary has no stops to optimize", undefined, 400);
  }

  // Nearest-Neighbor TSP heuristic
  const unvisited = [...itinerary.stops];
  const ordered = [unvisited.shift()!]; // start with first stop as anchor

  while (unvisited.length > 0) {
    const current = ordered[ordered.length - 1].site;
    let nearestIdx = 0;
    let shortestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const d = distanceKm(
        current.latitude,
        current.longitude,
        unvisited[i].site.latitude,
        unvisited[i].site.longitude
      );
      if (d < shortestDist) {
        shortestDist = d;
        nearestIdx = i;
      }
    }

    ordered.push(unvisited.splice(nearestIdx, 1)[0]);
  }

  // Update positions in DB
  await prisma.$transaction([
    prisma.itineraryStop.deleteMany({ where: { itineraryId: id } }),
    prisma.itineraryStop.createMany({
      data: ordered.map((s, idx) => ({
        itineraryId: id,
        siteId: s.siteId,
        position: idx,
        visitTime: s.visitTime,
      })),
    }),
  ]);

  const optimized = await prisma.itinerary.findUnique({
    where: { id },
    include: {
      stops: {
        orderBy: { position: "asc" },
        include: { site: true },
      },
    },
  });

  return sendSuccess(res, optimized);
});

/* -------------------------------------------------------------
   4. USER REVIEWS: POST /api/heritage/:id/reviews, GET /api/me/reviews
------------------------------------------------------------- */
export const reviewRouter = Router();
reviewRouter.use(requireAuth);
reviewRouter.use(csrfProtection);

const reviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000, "Review cannot exceed 1000 characters").optional(),
    text: z.string().max(1000, "Review cannot exceed 1000 characters").optional(),
  })
  .refine((data) => Boolean((data.comment && data.comment.trim().length >= 3) || (data.text && data.text.trim().length >= 3)), {
    message: "Review must be at least 3 characters",
    path: ["comment"],
  });

// POST /api/heritage/:id/reviews
export async function submitReviewHandler(req: Request, res: Response): Promise<any> {
  const siteId = parseInt(String(req.params.id), 10);
  if (isNaN(siteId)) {
    return sendError(res, "INVALID_SITE_ID", "Site ID must be a valid integer");
  }

  const site = await prisma.heritageSite.findUnique({ where: { id: siteId } });
  if (!site) {
    return sendError(res, "NOT_FOUND", "Site does not exist", undefined, 404);
  }

  const result = reviewSchema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, "VALIDATION_ERROR", "Validation failed", result.error.errors, 422);
  }

  const { rating } = result.data;
  const rawComment = result.data.comment || result.data.text || "";

  // Sanitize comment to strip malicious script / HTML tags
  const cleanComment = sanitizeHtml(rawComment, {
    allowedTags: [],
    allowedAttributes: {},
  });

  const review = await prisma.review.upsert({
    where: {
      siteId_userId: {
        siteId,
        userId: req.user!.userId,
      },
    },
    update: {
      rating,
      comment: cleanComment,
      status: "PENDING",
      author: req.user!.name || "Visitor",
    },
    create: {
      siteId,
      userId: req.user!.userId,
      author: req.user!.name || "Visitor",
      rating,
      comment: cleanComment,
      status: "PENDING",
    },
  });

  return sendSuccess(
    res,
    {
      ...review,
      message: "Review submitted and held for moderation",
    },
    undefined,
    201
  );
}

// GET /api/me/reviews
userRouter.get("/reviews", async (req: Request, res: Response): Promise<any> => {
  const reviews = await prisma.review.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: "desc" },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
        },
      },
    },
  });

  return sendSuccess(res, reviews);
});
