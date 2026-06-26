import { CustomerMemoryContextService } from "../src/modules/customer-memory/customer-memory-context.service";
import { GreetingPolicyEngine } from "../src/modules/customer-memory/greeting-policy.engine";
import { GreetingService } from "../src/modules/customer-memory/greeting.service";
import { PromptMemoryBuilder } from "../src/modules/customer-memory/prompt-memory.builder";
import { PromptAssemblyService } from "../src/modules/openai/prompt-assembly.service";

async function main() {
  const samples = Number(process.env.SAMPLES ?? 1_000);
  const prompts = new PromptMemoryBuilder();
  const memory = new CustomerMemoryContextService(mockPrisma() as never, redisOff() as never, prompts);
  const greetings = new GreetingService(mockPrisma() as never, new GreetingPolicyEngine());
  const assembly = new PromptAssemblyService();
  const timings: Record<string, number[]> = {
    memoryLoadMs: [],
    greetingBuildMs: [],
    promptAssemblyMs: [],
    totalMs: [],
  };

  for (let index = 0; index < samples; index += 1) {
    const totalStarted = performance.now();
    const memoryStarted = performance.now();
    const context = await memory.buildContext({
      organizationId: "org-benchmark",
      customerProfileId: "customer-benchmark",
      interactionId: `benchmark-${index}`,
      excludeCallId: "call-current",
      channel: "VOICE",
      track: false,
    });
    timings.memoryLoadMs.push(performance.now() - memoryStarted);

    const greetingStarted = performance.now();
    const greeting = await greetings.build({
      organizationId: "org-benchmark",
      interactionId: `benchmark-${index}`,
      channel: "VOICE",
      memory: context,
      track: false,
    });
    timings.greetingBuildMs.push(performance.now() - greetingStarted);

    const promptStarted = performance.now();
    assembly.instructions({
      systemPrompt: "You are a helpful receptionist.",
      memorySummary: null,
      memoryFacts: [],
      customerMemoryContext: context.promptContext,
      greetingInstructions: greeting.instructions,
      knowledgeContext: "",
    });
    timings.promptAssemblyMs.push(performance.now() - promptStarted);
    timings.totalMs.push(performance.now() - totalStarted);
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        samples,
        note: "Synthetic in-process benchmark for bounded memory context, greeting policy, and prompt assembly. Excludes network, real database, Redis, OpenAI, and Twilio latency.",
        memoryLoadMs: percentiles(timings.memoryLoadMs),
        greetingBuildMs: percentiles(timings.greetingBuildMs),
        promptAssemblyMs: percentiles(timings.promptAssemblyMs),
        totalIncrementalOverheadMs: percentiles(timings.totalMs),
      },
      null,
      2,
    )}\n`,
  );
}

function mockPrisma() {
  const now = new Date();
  return {
    organization: {
      findFirst: async () => ({
        personalizedGreetingsEnabled: true,
        greetingRecencyWindowDays: 90,
        greetingConfidenceThreshold: "MEDIUM",
      }),
    },
    customerProfile: {
      findFirst: async () => ({
        id: "customer-benchmark",
        organizationId: "org-benchmark",
        contactId: "contact-benchmark",
        name: "John Smith",
        company: "ABC Roofing",
        leadStatus: "QUALIFIED",
        lastContactAt: now,
        totalCalls: 4,
      }),
    },
    callSummary: {
      findMany: async (query: { select?: Record<string, boolean> }) =>
        query.select?.nextAction && !query.select?.summary
          ? [{ id: "summary-1", nextAction: "Send inspection quote.", generatedAt: now }]
          : [
              {
                id: "summary-1",
                summary: "Customer requested a roof inspection and estimate.",
                intent: "Roof inspection",
                sentiment: "POSITIVE",
                outcome: "FOLLOW_UP_REQUIRED",
                nextAction: "Send inspection quote.",
                followUpRequired: true,
                confidenceScore: 0.92,
                generatedAt: now,
              },
            ],
    },
    customerTimelineEvent: {
      findMany: async () => [
        {
          id: "event-1",
          eventType: "APPOINTMENT_BOOKED",
          title: "Appointment booked",
          description: "Roof inspection booked.",
          occurredAt: now,
          sourceEntityType: "Appointment",
          sourceEntityId: "appointment-1",
        },
      ],
    },
    appointment: {
      findMany: async (query: { where?: { startTime?: { gte?: Date; lt?: Date } } }) =>
        query.where?.startTime?.gte
          ? [
              {
                id: "appointment-1",
                title: "Roof inspection",
                status: "CONFIRMED",
                startTime: new Date(Date.now() + 86_400_000),
                endTime: new Date(Date.now() + 90_000_000),
                timezone: "America/Toronto",
              },
            ]
          : [],
    },
  };
}

function redisOff() {
  return { isAvailable: false, cache: { get: async () => null, set: async () => undefined } };
}

function percentiles(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (value: number) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1)];
  return {
    p50: Number(percentile(0.5).toFixed(3)),
    p95: Number(percentile(0.95).toFixed(3)),
    p99: Number(percentile(0.99).toFixed(3)),
  };
}

void main();
