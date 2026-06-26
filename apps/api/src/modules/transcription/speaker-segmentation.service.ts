import { Injectable } from "@nestjs/common";
import type { SenderType, SpeakerType } from "../../../generated/prisma";
import type { TranscriptionSegment } from "../openai/interfaces/ai-provider.interface";
import type { StructuredTranscriptSegment } from "./transcription.types";

interface ConversationMessage {
  senderType: SenderType;
  content: string;
  createdAt: Date;
  metadata: unknown;
}

@Injectable()
export class SpeakerSegmentationService {
  structure(input: {
    transcriptionSegments: TranscriptionSegment[];
    conversationMessages: ConversationMessage[];
    callStartedAt: Date;
  }): StructuredTranscriptSegment[] {
    if (input.conversationMessages.length > 0) {
      return input.conversationMessages.map((message, sequence) => {
        const startMs = Math.max(0, message.createdAt.getTime() - input.callStartedAt.getTime());
        return {
          speaker: message.senderType,
          startMs,
          endMs: startMs + estimateSpeechDurationMs(message.content),
          text: message.content,
          confidence: readMessageConfidence(message.metadata),
          sequence,
        };
      });
    }

    return input.transcriptionSegments.map((segment, sequence) => ({
      speaker: mapSpeaker(segment.speaker),
      startMs: segment.startMs,
      endMs: Math.max(segment.startMs, segment.endMs),
      text: segment.text,
      confidence: segment.confidence,
      sequence,
    }));
  }
}

function mapSpeaker(value: string): SpeakerType {
  const normalized = value.trim().toUpperCase();
  if (["USER", "CALLER", "CUSTOMER"].includes(normalized)) return "USER";
  if (["ASSISTANT", "AGENT", "AI"].includes(normalized)) return "ASSISTANT";
  if (normalized === "SYSTEM") return "SYSTEM";
  return "UNKNOWN";
}

function estimateSpeechDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(500, Math.round((words / 150) * 60_000));
}

function readMessageConfidence(metadata: unknown): number | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const confidence = (metadata as Record<string, unknown>).confidence;
  return typeof confidence === "number" && confidence >= 0 && confidence <= 1
    ? confidence
    : undefined;
}
