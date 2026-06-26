import { ForbiddenException } from "@nestjs/common";
import { FeatureGateService, PLAN_LIMITS } from "./feature-gate.service";

describe("FeatureGateService", () => {
  const billing = {
    usage: jest.fn(),
    usageForFeature: jest.fn(),
    entitlementContext: jest.fn(),
  };
  const service = new FeatureGateService(billing as never);

  it("exposes the requested plan limits", () => {
    expect(PLAN_LIMITS.FREE).toEqual({
      agents: 1,
      voiceMinutes: 50,
      sms: 20,
      chatMessages: null,
      knowledgeBases: 1,
      phoneNumbers: null,
      widgets: null,
      campaignTargets: 0,
    });
    expect(PLAN_LIMITS.STARTER.campaignTargets).toBe(100);
    expect(PLAN_LIMITS.PRO.campaignTargets).toBe(1_000);
    expect(PLAN_LIMITS.AGENCY.campaignTargets).toBe(10_000);
    expect(PLAN_LIMITS.AGENCY.sms).toBe(10_000);
    expect(PLAN_LIMITS.AGENCY.widgets).toBeNull();
  });

  it("blocks usage above a tenant plan limit", async () => {
    billing.usage.mockResolvedValue({
      agents: 1,
      voiceMinutes: 0,
      sms: 0,
      chatMessages: 0,
      knowledgeBases: 0,
      phoneNumbers: 0,
      widgets: 0,
    });
    billing.usageForFeature.mockResolvedValue(1);
    await expect(
      service.assertAvailable("org-1", "FREE", "agents", new Date(), 1),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("resolves an active no-card trial to Starter entitlements", async () => {
    billing.entitlementContext.mockResolvedValue({
      id: "org-trial",
      plan: "STARTER",
      status: "ACTIVE",
      trialStartsAt: new Date(Date.now() - 1_000),
      trialEndsAt: new Date(Date.now() + 86_400_000),
      trialStatus: "ACTIVE",
      subscriptions: [],
      featureOverrides: [],
    });
    await expect(service.resolve("org-trial")).resolves.toMatchObject({
      plan: "STARTER",
      source: "TRIAL",
      state: "TRIAL",
      allowed: true,
    });
  });

  it("blocks an expired trial even before the expiration worker runs", async () => {
    billing.entitlementContext.mockResolvedValue({
      id: "org-expired",
      plan: "STARTER",
      status: "ACTIVE",
      trialStartsAt: new Date(Date.now() - 20 * 86_400_000),
      trialEndsAt: new Date(Date.now() - 1_000),
      trialStatus: "ACTIVE",
      subscriptions: [],
      featureOverrides: [],
    });
    await expect(service.resolve("org-expired")).resolves.toMatchObject({
      source: "BLOCKED",
      allowed: false,
    });
    await expect(service.assertAvailable("org-expired", "sms")).rejects.toThrow(
      "Upgrade to continue",
    );
  });

  it("blocks active Stripe subscriptions while pause collection is active", async () => {
    billing.entitlementContext.mockResolvedValue({
      id: "org-paused",
      plan: "PRO",
      status: "ACTIVE",
      trialStartsAt: null,
      trialEndsAt: null,
      trialStatus: null,
      subscriptions: [
        {
          plan: "PRO",
          status: "ACTIVE",
          currentPeriodStart: new Date(Date.now() - 1_000),
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
          pausedAt: new Date(),
          pauseResumesAt: new Date(Date.now() + 86_400_000),
        },
      ],
      featureOverrides: [],
    });
    await expect(service.resolve("org-paused")).resolves.toMatchObject({
      state: "PAUSED",
      allowed: false,
    });
  });
});
