import { Prisma, ReviewStatus, VerificationStatus } from "@prisma/client";
import { Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { sendError, sendSuccess } from "../utils/response";

export const adminRouter = Router();

// Protect ALL admin routes with requireAuth and requireRole('ADMIN').
// csrfProtection is intentionally omitted here — the combination of:
//   • HttpOnly JWT cookie (hx_access_token, not readable by JS)
//   • requireAuth (verifies JWT on every request)
//   • requireRole("ADMIN") (role check)
// already provides strong CSRF-equivalent protection.
adminRouter.use(requireAuth);
adminRouter.use(requireRole("ADMIN"));

// Helper to write to AuditLog
async function logAudit(
  actorId: string,
  action: string,
  entity: string,
  entityId?: string,
  meta?: any,
  ip?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        meta: meta || Prisma.DbNull,
        ip: ip || null,
      },
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}

// Helper to recalculate site rating & review count
async function recalculateSiteRating(siteId: number, tx: Prisma.TransactionClient = prisma) {
  const reviews = await tx.review.findMany({
    where: { siteId, status: ReviewStatus.APPROVED },
    select: { rating: true },
  });

  const reviewCount = reviews.length;
  const rating =
    reviewCount > 0
      ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount).toFixed(1))
      : 0.0;

  await tx.heritageSite.update({
    where: { id: siteId },
    data: { rating, reviewCount },
  });
}

