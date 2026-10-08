import { PrismaClient, VerificationStatus } from "@prisma/client";
import * as argon2 from "argon2";
import fs from "fs";
import path from "path";
import { env } from "../src/config/env";

const prisma = new PrismaClient();

function parseDurationMinutes(str?: string): number {
  if (!str) return 60;
  const nums = str.match(/\d+/g);
  if (!nums) return 60;
  const vals = nums.map(Number);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("🌱 Starting database seed...");

  // Load extracted data
  const dataRaw = fs.readFileSync(path.resolve(__dirname, "seedData.json"), "utf8");
  const { sites, culture, walks, reviews } = JSON.parse(dataRaw);

  // 1. Seed Categories
  console.log("📁 Seeding Categories...");
  const categoryNames: string[] = Array.from(new Set(sites.map((s: any) => s.category)));
  const categoryMap = new Map<string, string>();

  for (const catName of categoryNames) {
    const slug = slugify(catName);
    const cat = await prisma.category.upsert({
      where: { name: catName },
      update: { slug },
      create: {
        name: catName,
        slug,
      },
    });
    categoryMap.set(catName, cat.id);
  }
  console.log(`✅ Seeded ${categoryNames.length} categories.`);

  // 2. Seed Heritage Sites
  console.log("🏛️ Seeding Heritage Sites...");
  for (const s of sites) {
    const categoryId = categoryMap.get(s.category);
    if (!categoryId) continue;

    await prisma.heritageSite.upsert({
      where: { id: s.id },
      update: {
        slug: s.slug,
        name: s.name,
        categoryId,
        categoryName: s.category,
        tags: s.tags || [],
        interests: s.interests || [],
        shortDescription: s.shortDescription || "",
        history: s.history || null,
        culturalSignificance: s.culturalSignificance || null,
        architecture: s.architecture || null,
        image: s.image,
        gallery: s.gallery || [s.image],
        latitude: s.latitude,
        longitude: s.longitude,
        rating: s.rating || 0.0,
        reviewCount: s.reviewCount || 0,
        duration: s.duration || "60 min",
        durationMinutes: parseDurationMinutes(s.duration),
        timings: s.timings || null,
        entryFee: s.entryFee || null,
        nearbyPlaces: s.nearbyPlaces || [],
        responsibleGuidelines: s.responsibleGuidelines || [],
        verified: s.verified ?? true,
        verification: VerificationStatus.VERIFIED,
        source: s.source || null,
      },
      create: {
        id: s.id,
        slug: s.slug,
        name: s.name,
        categoryId,
        categoryName: s.category,
        tags: s.tags || [],
        interests: s.interests || [],
        shortDescription: s.shortDescription || "",
        history: s.history || null,
        culturalSignificance: s.culturalSignificance || null,
        architecture: s.architecture || null,
        image: s.image,
        gallery: s.gallery || [s.image],
        latitude: s.latitude,
        longitude: s.longitude,
        rating: s.rating || 0.0,
        reviewCount: s.reviewCount || 0,
        duration: s.duration || "60 min",
        durationMinutes: parseDurationMinutes(s.duration),
        timings: s.timings || null,
        entryFee: s.entryFee || null,
        nearbyPlaces: s.nearbyPlaces || [],
        responsibleGuidelines: s.responsibleGuidelines || [],
        verified: s.verified ?? true,
        verification: VerificationStatus.VERIFIED,
        source: s.source || null,
      },
    });
  }
  console.log(`✅ Seeded ${sites.length} heritage sites.`);

  // 3. Seed Culture Sections
  console.log("🎨 Seeding Culture Sections...");
  for (const c of culture) {
    await prisma.culture.upsert({
      where: { id: c.id },
      update: {
        title: c.title,
        icon: c.icon,
        summary: c.summary,
        body: c.body,
      },
      create: {
        id: c.id,
        title: c.title,
        icon: c.icon,
        summary: c.summary,
        body: c.body,
      },
    });
  }
  console.log(`✅ Seeded ${culture.length} culture sections.`);

  // 4. Seed Heritage Walks
  console.log("🚶 Seeding Heritage Walks...");
  for (const w of walks) {
    await prisma.heritageWalk.upsert({
      where: { id: w.id },
      update: {
        title: w.title,
        type: w.type,
        duration: w.duration,
        difficulty: w.difficulty,
        stops: w.stops,
        startingPoint: w.startingPoint,
        endingPoint: w.endingPoint,
        route: w.route || [],
        culturalStory: w.culturalStory || "",
      },
      create: {
        id: w.id,
        title: w.title,
        type: w.type,
        duration: w.duration,
        difficulty: w.difficulty,
        stops: w.stops,
        startingPoint: w.startingPoint,
        endingPoint: w.endingPoint,
        route: w.route || [],
        culturalStory: w.culturalStory || "",
      },
    });
  }
  console.log(`✅ Seeded ${walks.length} heritage walks.`);

  // 5. Seed Admin User
  console.log("👤 Seeding Admin User...");
  const adminPasswordHash = await argon2.hash(env.ADMIN_PASSWORD, {
    type: argon2.argon2id,
  });

  const admin = await prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: {
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
    create: {
      name: "HeritageX Admin",
      email: env.ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });
  console.log(`✅ Seeded admin user (${admin.email}).`);

  // 6. Seed Demo Reviews
  console.log("⭐ Seeding Initial Reviews...");
  for (const siteIdStr of Object.keys(reviews)) {
    const siteId = Number(siteIdStr);
    const siteReviews = reviews[siteIdStr];
    for (const r of siteReviews) {
      await prisma.review.upsert({
        where: {
          siteId_userId: {
            siteId,
            userId: admin.id,
          },
        },
        update: {
          author: r.author,
          rating: r.rating,
          comment: r.text,
          helpful: r.helpful || 0,
          status: "APPROVED",
        },
        create: {
          siteId,
          userId: admin.id,
          author: r.author,
          rating: r.rating,
          comment: r.text,
          helpful: r.helpful || 0,
          status: "APPROVED",
        },
      });
    }
  }
  console.log("✅ Seeded initial approved reviews.");

  console.log("🎉 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
