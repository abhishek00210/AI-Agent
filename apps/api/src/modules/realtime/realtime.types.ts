export type RealtimeVoice = "alloy" | "echo" | "shimmer" | "verse" | "cedar" | "coral";

export interface RealtimeAgentContext {
  organizationId: string;
  callId: string;
  callSessionId: string;
  callerNumber?: string;
  callDirection?: "INBOUND" | "OUTBOUND";
  outboundReasonType?: string | null;
  outboundReasonDescription?: string | null;
  agentId: string;
  agentName: string;
  agentUpdatedAt?: string;
  systemPrompt: string;
  language: string;
  voice: RealtimeVoice;
  knowledgeBaseIds: string[];
  knowledgeBaseUpdatedAt?: string[];
}

export interface RealtimeConnection {
  realtimeSessionId: string;
  streamSid: string;
  callSid: string;
  conversationId: string;
  context: RealtimeAgentContext;
  sendToTwilio: (event: Record<string, unknown>) => boolean;
  closeTwilio: () => void;
  ready: boolean;
  startupAudio: string[];
  inputAudioOriginAt?: number;
  startupKnowledgeWarm?: boolean;
  startupStartedAt?: number;
  coldStart?: boolean;
  lastInputAudioAt?: number;
  inputGapTimer?: NodeJS.Timeout;
}

export interface OpenAiRealtimeEvent {
  type: string;
  session?: { id?: string };
  delta?: string;
  transcript?: string;
  item?: {
    id?: string;
    type?: string;
    role?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
  };
  call_id?: string;
  name?: string;
  arguments?: string;
  response?: {
    id?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
  };
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
  audio_start_ms?: number;
  audio_end_ms?: number;
}
