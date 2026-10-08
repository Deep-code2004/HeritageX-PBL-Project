import { HeritageSite } from "@prisma/client";
import { distanceKm } from "../utils/geo";

export interface RecommendationInput {
  interests: string[];
  lat?: number;
  lng?: number;
  availableMinutes?: number;
  radiusKm?: number;
  areaLabel?: string;
  limit?: number;
}

export interface RecommendationResult {
  site: HeritageSite;
  score: number;
  matchPercentage: number;
  distanceKm?: number;
  matchedInterests: string[];
  reason: string;
}

export function scoreSite(
  site: HeritageSite,
  input: RecommendationInput
): RecommendationResult {
  const { interests, lat, lng, availableMinutes = 120, radiusKm = 6, areaLabel } = input;

  // 1) Category / interest match — up to 45 points
  const matchedInterests = site.interests.filter((i) => interests.includes(i));
  const interestScore = interests.length
    ? (matchedInterests.length / interests.length) * 45
    : 0;

  // 2) Distance score — up to 25 points
  let dist: number | undefined;
  let distanceScore = 15; // default neutral if no lat/lng provided
  if (typeof lat === "number" && typeof lng === "number") {
    dist = distanceKm(lat, lng, site.latitude, site.longitude);
    distanceScore = Math.max(0, 25 * (1 - dist / (radiusKm * 1.6)));
  }

  // 3) Time budget fit — up to 20 points
  const siteMinutes = site.durationMinutes || 60;
  let timeScore = 2;
  if (siteMinutes <= availableMinutes) {
    timeScore = 20;
  } else if (siteMinutes <= availableMinutes * 1.3) {
    timeScore = 10;
  }

  // 4) Rating score — up to 10 points
  const ratingScore = ((site.rating || 4.0) / 5) * 10;

  const totalScore = Math.round(interestScore + distanceScore + timeScore + ratingScore);

  // Transparent human-readable explanation
  const parts: string[] = [];
  if (matchedInterests.length) {
    parts.push(`you selected ${matchedInterests.join(" & ")}`);
  }
  if (typeof dist === "number") {
    const locName = areaLabel ? areaLabel.split("(")[0].trim() : "your chosen starting point";
    parts.push(`it is ${dist.toFixed(1)} km from ${locName}`);
  }
  if (siteMinutes <= availableMinutes) {
    parts.push("it fits comfortably within your available time");
  }

  const reason = parts.length
    ? `Recommended because ${parts.join(", and ")}.`
    : `Recommended based on high visitor ratings (${site.rating.toFixed(1)}/5).`;

  return {
    site,
    score: totalScore,
    matchPercentage: Math.min(99, Math.max(40, totalScore)),
    distanceKm: typeof dist === "number" ? Number(dist.toFixed(2)) : undefined,
    matchedInterests,
    reason,
  };
}

export function rankRecommendations(
  sites: HeritageSite[],
  input: RecommendationInput
): RecommendationResult[] {
  const scored = sites.map((site) => scoreSite(site, input));
  scored.sort((a, b) => b.score - a.score);

  const limit = input.limit || 6;
  return scored.slice(0, limit);
}
