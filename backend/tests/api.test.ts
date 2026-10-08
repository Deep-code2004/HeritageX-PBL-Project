import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("HeritageX Backend API Test Suite", () => {
  // 1. Health check
  it("GET /api/health should return status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
  });

  // 2. Public heritage catalogue
  it("GET /api/heritage should return verified sites", async () => {
    const res = await request(app).get("/api/heritage?limit=5");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(15);
  });

  // 3. Single site detail
  it("GET /api/heritage/:idOrSlug should return Bhadra Fort", async () => {
    const res = await request(app).get("/api/heritage/bhadra-fort");
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Bhadra Fort");
    expect(res.body.data.categoryName).toBe("Historical Monuments");
  });

  // 4. Recommendation algorithm
  it("POST /api/recommendations should return scored recommendations", async () => {
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
  });

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

  // 7. Admin login
  it("POST /api/auth/admin/login with correct credentials should succeed and return role ADMIN", async () => {
    const res = await request(app)
      .post("/api/auth/admin/login")
      .set("X-Requested-With", "HeritageX")
      .send({
        emailOrUsername: "heritagex_admin",
        password: "PBL-Demo-2026!",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe("ADMIN");
  });
});
