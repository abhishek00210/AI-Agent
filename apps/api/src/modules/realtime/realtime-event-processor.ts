import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "../../../generated/prisma";
import { RealtimeAudioBridge } from "./realtime-audio-bridge";
import { RealtimeConnectionManager } from "./realtime-connection-manager";
import { RealtimeConversationService } from "./realtime-conversation.service";
import { RealtimeKnowledgeService } from "./realtime-knowledge.service";
import { RealtimeSessionService, voiceTenant } from "./realtime-session.service";
import type { OpenAiRealtimeEvent, RealtimeConnection } from "./realtime.types";
import { DeferredPersistenceService } from "./deferred-persistence.service";
import { RealtimeMetricsService } from "../../common/metrics/realtime-metrics.service";
import { ToolExecutorService } from "../tool/tool-executor.service";

interface PlaybackState {
  itemId: string;
  audioSentMs: number;
  firstWriteAt?: number;
}

type PendingResponse = { instructions?: string };

@Injectable()
export class RealtimeEventProcessor {
  private readonly logger = new Logger(RealtimeEventProcessor.name);
  private readonly assistantText = new Map<string, string>();
  private readonly sources = new Map<string, Prisma.InputJsonValue>();
  private readonly responseStartedAt = new Map<string, number>();
  private readonly speechStoppedAt = new Map<string, number>();
  private readonly turnStartedAt = new Map<string, number>();
  private readonly playback = new Map<string, PlaybackState>();
  private readonly activeResponses = new Set<string>();
  private readonly cancellingResponses = new Set<string>();
  private readonly respondAfterSpeechStops = new Map<string, PendingResponse>();
  private readonly pendingResponses = new Map<string, PendingResponse>();
  private readonly sentResponses = new Map<string, PendingResponse>();
  private readonly processedToolCalls = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly connections: RealtimeConnectionManager,
    private readonly audioBridge: RealtimeAudioBridge,
    private readonly sessions: RealtimeSessionService,
    private readonly conversations: RealtimeConversationService,
    private readonly knowledge: RealtimeKnowledgeService,
    private readonly persistence: DeferredPersistenceService,
    private readonly metrics: RealtimeMetricsService,
    private readonly toolExecutor: ToolExecutorService,
  ) {}

  async process(connection: RealtimeConnection, event: OpenAiRealtimeEvent) {
    switch (event.type) {
      case "session.created":
        this.persistence.enqueue(() =>
          this.sessions.connected(
            connection.realtimeSessionId,
            connection.context.organizationId,
            event.session?.id,
          ),
        );
        return;
      case "session.updated":
        return;
      case "response.created":
        this.activeResponses.add(connection.streamSid);
        this.sentResponses.delete(connection.streamSid);
        this.responseStartedAt.set(connection.streamSid, this.metrics.now());
        this.observeFrom("response_created_ms", this.speechStoppedAt, connection.streamSid);
        this.observeFrom(
          connection.coldStart ? "response_created_cold_ms" : "response_created_warm_ms",
          this.speechStoppedAt,
          connection.streamSid,
        );
        this.assistantText.set(connection.streamSid, "");
        return;
      case "response.output_item.added":
      case "response.output_item.created":
        if (event.item?.id) {
          this.playback.set(connection.streamSid, {
            itemId: event.item.id,
            audioSentMs: 0,
          });
        }
        return;
      case "conversation.item.input_audio_transcription.completed":
        this.metrics.observeValue("transcription_completed", 0);
        await this.handleCallerTranscript(connection, event.transcript ?? "");
        this.observeFrom("transcript_completion_ms", this.speechStoppedAt, connection.streamSid);
        return;
      case "input_audio_buffer.speech_started":
        await this.handleBargeIn(connection);
        this.turnStartedAt.set(connection.streamSid, this.metrics.now());
        this.metrics.observeValue("speech_started", 0);
        return;
      case "input_audio_buffer.speech_stopped":
        this.speechStoppedAt.set(connection.streamSid, this.metrics.now());
        this.metrics.observeValue("speech_stopped", 0);
        if (connection.inputAudioOriginAt !== undefined && event.audio_end_ms !== undefined) {
          this.metrics.observeValue(
            "endpointing_delay_ms",
            this.metrics.now() - (connection.inputAudioOriginAt + event.audio_end_ms),
          );
        }
        this.requestDeferredTurnResponse(connection);
        return;
      case "response.output_text.delta":
      case "response.output_audio_transcript.delta":
        this.appendAssistantText(connection.streamSid, event.delta ?? "");
        return;
      case "response.output_audio.delta":
      case "response.audio.delta":
        if (event.delta) {
          const playback = this.playback.get(connection.streamSid);
          if (playback) {
            playback.audioSentMs += pcmuDurationMs(event.delta);
          }
          const firstAudioStartedAt = this.metrics.now();
          this.audioBridge.forwardOpenAiAudio({
            streamSid: connection.streamSid,
            realtimeSessionId: connection.realtimeSessionId,
            payload: event.delta,
            sendToTwilio: connection.sendToTwilio,
          });
          if (playback && playback.firstWriteAt === undefined) {
            playback.firstWriteAt = this.metrics.now();
            this.metrics.observe("twilio_first_audio_write_ms", firstAudioStartedAt);
            if (connection.startupStartedAt !== undefined) {
              this.metrics.observe("first_greeting_audio_ms", connection.startupStartedAt);
              connection.startupStartedAt = undefined;
            }
            this.observeFrom("first_audio_delta_ms", this.responseStartedAt, connection.streamSid);
            this.observeFrom("total_first_response_ms", this.speechStoppedAt, connection.streamSid);
            this.observeFrom(
              connection.coldStart
                ? "total_first_response_cold_ms"
                : "total_first_response_warm_ms",
              this.speechStoppedAt,
              connection.streamSid,
            );
          }
        }
        return;
      case "response.function_call_arguments.done":
        await this.handleToolCall(connection, {
          callId: event.call_id,
          name: event.name,
          arguments: event.arguments,
        });
        return;
      case "response.output_item.done":
        if (event.item?.type === "function_call") {
          await this.handleToolCall(connection, {
            callId: event.item.call_id,
            name: event.item.name,
            arguments: event.item.arguments,
          });
        }
        return;
      case "response.completed":
      case "response.done":
        this.activeResponses.delete(connection.streamSid);
        this.cancellingResponses.delete(connection.streamSid);
        this.playback.delete(connection.streamSid);
        await this.persistAssistantResponse(connection, event);
        this.flushPendingResponse(connection);
        return;
      case "error":
        await this.handleError(connection, event);
        return;
      default:
        return;
    }
  }

  clear(streamSid: string) {
    this.assistantText.delete(streamSid);
    this.sources.delete(streamSid);
    this.responseStartedAt.delete(streamSid);
    this.speechStoppedAt.delete(streamSid);
    this.turnStartedAt.delete(streamSid);
    this.playback.delete(streamSid);
    this.activeResponses.delete(streamSid);
    this.cancellingResponses.delete(streamSid);
    this.respondAfterSpeechStops.delete(streamSid);
    this.pendingResponses.delete(streamSid);
    this.sentResponses.delete(streamSid);
    for (const callId of this.processedToolCalls) {
      if (callId.startsWith(`${streamSid}:`)) {
        this.processedToolCalls.delete(callId);
      }
    }
  }

  private async handleCallerTranscript(connection: RealtimeConnection, transcript: string) {
    const query = transcript.trim();
    if (!query) {
      return;
    }

    this.persistence.enqueue(() =>
      this.conversations.storeUserTranscript(
        voiceTenant(connection.context.organizationId),
        connection.conversationId,
        query,
        {
          source: "realtime_voice",
          streamSid: connection.streamSid,
        },
      ),
    );

    this.metrics.increment("realtime_transcripts_persisted");
  }

  private async persistAssistantResponse(
    connection: RealtimeConnection,
    event: OpenAiRealtimeEvent,
  ) {
    const content = this.assistantText.get(connection.streamSid)?.trim();
    if (!content) {
      return;
    }

    const responseTimeMs = this.responseStartedAt.has(connection.streamSid)
      ? this.metrics.now() -
        (this.responseStartedAt.get(connection.streamSid) ?? this.metrics.now())
      : 0;
    const usage = event.response?.usage;
    const responseSources = this.sources.get(connection.streamSid) ?? [];

    this.persistence.enqueue(async () => {
      await this.conversations.storeAssistantTranscript(
        voiceTenant(connection.context.organizationId),
        connection.conversationId,
        content,
        {
          source: "realtime_voice",
          model: this.config.get<string>("openai.realtimeModel") ?? "gpt-realtime-2",
          responseTimeMs,
          promptTokens: usage?.input_tokens ?? 0,
          completionTokens: usage?.output_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
          sources: responseSources,
        },
      );
      await this.sessions.recordLatency(connection.realtimeSessionId, responseTimeMs);
    });

    this.assistantText.delete(connection.streamSid);
    this.sources.delete(connection.streamSid);
    this.responseStartedAt.delete(connection.streamSid);
  }

  private async handleToolCall(
    connection: RealtimeConnection,
    toolCall: { callId?: string; name?: string; arguments?: string },
  ) {
    if (!toolCall.callId || !toolCall.name) {
      return;
    }
    const idempotencyKey = `${connection.streamSid}:${toolCall.callId}`;
    if (this.processedToolCalls.has(idempotencyKey)) {
      return;
    }
    this.processedToolCalls.add(idempotencyKey);

    try {
      if (toolCall.name === "search_knowledge") {
        const result = await this.knowledge.search(
          connection.context,
          parseToolArguments(toolCall.arguments),
        );
        this.connections.send(connection.streamSid, {
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: toolCall.callId,
            output: JSON.stringify(result),
          },
        });
        this.sources.set(
          connection.streamSid,
          result.chunks?.map((chunk) => ({
            chunkId: chunk.chunkId,
            sourceId: chunk.sourceId,
            sourceType: chunk.sourceType,
            sourceName: chunk.sourceName,
            relevanceScore: chunk.relevanceScore,
            knowledgeBaseId: chunk.knowledgeBaseId,
          })) as Prisma.InputJsonValue,
        );
        this.requestResponse(connection, {});
        return;
      }
      const { result, execution } = await this.toolExecutor.execute({
        toolName: toolCall.name!,
        input: parseToolArguments(toolCall.arguments),
        context: {
          tenant: voiceTenant(connection.context.organizationId),
          organizationId: connection.context.organizationId,
          agentId: connection.context.agentId,
          conversationId: connection.conversationId,
          callId: connection.context.callId,
          source: "VOICE",
        },
      });
      this.connections.send(connection.streamSid, {
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: toolCall.callId,
          output: JSON.stringify({
            success: result.success,
            message: result.message,
            data: "data" in result ? (result.data ?? null) : null,
            executionId: execution.id,
          }),
        },
      });
      this.requestResponse(connection, {});
    } catch (error) {
      this.logger.warn(`Realtime tool execution failed: ${readSafeError(error)}`);
      this.connections.send(connection.streamSid, {
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: toolCall.callId,
          output: JSON.stringify({
            success: false,
            message: "The tool is temporarily unavailable. Continue the conversation.",
          }),
        },
      });
      this.requestResponse(connection, {});
    }
  }

  private async handleError(connection: RealtimeConnection, event: OpenAiRealtimeEvent) {
    const reason = event.error?.message ?? "OpenAI Realtime error.";
    if (isActiveResponseConflict(reason)) {
      const requested = this.sentResponses.get(connection.streamSid);
      if (requested) {
        this.pendingResponses.set(connection.streamSid, requested);
      }
      this.sentResponses.delete(connection.streamSid);
      this.activeResponses.add(connection.streamSid);
      this.logger.warn("Deferring response until the active OpenAI response finishes.");
      return;
    }
    if (isBenignCancellationError(reason)) {
      this.logger.warn(`Ignoring stale OpenAI cancellation: ${reason}`);
      this.playback.delete(connection.streamSid);
      this.activeResponses.delete(connection.streamSid);
      this.cancellingResponses.delete(connection.streamSid);
      this.flushPendingResponse(connection);
      return;
    }
    this.logger.error(`OpenAI Realtime failure: ${reason}`);
    throw new Error(reason);
  }

  private appendAssistantText(streamSid: string, delta: string) {
    if (!delta) {
      return;
    }
    this.assistantText.set(streamSid, `${this.assistantText.get(streamSid) ?? ""}${delta}`);
  }

  private requestResponse(connection: RealtimeConnection, response: PendingResponse) {
    if (this.activeResponses.has(connection.streamSid)) {
      this.pendingResponses.set(connection.streamSid, response);
      return;
    }
    this.activeResponses.add(connection.streamSid);
    this.sentResponses.set(connection.streamSid, response);
    try {
      this.connections.send(connection.streamSid, {
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          ...(response.instructions ? { instructions: response.instructions } : {}),
        },
      });
    } catch (error) {
      this.activeResponses.delete(connection.streamSid);
      this.sentResponses.delete(connection.streamSid);
      throw error;
    }
  }

  private flushPendingResponse(connection: RealtimeConnection) {
    const pending = this.pendingResponses.get(connection.streamSid);
    if (!pending || this.activeResponses.has(connection.streamSid)) {
      return;
    }
    this.pendingResponses.delete(connection.streamSid);
    this.requestResponse(connection, pending);
  }

  private async handleBargeIn(connection: RealtimeConnection) {
    const startedAt = this.metrics.now();
    try {
      connection.sendToTwilio({ event: "clear", streamSid: connection.streamSid });
    } catch {
      this.logger.warn("Twilio socket closed while clearing interrupted playback.");
    }
    this.metrics.observe("barge_in_clear_ms", startedAt);

    const playback = this.playback.get(connection.streamSid);
    const hasResponse = this.activeResponses.has(connection.streamSid) || Boolean(playback);
    if (hasResponse && !this.cancellingResponses.has(connection.streamSid)) {
      if (!playback && this.activeResponses.has(connection.streamSid)) {
        this.respondAfterSpeechStops.set(connection.streamSid, {
          instructions:
            "The caller spoke while the greeting was starting. Respond naturally to their latest message now. Keep it brief and helpful.",
        });
      }
      try {
        this.connections.send(connection.streamSid, { type: "response.cancel" });
        this.cancellingResponses.add(connection.streamSid);
      } catch {
        this.logger.warn("OpenAI socket closed while cancelling an interrupted response.");
      }
    }
    if (!playback) {
      return;
    }
    const elapsedMs = playback.firstWriteAt
      ? Math.max(0, this.metrics.now() - playback.firstWriteAt)
      : 0;
    try {
      this.connections.send(connection.streamSid, {
        type: "conversation.item.truncate",
        item_id: playback.itemId,
        content_index: 0,
        audio_end_ms: Math.floor(Math.min(elapsedMs, playback.audioSentMs)),
      });
    } catch {
      this.logger.warn("OpenAI socket closed while truncating interrupted playback.");
    }
    this.playback.delete(connection.streamSid);
  }

  private requestDeferredTurnResponse(connection: RealtimeConnection) {
    const pending = this.respondAfterSpeechStops.get(connection.streamSid);
    if (!pending) {
      return;
    }
    this.respondAfterSpeechStops.delete(connection.streamSid);
    this.requestResponse(connection, pending);
  }

  private observeFrom(
    name: Parameters<RealtimeMetricsService["observe"]>[0],
    source: Map<string, number>,
    streamSid: string,
  ) {
    const startedAt = source.get(streamSid);
    if (startedAt !== undefined) {
      this.metrics.observe(name, startedAt);
    }
  }
}

function pcmuDurationMs(base64Payload: string): number {
  return (Buffer.byteLength(base64Payload, "base64") / 8_000) * 1_000;
}

function readSafeError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function isBenignCancellationError(reason: string): boolean {
  const normalized = reason.toLowerCase();
  return normalized.includes("cancellation failed") && normalized.includes("no active response");
}

function isActiveResponseConflict(reason: string): boolean {
  const normalized = reason.toLowerCase();
  return (
    normalized.includes("active response") &&
    normalized.includes("wait until the response is finished")
  );
}

function parseToolArguments(value: string | undefined): unknown {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
