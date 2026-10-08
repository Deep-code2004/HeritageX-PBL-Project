import { VerificationStatus } from "@prisma/client";
import { Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { rankRecommendations } from "../services/recommendation";
import { sendSuccess } from "../utils/response";
import { verifyAccessToken } from "../utils/tokens";

export const recommendationsRouter = Router();

const recommendationSchema = z.object({
  interests: z.array(z.string()).optional(),
  time: z.enum(["1h", "2h", "half", "full"]).optional(),
  style: z.enum(["walking", "transit", "bikecar"]).optional(),
  area: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  availableMinutes: z.number().optional(),
  radiusKm: z.number().optional(),
  limit: z.number().max(20).default(6),
});

// Area coordinate dictionary matching recommendations.js
const AREA_COORDINATES: Record<string, { lat: number; lng: number; label: string }> = {
  bhadra: { lat: 23.0225, lng: 72.5825, label: "Bhadra Fort / Old City Core" },
  kalupur: { lat: 23.0294, lng: 72.5906, label: "Kalupur (Swaminarayan Temple)" },
  riverfront: { lat: 23.061, lng: 72.5806, label: "Riverfront (Sabarmati Ashram side)" },
  station: { lat: 23.0258, lng: 72.5972, label: "Railway Station area" },
};

const TIME_MINUTES: Record<string, number> = {
  "1h": 60,
  "2h": 120,
  half: 240,
  full: 480,
};

const STYLE_RADIUS: Record<string, number> = {
  walking: 2,
  transit: 6,
  bikecar: 15,
};

type RecBody = z.infer<typeof recommendationSchema>;

// POST /api/recommendations
recommendationsRouter.post("/", async (req: Request, res: Response): Promise<any> => {
  const result = recommendationSchema.safeParse(req.body);
  const data: RecBody = result.success ? result.data : { limit: 6 };

  // Check if request is authenticated to pull user saved preferences as fallback
  let userInterests: string[] = [];
  const token =
    req.cookies?.hx_access_token ||
    req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      const pref = await prisma.preference.findUnique({
        where: { userId: payload.userId },
      });
      if (pref) {
        userInterests = pref.interests;
      }
    }
  }

  const interests = data.interests || (userInterests.length ? userInterests : ["history"]);

  let lat = data.lat;
  let lng = data.lng;
  let areaLabel: string | undefined;

  if (data.area && AREA_COORDINATES[data.area]) {
    lat = AREA_COORDINATES[data.area].lat;
    lng = AREA_COORDINATES[data.area].lng;
    areaLabel = AREA_COORDINATES[data.area].label;
  }

  const availableMinutes =
    data.availableMinutes || (data.time ? TIME_MINUTES[data.time] : 120);

  const radiusKm =
    data.radiusKm || (data.style ? STYLE_RADIUS[data.style] : 6);

  const sites = await prisma.heritageSite.findMany({
    where: {
      verification: VerificationStatus.VERIFIED,
    },
  });

  const ranked = rankRecommendations(sites, {
    interests,
    lat,
    lng,
    availableMinutes,
    radiusKm,
    areaLabel,
    limit: data.limit,
  });

  return sendSuccess(res, ranked);
});
