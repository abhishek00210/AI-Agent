import { expect, request, test } from "@playwright/test";

const apiUrl = process.env.E2E_API_URL ?? "https://agent-api.zodo.ca/api/v1";
const adminUrl = process.env.E2E_ADMIN_URL ?? "https://admin-agent.zodo.ca";

test.describe("launch readiness security and routing", () => {
  test("health reports database and Redis state without secrets", async () => {
    const api = await request.newContext({ baseURL: `${apiUrl}/` });
    const response = await api.get("health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.dependencies.database).toBe("configured");
    expect(JSON.stringify(body)).not.toMatch(/password|authorization|api[_-]?key/i);
    await api.dispose();
  });

  for (const route of [
    "/campaigns",
    "/outbound-calls",
    "/customers",
    "/appointments",
    "/analytics",
    "/usage/current",
    "/billing/subscription",
    "/voice/phone-numbers",
  ]) {
    test(`tenant endpoint ${route} rejects anonymous access`, async () => {
      const api = await request.newContext({ baseURL: `${apiUrl}/` });
      const response = await api.get(route.slice(1));
      expect(response.status()).toBe(401);
      await api.dispose();
    });
  }

  test("admin verification cannot be accessed by an anonymous tenant", async () => {
    const api = await request.newContext({ baseURL: `${apiUrl}/` });
    const response = await api.get("admin/dashboard");
    expect(response.status()).toBe(401);
    await api.dispose();
  });

  test("double API prefix remains invalid", async () => {
    const api = await request.newContext({ baseURL: `${apiUrl}/` });
    const response = await api.get("api/v1/organizations/current");
    expect(response.status()).not.toBe(200);
    await api.dispose();
  });

  test("tenant and admin pages are reachable through their isolated domains", async ({ request: web }) => {
    expect((await web.get("/login")).status()).toBe(200);
    expect((await web.get("/campaigns")).status()).toBe(200);
    const admin = await request.newContext({ baseURL: adminUrl });
    expect((await admin.get("/admin-login")).status()).toBe(200);
    expect((await admin.get("/admin/campaigns")).status()).toBe(200);
    await admin.dispose();
  });
});

test.describe("authenticated read-only verification", () => {
  test("tenant can read integrated resources", async () => {
    test.skip(!process.env.E2E_ACCESS_TOKEN, "E2E_ACCESS_TOKEN is required for tenant read checks");
    const api = await request.newContext({
      baseURL: `${apiUrl}/`,
      extraHTTPHeaders: { authorization: `Bearer ${process.env.E2E_ACCESS_TOKEN}` },
    });
    for (const route of ["/campaigns", "/outbound-calls", "/customers", "/analytics?range=30D", "/usage/current"]) {
      expect((await api.get(route.slice(1))).status(), route).toBe(200);
    }
    await api.dispose();
  });

  test("admin launch report is generated read-only", async () => {
    test.skip(!process.env.E2E_ADMIN_TOKEN, "E2E_ADMIN_TOKEN is required for launch-report checks");
    const api = await request.newContext({
      baseURL: `${apiUrl}/`,
      extraHTTPHeaders: { authorization: `Bearer ${process.env.E2E_ADMIN_TOKEN}` },
    });
    const response = await api.get("admin/launch-readiness");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.performance.every((metric: { samples: number }) => metric.samples === 100)).toBe(true);
    await api.dispose();
  });
});
