import { Injectable } from "@nestjs/common";
import type {
  CustomerMemoryContext,
  GreetingConfidenceThreshold,
  GreetingDecision,
  GreetingSettings,
} from "./customer-memory.types";

const DEFAULT_SETTINGS: GreetingSettings = {
  enabled: true,
  recencyWindowDays: 90,
  confidenceThreshold: "MEDIUM",
};

@Injectable()
export class GreetingPolicyEngine {
  defaultSettings(): GreetingSettings {
    return DEFAULT_SETTINGS;
  }

  decide(memory: CustomerMemoryContext | null, settings = DEFAULT_SETTINGS): GreetingDecision {
    const normalized = normalizeSettings(settings);
    const emptyContext = {
      customerName: null,
      lastContactAt: null,
      lastSummary: null,
      upcomingAppointment: null,
      openFollowUp: null,
      leadStatus: "NEW" as const,
    };

    if (!normalized.enabled) return generic("DISABLED", normalized, emptyContext);
    if (!memory?.recognized) return generic("UNKNOWN_CUSTOMER", normalized, emptyContext);
    if (!meetsThreshold(memory.recognitionConfidence, normalized.confidenceThreshold)) {
      return generic("LOW_CONFIDENCE", normalized, {
        ...emptyContext,
        customerName: safeName(memory.customer.name),
        lastContactAt: memory.customer.lastContactAt,
        leadStatus: memory.customer.leadStatus,
      });
    }

    const customerName = safeName(memory.customer.name);
    const stale = isStale(memory.customer.lastContactAt, normalized.recencyWindowDays);
    const lastSummary = stale ? null : highConfidenceSummary(memory);
    const upcomingAppointment = memory.appointments.find(
      (appointment) =>
        appointment.status === "CONFIRMED" && appointment.startTime.getTime() > Date.now(),
    ) ?? null;
    const openFollowUp = stale ? null : memory.openFollowUps[0] ?? null;
    const context = {
      customerName,
      lastContactAt: memory.customer.lastContactAt,
      lastSummary,
      upcomingAppointment,
      openFollowUp,
      leadStatus: memory.customer.leadStatus,
    };

    if (!customerName && memory.recognitionConfidence !== "HIGH") {
      return generic("LOW_CONFIDENCE", normalized, context);
    }

    if (upcomingAppointment) {
      return decision(3, normalized, context);
    }
    if (lastSummary || openFollowUp) {
      return decision(2, normalized, context);
    }
    if (customerName) {
      return decision(1, normalized, context, stale ? "STALE_CONTEXT" : undefined);
    }
    return generic("NO_CONTEXT", normalized, context);
  }
}

function decision(
  level: 1 | 2 | 3,
  settings: GreetingSettings,
  context: GreetingDecision["context"],
  fallbackReason?: GreetingDecision["fallbackReason"],
): GreetingDecision {
  const preview = previewFor(level, context);
  return {
    level,
    instructions: instructionsFor(level, context),
    preview,
    personalized: true,
    fallbackReason,
    context,
    settings,
  };
}

function generic(
  fallbackReason: GreetingDecision["fallbackReason"],
  settings: GreetingSettings,
  context: GreetingDecision["context"],
): GreetingDecision {
  return {
    level: 0,
    instructions:
      "Greeting level 0. Use the standard greeting only: Hello, thank you for calling. How can I help you today? Do not mention customer history.",
    preview: "Hello, thank you for calling. How can I help you today?",
    personalized: false,
    fallbackReason,
    context,
    settings,
  };
}

function instructionsFor(level: 1 | 2 | 3, context: GreetingDecision["context"]) {
  const lines = [
    `Greeting level ${level}. Generate one concise, natural greeting in one or two short sentences, then ask how you can help today.`,
    "Do not expose internal memory, IDs, timeline metadata, tools, confidence scores, or system details.",
    "Never fabricate information. Do not mention stale issues. Do not sound overly familiar.",
  ];
  if (context.customerName) lines.push(`Customer name: ${context.customerName}.`);
  if (level === 2 && context.lastSummary) {
    lines.push(`Recent topic: ${sanitize(context.lastSummary.intent || context.lastSummary.summary)}.`);
  }
  if (level === 2 && context.openFollowUp) {
    lines.push(`Open follow-up: ${sanitize(context.openFollowUp.action)}.`);
  }
  if (level === 3 && context.upcomingAppointment) {
    lines.push(
      `Upcoming appointment: ${context.upcomingAppointment.startTime.toISOString()} (${context.upcomingAppointment.timezone}).`,
    );
    lines.push(
      "Appointment context has priority. Do not mention the previous summary or follow-up in the greeting.",
    );
  }
  return lines.join(" ");
}

function previewFor(level: 1 | 2 | 3, context: GreetingDecision["context"]) {
  const name = context.customerName ?? "there";
  if (level === 3 && context.upcomingAppointment) {
    return `Welcome back ${name} — I see you have an appointment coming up. How can I help you today?`;
  }
  if (level === 2 && context.lastSummary) {
    return `Welcome back ${name} — last time we discussed ${sanitize(context.lastSummary.intent).toLowerCase()}. How can I help you today?`;
  }
  return `Welcome back ${name}. How can I help you today?`;
}

function highConfidenceSummary(memory: CustomerMemoryContext) {
  return memory.recentSummaries.find((summary) => summary.confidenceScore >= 0.75) ?? null;
}

function isStale(date: Date | null, recencyWindowDays: number) {
  if (!date) return true;
  return Date.now() - date.getTime() > recencyWindowDays * 24 * 60 * 60 * 1000;
}

function meetsThreshold(
  actual: CustomerMemoryContext["recognitionConfidence"],
  required: GreetingConfidenceThreshold,
) {
  const rank = { LOW: 0, MEDIUM: 1, HIGH: 2 };
  return rank[actual] >= rank[required];
}

function normalizeSettings(settings: GreetingSettings): GreetingSettings {
  return {
    enabled: settings.enabled,
    recencyWindowDays: Math.min(Math.max(settings.recencyWindowDays || 90, 1), 365),
    confidenceThreshold: settings.confidenceThreshold,
  };
}

function sanitize(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
}

function safeName(value?: string | null) {
  const name = sanitize(value);
  if (!name || /^\+?\d[\d\s().-]+$/.test(name) || name.includes("@")) return null;
  return name.split(" ").slice(0, 2).join(" ");
}
