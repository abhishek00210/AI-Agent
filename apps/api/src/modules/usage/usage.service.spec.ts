import { UsageService } from "./usage.service";

describe("UsageService", () => {
  const period = {
    start: new Date("2026-06-01T00:00:00.000Z"),
    end: new Date("2026-07-01T00:00:00.000Z"),
    source: "CALENDAR" as const,
  };

  function setup() {
    const values = new Map<string, number>();
    const idempotency = new Set<string>();
    const repository = {
      billingPeriod: jest.fn().mockResolvedValue(period),
      apply: jest.fn(
        async (
          input: { organizationId: string; resourceType: string; idempotencyKey?: string },
          _period: unknown,
          delta: number,
        ) => {
          const eventKey = `${input.organizationId}:${input.idempotencyKey}`;
          if (input.idempotencyKey && idempotency.has(eventKey)) {
            return counter(
              input.organizationId,
              input.resourceType,
              values.get(`${input.organizationId}:${input.resourceType}`) ?? 0,
            );
          }
          if (input.idempotencyKey) idempotency.add(eventKey);
          const key = `${input.organizationId}:${input.resourceType}`;
          values.set(key, Math.max(0, (values.get(key) ?? 0) + delta));
          return counter(input.organizationId, input.resourceType, values.get(key) ?? 0);
        },
      ),
      counters: jest.fn(async (organizationId: string) =>
        [...values.entries()]
          .filter(([key]) => key.startsWith(`${organizationId}:`))
          .map(([key, value]) => counter(organizationId, key.split(":")[1], value)),
      ),
      setCounter: jest.fn(),
      createAudit: jest.fn(),
      history: jest.fn().mockResolvedValue([0, []]),
    };
    const redis = {
      isAvailable: true,
      cache: { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() },
    };
    const metrics = { increment: jest.fn() };
    return {
      service: new UsageService(repository as never, redis as never, metrics as never),
      repository,
      redis,
    };
  }

  it("counts 100 concurrent successful SMS increments exactly once", async () => {
    const { service } = setup();
    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        service.increment({
          organizationId: "org-a",
          resourceType: "SMS_MESSAGES",
          idempotencyKey: `sms:${index}`,
        }),
      ),
    );
    const usage = await service.getUsage("org-a", period);
    expect(usage.values.SMS_MESSAGES).toBe(100);
  });

  it("deduplicates retried events and isolates tenants", async () => {
    const { service } = setup();
    await Promise.all([
      service.increment({
        organizationId: "org-a",
        resourceType: "MESSAGES",
        idempotencyKey: "response:1",
      }),
      service.increment({
        organizationId: "org-a",
        resourceType: "MESSAGES",
        idempotencyKey: "response:1",
      }),
      service.increment({
        organizationId: "org-b",
        resourceType: "MESSAGES",
        idempotencyKey: "response:1",
      }),
    ]);
    expect((await service.getUsage("org-a", period)).values.MESSAGES).toBe(1);
    expect((await service.getUsage("org-b", period)).values.MESSAGES).toBe(1);
  });

  it("never decrements a counter below zero and invalidates Redis", async () => {
    const { service, redis } = setup();
    await service.decrement({
      organizationId: "org-a",
      resourceType: "AGENTS",
      quantity: 10,
      idempotencyKey: "agent:delete:1",
    });
    expect((await service.getUsage("org-a", period)).values.AGENTS).toBe(0);
    expect(redis.cache.del).toHaveBeenCalledWith("usage:v1:org-a:2026-06-01T00:00:00.000Z");
  });
});

function counter(organizationId: string, resourceType: string, value: number) {
  return {
    id: `${organizationId}:${resourceType}`,
    organizationId,
    resourceType,
    currentValue: { valueOf: () => value, toString: () => String(value) },
    billingPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
    billingPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
    version: 1,
    updatedAt: new Date("2026-06-20T00:00:00.000Z"),
  };
}