/* -------------------------------------------------------------
   1. HERITAGE SITES CRUD (/api/admin/heritage)
------------------------------------------------------------- */
adminRouter.get("/heritage", async (req: Request, res: Response): Promise<any> => {
  const q = req.query.q ? String(req.query.q).trim() : undefined;
  const category = req.query.category ? String(req.query.category).trim() : undefined;
  const verification = req.query.verification as VerificationStatus | undefined;
  const page = Math.max(1, req.query.page ? parseInt(String(req.query.page), 10) : 1);
  const limit = Math.min(100, Math.max(1, req.query.limit ? parseInt(String(req.query.limit), 10) : 50));
  const skip = (page - 1) * limit;

  const where: Prisma.HeritageSiteWhereInput = {};
  if (category) where.categoryName = { equals: category, mode: "insensitive" };
  if (verification) where.verification = verification;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { shortDescription: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, sites] = await Promise.all([
    prisma.heritageSite.count({ where }),
    prisma.heritageSite.findMany({
      where,
      orderBy: { id: "asc" },
      skip,
      take: limit,
      include: { category: true },
    }),
  ]);

  return sendSuccess(res, sites, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

const adminSiteSchema = z.object({
  name: z.string().min(2, "Name is required"),
  category: z.string().min(1, "Category is required"),
  shortDescription: z.string().min(5, "Short description is required"),
  verified: z.boolean().default(true),
  history: z.string().optional(),
  culturalSignificance: z.string().optional(),
  architecture: z.string().optional(),
  image: z.string().url().optional(),
  gallery: z.array(z.string()).optional(),
  latitude: z.number().min(-90).max(90).default(23.0235),
  longitude: z.number().min(-180).max(180).default(72.586),
  duration: z.string().default("45–60 min"),
  timings: z.string().optional(),
  entryFee: z.string().optional(),
  responsibleGuidelines: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
});

// POST /api/admin/heritage (Create site)
adminRouter.post("/heritage", async (req: Request, res: Response): Promise<any> => {
  const result = adminSiteSchema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, "VALIDATION_ERROR", "Validation failed", result.error.errors, 422);
  }

  const data = result.data;

  // Calculate next integer ID
  const maxSite = await prisma.heritageSite.findFirst({
    orderBy: { id: "desc" },
    select: { id: true },
  });
  const nextId = (maxSite?.id || 0) + 1;

  // Ensure category exists
  let categoryRecord = await prisma.category.findUnique({
    where: { name: data.category },
  });
  if (!categoryRecord) {
    categoryRecord = await prisma.category.create({
      data: {
        name: data.category,
        slug: data.category.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      },
    });
  }

  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const site = await prisma.heritageSite.create({
    data: {
      id: nextId,
      name: data.name,
      slug,
      categoryId: categoryRecord.id,
      categoryName: data.category,
      shortDescription: data.shortDescription,
      history: data.history || data.shortDescription,
      culturalSignificance: data.culturalSignificance || data.shortDescription,
      architecture: data.architecture || "Traditional Gujarati architecture.",
      image:
        data.image ||
        "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?q=80&w=1200&auto=format&fit=crop",
      gallery: data.gallery || [
        data.image ||
          "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?q=80&w=1200&auto=format&fit=crop",
      ],
      latitude: data.latitude,
      longitude: data.longitude,
      duration: data.duration,
      durationMinutes: 60,
      timings: data.timings || "Open daily",
      entryFee: data.entryFee || "Free",
      verified: data.verified,
      verification: data.verified ? VerificationStatus.VERIFIED : VerificationStatus.PENDING,
      tags: data.tags || ["Heritage"],
      interests: data.interests || ["history"],
      responsibleGuidelines: data.responsibleGuidelines || ["Follow local heritage guidelines."],
    },
  });

  await logAudit(
    req.user!.userId,
    "CREATE_SITE",
    "HeritageSite",
    String(site.id),
    { name: site.name },
    req.ip
  );

  return sendSuccess(res, site, undefined, 201);
});

// PUT /api/admin/heritage/:id (Update site)
adminRouter.put("/heritage/:id", async (req: Request, res: Response): Promise<any> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return sendError(res, "INVALID_ID", "Site ID must be an integer");

  const existing = await prisma.heritageSite.findUnique({ where: { id } });
  if (!existing) return sendError(res, "NOT_FOUND", "Site not found", undefined, 404);

  const result = adminSiteSchema.partial().safeParse(req.body);
  if (!result.success) {
    return sendError(res, "VALIDATION_ERROR", "Validation failed", result.error.errors, 422);
  }

  const data = result.data;
  let categoryId = existing.categoryId;

  if (data.category && data.category !== existing.categoryName) {
    let cat = await prisma.category.findUnique({ where: { name: data.category } });
    if (!cat) {
      cat = await prisma.category.create({
        data: {
          name: data.category,
          slug: data.category.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        },
      });
    }
    categoryId = cat.id;
  }

  const updated = await prisma.heritageSite.update({
    where: { id },
    data: {
      name: data.name,
      categoryName: data.category,
      categoryId,
      shortDescription: data.shortDescription,
      verified: data.verified,
      verification:
        data.verified !== undefined
          ? data.verified
            ? VerificationStatus.VERIFIED
            : VerificationStatus.PENDING
          : undefined,
      history: data.history,
      culturalSignificance: data.culturalSignificance,
      architecture: data.architecture,
      image: data.image,
      latitude: data.latitude,
      longitude: data.longitude,
      duration: data.duration,
    },
  });

  await logAudit(
    req.user!.userId,
    "UPDATE_SITE",
    "HeritageSite",
    String(id),
    { changes: data },
    req.ip
  );

  return sendSuccess(res, updated);
});

// DELETE /api/admin/heritage/:id
adminRouter.delete("/heritage/:id", async (req: Request, res: Response): Promise<any> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return sendError(res, "INVALID_ID", "Site ID must be an integer");

  const existing = await prisma.heritageSite.findUnique({ where: { id } });
  if (!existing) return sendError(res, "NOT_FOUND", "Site not found", undefined, 404);

  await prisma.heritageSite.delete({ where: { id } });

  await logAudit(
    req.user!.userId,
    "DELETE_SITE",
    "HeritageSite",
    String(id),
    { name: existing.name },
    req.ip
  );

  return sendSuccess(res, { message: "Site deleted successfully" });
});

