import { RealtimeGateway } from "./realtime.gateway";

describe("RealtimeGateway reliability", () => {
  const config = {
    get: jest.fn((key: string): string | number | undefined =>
      key === "openai.realtimeTranscriptionModel" ? "gpt-4o-mini-transcribe" : undefined,
    ),
  };
  const agentContext = {
    load: jest.fn(),
    memoryInstructions: jest.fn().mockResolvedValue(""),
    memoryBundle: jest
      .fn()
      .mockResolvedValue({
        instructions: "",
        customerMemory: null,
        greetingInstructions: null,
        greetingDecision: null,
      }),
    recordMemoryPromptInjection: jest.fn().mockResolvedValue(undefined),
  };
  const connections = {
    connect: jest.fn().mockResolvedValue({ cold: false }),
    send: jest.fn(),
    sendAudio: jest.fn().mockReturnValue(true),
    close: jest.fn(),
  };
  const sessions = {
    create: jest.fn(),
    failed: jest.fn(),
    disconnected: jest.fn(),
    recordAudioSent: jest.fn(),
  };
  const audioBridge = {
    forwardTwilioAudio: jest.fn(),
  };
  const events = {
    process: jest.fn(),
    clear: jest.fn(),
  };
  const provider = {
    endCall: jest.fn().mockResolvedValue(undefined),
  };
  const telephony = { resolve: jest.fn(() => provider) };
  const toolRegistry = {
    availableForModel: jest.fn().mockResolvedValue([]),
    registerRealtimeTools: jest.fn((tools: unknown[]) => tools),
  };
  const knowledge = {
    startupContext: jest.fn().mockResolvedValue({ text: "", warm: true }),
    toolFor: jest.fn().mockReturnValue([]),
  };
  const metrics = {
    now: jest.fn(() => performance.now()),
    observe: jest.fn(),
    increment: jest.fn(),
  };
  const gateway = new RealtimeGateway(
    config as never,
    agentContext as never,
    connections as never,
    sessions as never,
    audioBridge as never,
    events as never,
    telephony as never,
    toolRegistry as never,
    knowledge as never,
    metrics as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    connections.connect.mockResolvedValue({ cold: false });
    connections.sendAudio.mockReturnValue(true);
    agentContext.memoryInstructions.mockResolvedValue("");
    agentContext.memoryBundle.mockResolvedValue({
      instructions: "",
      customerMemory: null,
      greetingInstructions: null,
      greetingDecision: null,
    });
    toolRegistry.availableForModel.mockResolvedValue([]);
    toolRegistry.registerRealtimeTools.mockImplementation((tools: unknown[]) => tools);
    knowledge.startupContext.mockResolvedValue({ text: "", warm: true });
    knowledge.toolFor.mockReturnValue([]);
  });

  it("keeps 50 concurrent calls isolated by stream", async () => {
    agentContext.load.mockImplementation(async (streamSid: string) => contextFor(streamSid));
    sessions.create.mockImplementation(async (context: ReturnType<typeof contextFor>) => ({
      session: { id: `realtime-${context.callSessionId}` },
      conversationId: `conversation-${context.callSessionId}`,
      tenant: { organizationId: context.organizationId },
    }));

    const starts = Array.from({ length: 50 }, (_, index) => {
      const streamSid = `MZ${index}`;
      return gateway.start({
        streamSid,
        callSid: `CA${index}`,
        sendToTwilio: jest.fn().mockReturnValue(true),
        closeTwilio: jest.fn(),
      });
    });
    await Promise.all(starts);

    expect(connections.connect).toHaveBeenCalledTimes(50);
    for (let index = 0; index < 50; index += 1) {
      expect(gateway.has(`MZ${index}`)).toBe(true);
      gateway.media(`MZ${index}`, `audio-${index}`);
      expect(audioBridge.forwardTwilioAudio).toHaveBeenCalledWith({
        streamSid: `MZ${index}`,
        realtimeSessionId: `realtime-call-session-MZ${index}`,
        payload: `audio-${index}`,
      });
    }

    await Promise.all(Array.from({ length: 50 }, (_, index) => gateway.stop(`MZ${index}`)));
  });

  it("delivers a graceful fallback and cleans up once after OpenAI failure", async () => {
    agentContext.load.mockResolvedValue(contextFor("MZFAIL"));
    sessions.create.mockResolvedValue({
      session: { id: "realtime-fail" },
      conversationId: "conversation-fail",
      tenant: { organizationId: "org-MZFAIL" },
    });
    let failConnection: ((reason: string) => Promise<void>) | undefined;
    connections.connect.mockImplementation(
      async (
        _streamSid: string,
        _onEvent: unknown,
        _onClose: unknown,
        onFailure: (reason: string) => Promise<void>,
      ) => {
        failConnection = onFailure;
      },
    );
    const closeTwilio = jest.fn();

    await gateway.start({
      streamSid: "MZFAIL",
      callSid: "CAFAIL",
      sendToTwilio: jest.fn().mockReturnValue(true),
      closeTwilio,
    });
    await failConnection?.("OpenAI disconnected");
    await failConnection?.("duplicate failure");

    expect(provider.endCall).toHaveBeenCalledWith("CAFAIL", {
      message: "We're experiencing technical difficulties. Please try again later.",
    });
    expect(sessions.failed).toHaveBeenCalledTimes(1);
    expect(sessions.failed).toHaveBeenCalledWith(
      "realtime-fail",
      expect.objectContaining({ organizationId: "org-MZFAIL" }),
      "conversation-fail",
      "OpenAI disconnected",
    );
    expect(closeTwilio).toHaveBeenCalledTimes(1);
    expect(gateway.has("MZFAIL")).toBe(false);
  });

  it("configures OpenAI Realtime with PCMU for Twilio media streams", async () => {
    agentContext.load.mockResolvedValue(contextFor("MZFORMAT"));
    sessions.create.mockResolvedValue({
      session: { id: "realtime-format" },
      conversationId: "conversation-format",
      tenant: { organizationId: "org-MZFORMAT" },
    });

    await gateway.start({
      streamSid: "MZFORMAT",
      callSid: "CAFORMAT",
      sendToTwilio: jest.fn().mockReturnValue(true),
      closeTwilio: jest.fn(),
    });

    expect(connections.send).toHaveBeenCalledWith(
      "MZFORMAT",
      expect.objectContaining({
        type: "session.update",
        session: expect.objectContaining({
          audio: expect.objectContaining({
            input: expect.objectContaining({
              format: { type: "audio/pcmu" },
              turn_detection: expect.objectContaining({
                type: "semantic_vad",
                eagerness: "high",
                create_response: true,
              }),
            }),
            output: expect.objectContaining({
              format: { type: "audio/pcmu" },
            }),
          }),
        }),
      }),
    );
    expect(connections.send).toHaveBeenCalledWith(
      "MZFORMAT",
      expect.objectContaining({
        type: "response.create",
        response: expect.objectContaining({
          output_modalities: ["audio"],
          instructions: expect.stringContaining("Greet the caller briefly"),
        }),
      }),
    );
    expect(connections.send).toHaveBeenCalledWith(
      "MZFORMAT",
      expect.objectContaining({
        type: "response.create",
        response: expect.objectContaining({
          instructions: expect.stringContaining("English only"),
        }),
      }),
    );
  });

  it("skips the proactive startup greeting when caller audio is already buffered", async () => {
    agentContext.load.mockResolvedValue(contextFor("MZEARLY"));
    sessions.create.mockResolvedValue({
      session: { id: "realtime-early" },
      conversationId: "conversation-early",
      tenant: { organizationId: "org-MZEARLY" },
    });
    let resolveMemory: (value: Awaited<ReturnType<typeof agentContext.memoryBundle>>) => void;
    agentContext.memoryBundle.mockReturnValue(
      new Promise((resolve) => {
        resolveMemory = resolve;
      }) as ReturnType<typeof agentContext.memoryBundle>,
    );

    const start = gateway.start({
      streamSid: "MZEARLY",
      callSid: "CAEARLY",
      sendToTwilio: jest.fn().mockReturnValue(true),
      closeTwilio: jest.fn(),
    });
    for (let index = 0; index < 5 && !gateway.has("MZEARLY"); index += 1) {
      await Promise.resolve();
    }

    gateway.media("MZEARLY", "early-caller-audio");
    resolveMemory!({
      instructions: "",
      customerMemory: null,
      greetingInstructions: null,
      greetingDecision: null,
    });
    await start;

    expect(audioBridge.forwardTwilioAudio).toHaveBeenCalledWith({
      streamSid: "MZEARLY",
      realtimeSessionId: "realtime-early",
      payload: "early-caller-audio",
    });
    expect(connections.send).not.toHaveBeenCalledWith(
      "MZEARLY",
      expect.objectContaining({ type: "response.create" }),
    );
    expect(metrics.increment).toHaveBeenCalledWith("startup_greeting_skipped_for_caller_audio");
  });

  it("supports a bounded server VAD production override", async () => {
    config.get.mockImplementation((key: string) => {
      if (key === "openai.realtimeVadMode") return "server_vad";
      if (key === "openai.realtimeVadThreshold") return 0.5;
      if (key === "openai.realtimeVadSilenceDurationMs") return 400;
      if (key === "openai.realtimeVadPrefixPaddingMs") return 300;
      if (key === "openai.realtimeTranscriptionModel") return "gpt-4o-mini-transcribe";
      return undefined;
    });
    agentContext.load.mockResolvedValue(contextFor("MZSERVER"));
    sessions.create.mockResolvedValue({
      session: { id: "realtime-server-vad" },
      conversationId: "conversation-server-vad",
      tenant: { organizationId: "org-MZSERVER" },
    });

    await gateway.start({
      streamSid: "MZSERVER",
      callSid: "CASERVER",
      sendToTwilio: jest.fn().mockReturnValue(true),
      closeTwilio: jest.fn(),
    });

    expect(connections.send).toHaveBeenCalledWith(
      "MZSERVER",
      expect.objectContaining({
        type: "session.update",
        session: expect.objectContaining({
          audio: expect.objectContaining({
            input: expect.objectContaining({
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 400,
                create_response: true,
                interrupt_response: true,
              },
            }),
          }),
        }),
      }),
    );
  });

  it("fills a Twilio input gap with bounded PCMU silence for OpenAI VAD", async () => {
    jest.useFakeTimers();
    config.get.mockImplementation((key: string) => {
      if (key === "openai.realtimeInputGapFillMs") return 500;
      if (key === "openai.realtimeInputGapSilenceMs") return 600;
      if (key === "openai.realtimeTranscriptionModel") return "gpt-4o-mini-transcribe";
      return undefined;
    });
    agentContext.load.mockResolvedValue(contextFor("MZGAP"));
    sessions.create.mockResolvedValue({
      session: { id: "realtime-gap" },
      conversationId: "conversation-gap",
      tenant: { organizationId: "org-MZGAP" },
    });
    await gateway.start({
      streamSid: "MZGAP",
      callSid: "CAGAP",
      sendToTwilio: jest.fn().mockReturnValue(true),
      closeTwilio: jest.fn(),
    });

    gateway.media("MZGAP", Buffer.alloc(160, 0xff).toString("base64"));
    await jest.advanceTimersByTimeAsync(501);

    expect(connections.sendAudio).toHaveBeenCalledWith(
      "MZGAP",
      Buffer.alloc(4_800, 0xff).toString("base64"),
    );
    expect(sessions.recordAudioSent).toHaveBeenCalledWith("realtime-gap");
    expect(metrics.increment).toHaveBeenCalledWith("input_gap_silence_fills");
    await gateway.stop("MZGAP");
    jest.useRealTimers();
  });
});

function contextFor(streamSid: string) {
  return {
    organizationId: `org-${streamSid}`,
    callId: `call-${streamSid}`,
    callSessionId: `call-session-${streamSid}`,
    agentId: `agent-${streamSid}`,
    agentName: "Reception",
    systemPrompt: "Be helpful.",
    language: "en-US",
    voice: "alloy" as const,
    knowledgeBaseIds: [],
  };
}
