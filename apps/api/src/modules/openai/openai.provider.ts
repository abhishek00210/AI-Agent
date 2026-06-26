import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { openAsBlob } from "node:fs";
import type {
  AiToolCall,
  AiToolResult,
  AiProvider,
  GenerateResponseInput,
  GenerateResponseResult,
  TranscribeAudioResult,
} from "./interfaces/ai-provider.interface";
import { OpenAiConfigService } from "./openai-config.service";

interface ResponsesApiResponse {
  id?: string;
  model?: string;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  output?: Array<{
    id?: string;
    type?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    content?: Array<{ text?: string }>;
  }>;
}

interface EmbeddingApiResponse {
  data: Array<{ index: number; embedding: number[] }>;
  model: string;
}

interface TranscriptionApiResponse {
  text?: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    speaker?: string;
    start?: number;
    end?: number;
    text?: string;
    confidence?: number;
  }>;
}

@Injectable()
export class OpenAiProvider implements AiProvider {
  constructor(private readonly openaiConfig: OpenAiConfigService) {}

  async generateResponse(input: GenerateResponseInput): Promise<GenerateResponseResult> {
    const model = this.openaiConfig.responseModel();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.openaiConfig.timeoutMs());
    const baseMessages = input.messages.map((message) => ({
      role: message.role,
      content: [{ type: "input_text", text: message.content }],
    }));
    const executedTools: GenerateResponseResult["toolCalls"] = [];
    let responseBody: ResponsesApiResponse | null = null;

    try {
      let responseInput: unknown[] = baseMessages;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        responseBody = await this.createResponse({
          model,
          instructions: input.instructions,
          responseInput,
          user: input.user,
          tools: input.tools,
          signal: controller.signal,
        });

        const toolCalls = extractToolCalls(responseBody);
        if (!toolCalls.length || !input.executeTool) {
          break;
        }

        const outputs = await Promise.all(
          toolCalls.map(async (toolCall) => {
            const result = await input.executeTool!(toolCall);
            executedTools.push({
              callId: toolCall.callId,
              name: toolCall.name,
              executionId: result.executionId,
              success: result.success,
            });
            return toFunctionCallOutput(toolCall, result);
          }),
        );
        responseInput = [...baseMessages, ...toolCallItems(responseBody), ...outputs];
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException(readNetworkError(error));
    } finally {
      clearTimeout(timeout);
    }

    const body = responseBody;
    if (!body) {
      throw new ServiceUnavailableException("AI response generation failed. Please try again.");
    }
    const content = body.output_text ?? extractOutputText(body);
    if (!content) {
      throw new ServiceUnavailableException("AI response was empty. Please try again.");
    }

    return {
      content,
      model: body.model ?? model,
      tokenUsage: {
        promptTokens: body.usage?.input_tokens ?? 0,
        completionTokens: body.usage?.output_tokens ?? 0,
        totalTokens: body.usage?.total_tokens ?? 0,
      },
      raw: { id: body.id },
      toolCalls: executedTools,
    };
  }

  private async createResponse(input: {
    model: string;
    instructions: string;
    responseInput: unknown[];
    user?: string;
    tools?: GenerateResponseInput["tools"];
    signal: AbortSignal;
  }) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.openaiConfig.apiKey()}`,
        "Content-Type": "application/json",
      },
      signal: input.signal,
      body: JSON.stringify({
        model: input.model,
        instructions: input.instructions,
        input: input.responseInput,
        user: input.user,
        ...(input.tools?.length
          ? { tools: input.tools, parallel_tool_calls: true }
          : {}),
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(readOpenAiStatusMessage(response.status));
    }

    return (await response.json()) as ResponsesApiResponse;
  }

  async generateEmbedding(input: { texts: string[]; user?: string }) {
    const model = this.openaiConfig.embeddingModel();
    const dimensions = this.openaiConfig.embeddingDimensions();
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.openaiConfig.apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: input.texts,
        dimensions,
        encoding_format: "float",
        user: input.user,
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(readOpenAiStatusMessage(response.status));
    }

    const body = (await response.json()) as EmbeddingApiResponse;
    const vectors = [...body.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
    return { model: body.model || model, dimensions: vectors[0]?.length ?? dimensions, vectors };
  }

  async transcribeAudio(input: {
    filePath: string;
    fileName: string;
    language?: string;
  }): Promise<TranscribeAudioResult> {
    const model = this.openaiConfig.transcriptionModel();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(this.openaiConfig.timeoutMs(), 120_000));
    const form = new FormData();
    form.set("file", await openAsBlob(input.filePath, { type: "audio/wav" }), input.fileName);
    form.set("model", model);
    form.set("response_format", "diarized_json");
    form.set("chunking_strategy", "auto");
    if (input.language) {
      form.set("language", input.language);
    }

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.openaiConfig.apiKey()}` },
        body: form,
        signal: controller.signal,
      });
    } catch (error) {
      throw new ServiceUnavailableException(readNetworkError(error));
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(readOpenAiStatusMessage(response.status));
    }

    const body = (await response.json()) as TranscriptionApiResponse;
    const segments = (body.segments ?? [])
      .filter((segment) => segment.text?.trim())
      .map((segment) => ({
        speaker: segment.speaker ?? "UNKNOWN",
        startMs: Math.max(0, Math.round((segment.start ?? 0) * 1000)),
        endMs: Math.max(0, Math.round((segment.end ?? segment.start ?? 0) * 1000)),
        text: segment.text!.trim(),
        confidence: segment.confidence,
      }));

    return {
      text: body.text?.trim() || segments.map((segment) => segment.text).join(" "),
      model,
      language: body.language,
      durationSeconds: body.duration ? Math.round(body.duration) : undefined,
      segments,
    };
  }
}

function extractOutputText(body: ResponsesApiResponse): string | null {
  const text = body.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n")
    .trim();
  return text || null;
}

function extractToolCalls(body: ResponsesApiResponse): AiToolCall[] {
  return (body.output ?? [])
    .filter((item) => item.type === "function_call" && item.call_id && item.name)
    .map((item) => ({
      id: item.id,
      callId: item.call_id!,
      name: item.name!,
      arguments: parseToolArguments(item.arguments),
    }));
}

function toolCallItems(body: ResponsesApiResponse) {
  return (body.output ?? []).filter((item) => item.type === "function_call");
}

function toFunctionCallOutput(toolCall: AiToolCall, result: AiToolResult) {
  return {
    type: "function_call_output",
    call_id: toolCall.callId,
    output: JSON.stringify({
      success: result.success,
      message: result.message,
      data: result.data ?? null,
      executionId: result.executionId,
    }),
  };
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

function readOpenAiStatusMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "AI service credentials are not configured correctly.";
  }
  if (status === 429) {
    return "AI service is temporarily rate limited. Please try again shortly.";
  }
  if (status >= 500) {
    return "AI service is temporarily unavailable. Please try again.";
  }
  return "AI response generation failed. Please try again.";
}

function readNetworkError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "AI service timed out. Please try again.";
  }
  return "AI service is unreachable. Please try again.";
}
