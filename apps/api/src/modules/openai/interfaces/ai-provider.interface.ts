export interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AiToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface AiToolCall {
  id?: string;
  callId: string;
  name: string;
  arguments: unknown;
}

export interface AiToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  executionId?: string;
}

export interface GenerateResponseInput {
  instructions: string;
  messages: AiMessage[];
  user?: string;
  tools?: AiToolDefinition[];
  executeTool?: (toolCall: AiToolCall) => Promise<AiToolResult>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerateResponseResult {
  content: string;
  model: string;
  tokenUsage: TokenUsage;
  raw: unknown;
  toolCalls?: Array<{
    callId: string;
    name: string;
    executionId?: string;
    success: boolean;
  }>;
}

export interface TranscriptionSegment {
  speaker: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
}

export interface TranscribeAudioResult {
  text: string;
  model: string;
  language?: string;
  durationSeconds?: number;
  segments: TranscriptionSegment[];
}

export interface AiProvider {
  generateResponse(input: GenerateResponseInput): Promise<GenerateResponseResult>;
  generateEmbedding(input: { texts: string[]; user?: string }): Promise<{
    model: string;
    dimensions: number;
    vectors: number[][];
  }>;
  transcribeAudio(input: {
    filePath: string;
    fileName: string;
    language?: string;
  }): Promise<TranscribeAudioResult>;
}
