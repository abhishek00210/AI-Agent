import { GreetingPolicyEngine } from "./greeting-policy.engine";
import type { CustomerMemoryContext } from "./customer-memory.types";

describe("GreetingPolicyEngine", () => {
  const engine = new GreetingPolicyEngine();

  it("uses generic greeting for unknown callers", () => {
    const decision = engine.decide(null);
    expect(decision.level).toBe(0);
    expect(decision.personalized).toBe(false);
    expect(decision.instructions).toContain("standard greeting");
  });

  it("uses name-only greeting for known callers without recent context", () => {
    const decision = engine.decide(memory({ recentSummaries: [], appointments: [] }));
    expect(decision.level).toBe(1);
    expect(decision.preview).toContain("Welcome back John");
  });

  it("uses recent summary when it is fresh and high confidence", () => {
    const decision = engine.decide(memory());
    expect(decision.level).toBe(2);
    expect(decision.instructions).toContain("Recent topic");
  });

  it("prioritizes upcoming appointments", () => {
    const decision = engine.decide(
      memory({
        appointments: [
          {
            id: "appointment-1",
            title: "Inspection",
            status: "CONFIRMED",
            startTime: new Date(Date.now() + 86_400_000),
            endTime: new Date(Date.now() + 90_000_000),
            timezone: "America/Toronto",
          },
        ],
      }),
    );
    expect(decision.level).toBe(3);
    expect(decision.instructions).toContain("Upcoming appointment");
    expect(decision.instructions).toContain("Appointment context has priority");
    expect(decision.instructions).not.toContain("Recent topic");
    expect(decision.instructions).not.toContain("Open follow-up");
    expect(sentenceCount(decision.preview)).toBeLessThanOrEqual(2);
  });

  it("keeps summary greetings short", () => {
    const decision = engine.decide(memory());
    expect(decision.level).toBe(2);
    expect(sentenceCount(decision.preview)).toBeLessThanOrEqual(2);
  });

  it("does not mention stale issues older than the recency window", () => {
    const decision = engine.decide(
      memory({ customer: { lastContactAt: new Date("2025-01-01T00:00:00Z") } }),
    );
    expect(decision.level).toBe(1);
    expect(decision.instructions).not.toContain("Recent topic");
  });

  it("falls back when confidence threshold is not met", () => {
    const decision = engine.decide(memory({ recognitionConfidence: "MEDIUM" }), {
      enabled: true,
      recencyWindowDays: 90,
      confidenceThreshold: "HIGH",
    });
    expect(decision.level).toBe(0);
    expect(decision.fallbackReason).toBe("LOW_CONFIDENCE");
  });
});

function memory(
  overrides: Partial<Omit<CustomerMemoryContext, "customer">> & {
    customer?: Partial<CustomerMemoryContext["customer"]>;
  } = {},
): CustomerMemoryContext {
  const { customer: customerOverrides, ...contextOverrides } = overrides;
  const customer = {
    id: "customer-1",
    organizationId: "org-1",
    contactId: "contact-1",
    name: "John Smith",
    company: "ABC Roofing",
    leadStatus: "QUALIFIED" as const,
    lastContactAt: new Date(),
    totalCalls: 2,
    ...customerOverrides,
  };
  return {
    recognized: true,
    recognitionConfidence: "HIGH",
    recentSummaries: [
      {
        id: "summary-1",
        summary: "Customer requested a roof inspection.",
        intent: "Roof inspection",
        sentiment: "POSITIVE",
        outcome: "FOLLOW_UP_REQUIRED",
        nextAction: null,
        followUpRequired: false,
        confidenceScore: 0.9,
        generatedAt: new Date(),
      },
    ],
    recentTimeline: [],
    appointments: [],
    openFollowUps: [],
    promptContext: "",
    estimatedTokens: 0,
    ...contextOverrides,
    customer,
  };
}

function sentenceCount(value: string) {
  return value.split(/[.!?]+/).filter((part) => part.trim()).length;
}
