import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { MemoryFactType } from "../../../generated/prisma";
import { OpenAiProvider } from "../openai/openai.provider";
import type { ExtractedMemoryFact, Message } from "./memory.types";
import { toTranscript } from "./conversation-summary.service";

const FACT_TYPES = new Set<MemoryFactType>([
  "USER_INFO",
  "BUSINESS_INFO",
  "APPOINTMENT",
  "CONTACT",
  "PREFERENCE",
  "CUSTOM",
]);

@Injectable()
export class MemoryFactService {
  constructor(private readonly provider: OpenAiProvider) {}

  async extract(input: { messages: Message[]; userId?: string }): Promise<ExtractedMemoryFact[]> {
    const transcript = toTranscript(input.messages);
    if (!transcript) {
      return [];
    }

    try {
      const response = await this.provider.generateResponse({
        instructions: [
          "Extract durable structured memory facts from the conversation transcript.",
          "Return only valid JSON with this shape:",
          '{"facts":[{"factType":"USER_INFO|BUSINESS_INFO|APPOINTMENT|CONTACT|PREFERENCE|CUSTOM","factKey":"short_key","factValue":"fact value","confidence":0.0}]}',
          "Use confidence from 0 to 1. Do not include uncertain facts below 0.5 confidence.",
          'Do not invent facts. If no facts exist, return {"facts":[]}.',
        ].join("\n"),
        messages: [{ role: "user", content: `Conversation transcript:\n${transcript}` }],
        user: input.userId,
      });
      return normalizeFacts(parseFacts(response.content));
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException("Memory fact extraction failed. Please try again.");
    }
  }
}

function parseFacts(content: string): unknown[] {
  const json = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
  const parsed = JSON.parse(json) as { facts?: unknown };
  return Array.isArray(parsed.facts) ? parsed.facts : [];
}

function normalizeFacts(facts: unknown[]): ExtractedMemoryFact[] {
  return facts
    .map((fact) => {
      if (!isFactObject(fact)) {
        return null;
      }
      const factType = FACT_TYPES.has(fact.factType as MemoryFactType)
        ? (fact.factType as MemoryFactType)
        : "CUSTOM";
      const factKey = normalizeKey(fact.factKey);
      const factValue = fact.factValue.trim();
      const confidence = clamp(Number(fact.confidence ?? 0.7), 0, 1);

      if (!factKey || !factValue || confidence < 0.5) {
        return null;
      }

      return { factType, factKey, factValue, confidence };
    })
    .filter((fact): fact is ExtractedMemoryFact => Boolean(fact));
}

function isFactObject(value: unknown): value is {
  factType?: string;
  factKey: string;
  factValue: string;
  confidence?: number;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "factKey" in value &&
    "factValue" in value &&
    typeof (value as { factKey?: unknown }).factKey === "string" &&
    typeof (value as { factValue?: unknown }).factValue === "string"
  );
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0.7;
  }
  return Math.min(max, Math.max(min, value));
}