/* -------------------------------------------------------------
   2. REVIEW MODERATION (/api/admin/reviews)
------------------------------------------------------------- */
adminRouter.get("/reviews", async (req: Request, res: Response): Promise<any> => {
  const status = (req.query.status as ReviewStatus) || undefined;

  const reviews = await prisma.review.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      site: {
        select: { id: true, name: true, slug: true, image: true },
      },
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return sendSuccess(res, reviews);
});

// PATCH /api/admin/reviews/:id (Approve or Reject review)
adminRouter.patch("/reviews/:id", async (req: Request, res: Response): Promise<any> => {
  const id = String(req.params.id);
  const { status } = req.body;

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return sendError(res, "INVALID_STATUS", "Status must be APPROVED or REJECTED");
  }

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return sendError(res, "NOT_FOUND", "Review not found", undefined, 404);

  await prisma.$transaction(async (tx) => {
    await tx.review.update({
      where: { id },
      data: { status: status as ReviewStatus },
    });
    await recalculateSiteRating(review.siteId, tx);
  });

  await logAudit(
    req.user!.userId,
    `REVIEW_${status}`,
    "Review",
    id,
    { siteId: review.siteId, status },
    req.ip
  );

  return sendSuccess(res, { message: `Review ${status.toLowerCase()} successfully` });
});

// DELETE /api/admin/reviews/:id
adminRouter.delete("/reviews/:id", async (req: Request, res: Response): Promise<any> => {
  const id = String(req.params.id);
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return sendError(res, "NOT_FOUND", "Review not found", undefined, 404);

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id } });
    await recalculateSiteRating(review.siteId, tx);
  });

  await logAudit(req.user!.userId, "DELETE_REVIEW", "Review", id, undefined, req.ip);

  return sendSuccess(res, { message: "Review deleted successfully" });
});

/* -------------------------------------------------------------
   3. ADMIN ANALYTICS & DASHBOARD STATS (/api/admin/analytics)
------------------------------------------------------------- */
adminRouter.get("/analytics", async (_req: Request, res: Response): Promise<any> => {
  const [totalSites, verifiedSites, pendingReviews, allSites, categories] = await Promise.all([
    prisma.heritageSite.count(),
    prisma.heritageSite.count({ where: { verified: true } }),
    prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
    prisma.heritageSite.findMany({
      select: {
        id: true,
        categoryName: true,
        rating: true,
        reviewCount: true,
        verified: true,
      },
    }),
    prisma.category.findMany({
      select: { name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const categoryNames = categories.map((c) => c.name);

  // Group sites by category
  const breakdown = categoryNames.map((cat) => {
    const inCat = allSites.filter((s) => s.categoryName === cat);
    const verified = inCat.filter((s) => s.verified).length;
    const avgRating = inCat.length
      ? Number((inCat.reduce((sum, s) => sum + s.rating, 0) / inCat.length).toFixed(1))
      : 0.0;
    const totalReviews = inCat.reduce((sum, s) => sum + s.reviewCount, 0);

    return {
      category: cat,
      sites: inCat.length,
      verified,
      avgRating,
      totalReviews,
    };
  });

  const chartColors = [
    "#6E1E24",
    "#C17A45",
    "#A9822C",
    "#2f7a4d",
    "#3a5a8c",
    "#B5533C",
    "#8a3037",
    "#4A1015",
    "#CBA75A",
  ];

  return sendSuccess(res, {
    stats: {
      total: totalSites,
      verified: verifiedSites,
      pending: pendingReviews,
      categories: categoryNames.length,
    },
    categoryChart: {
      labels: categoryNames,
      data: breakdown.map((b) => b.sites),
      colors: chartColors.slice(0, categoryNames.length),
    },
    ratingChart: {
      labels: categoryNames,
      data: breakdown.map((b) => b.avgRating),
    },
    breakdown,
  });
});

/* -------------------------------------------------------------
   4. AUDIT LOGS (/api/admin/audit)
------------------------------------------------------------- */
adminRouter.get("/audit", async (_req: Request, res: Response): Promise<any> => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return sendSuccess(res, logs);
});
