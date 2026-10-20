import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { env, parseEnvironment } from "../src/config/env";

describe("HeritageX Backend API Test Suite", () => {
  // 1. Health check
  it("GET /api/health should return status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
  });

  it("allows credentialed CORS requests from configured origins", async () => {
    const origin = env.CORS_ORIGINS[0];
    const res = await request(app).get("/api/health").set("Origin", origin);

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("allows browser preflight requests from configured origins", async () => {
    const origin = env.CORS_ORIGINS[0];
    const res = await request(app)
      .options("/api/auth/login")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,x-requested-with");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("does not grant CORS access to unconfigured origins", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "https://not-allowed.example.test");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("supports non-browser health checks without an Origin header", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("requires exact explicit CORS origins in production", () => {
    const productionEnv = { ...process.env, NODE_ENV: "production" };

    expect(() =>
      parseEnvironment({ ...productionEnv, CORS_ORIGINS: "" })
    ).toThrow(/CORS_ORIGINS/);
    expect(() =>
      parseEnvironment({
        ...productionEnv,
        CORS_ORIGINS: "https://heritage-x.netlify.app/path",
      })
    ).toThrow(/CORS_ORIGINS/);
    expect(() =>
      parseEnvironment({
        ...productionEnv,
        CORS_ORIGINS: "http://heritage-x.netlify.app",
      })
    ).toThrow(/CORS_ORIGINS/);
    expect(() =>
      parseEnvironment({
        ...productionEnv,
        CORS_ORIGINS: "http://localhost:5500",
      })
    ).toThrow(/CORS_ORIGINS/);
    expect(
      parseEnvironment({
        ...productionEnv,
        CORS_ORIGINS: "https://heritage-x.netlify.app",
      }).CORS_ORIGINS
    ).toEqual(["https://heritage-x.netlify.app"]);
  });

  // 2. Public heritage catalogue
  it(
    "GET /api/heritage should return verified sites",
    async () => {
      const res = await request(app).get("/api/heritage?limit=5");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(15);
    },
    20000
  );

  it(
    "GET /api/heritage?sort=reviews should order sites by review count",
    async () => {
      const res = await request(app).get("/api/heritage?sort=reviews&limit=10");
      expect(res.status).toBe(200);
      const reviewCounts = res.body.data.map((site: { reviewCount: number }) => site.reviewCount);
      expect(reviewCounts).toEqual([...reviewCounts].sort((a: number, b: number) => b - a));
    },
    20000
  );

  // 3. Single site detail
  it(
    "GET /api/heritage/:idOrSlug should return Bhadra Fort",
    async () => {
      const res = await request(app).get("/api/heritage/bhadra-fort");
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Bhadra Fort");
      expect(res.body.data.categoryName).toBe("Historical Monuments");
    },
    20000
  );

  // 4. Recommendation algorithm
  it(
    "POST /api/recommendations should return scored recommendations",
    async () => {
      const res = await request(app)
        .post("/api/recommendations")
        .set("X-Requested-With", "HeritageX")
        .send({
          interests: ["history"],
          time: "2h",
          style: "walking",
          area: "bhadra",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].score).toBeGreaterThan(50);
      expect(res.body.data[0].reason).toContain("Recommended because");
    },
    20000
  );

  // 5. CSRF defense
  it("State-changing requests without X-Requested-With should be rejected with 403", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: "admin", password: "wrong" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF_VALIDATION_FAILED");
  });

  // 6. RBAC unauthorized access
  it("Unauthenticated request to /api/admin/analytics should return 401", async () => {
    const res = await request(app).get("/api/admin/analytics");
    expect(res.status).toBe(401);
  });

  it("Unauthenticated visitor actions remain protected", async () => {
    const saved = await request(app)
      .post("/api/saved/merge")
      .set("X-Requested-With", "HeritageX")
      .send({ siteIds: [1] });
    const itinerary = await request(app)
      .post("/api/itineraries/merge")
      .set("X-Requested-With", "HeritageX")
      .send({ stops: [{ siteId: 1 }] });
    const review = await request(app)
      .post("/api/heritage/1/reviews")
      .set("X-Requested-With", "HeritageX")
      .send({ rating: 5, comment: "A lovely visit." });

    expect(saved.status).toBe(401);
    expect(itinerary.status).toBe(401);
    expect(review.status).toBe(401);
  });

});
