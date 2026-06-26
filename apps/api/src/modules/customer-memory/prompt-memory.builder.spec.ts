import { PromptMemoryBuilder } from "./prompt-memory.builder";

describe("PromptMemoryBuilder", () => {
  it("sanitizes untrusted memory and bounds prompt size", () => {
    const builder = new PromptMemoryBuilder();
    const context = {
      customer: { id: "c1", organizationId: "org-1", contactId: "ct1", name: "+14165550100", company: "ACME\u0000", leadStatus: "QUALIFIED" as const, lastContactAt: null, totalCalls: 2 },
      recognized: true,
      recognitionConfidence: "HIGH" as const,
      recentSummaries: Array.from({ length: 5 }, (_, index) => ({ id: `s${index}`, summary: "x".repeat(1_000), intent: "Inspection", sentiment: "NEUTRAL" as const, outcome: "INFORMATION_PROVIDED" as const, nextAction: null, followUpRequired: false, confidenceScore: 0.9, generatedAt: new Date() })),
      recentTimeline: [],
      appointments: [],
      openFollowUps: [],
    };
    const value = builder.build(context);
    expect(value.length).toBeLessThanOrEqual(6_000);
    expect(value).not.toContain("\u0000");
    expect(value).toContain("Customer name: not confirmed");
  });
});
