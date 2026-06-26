import { RealtimeEventProcessor } from "./realtime-event-processor";

describe("RealtimeEventProcessor", () => {
  const config = {
    get: jest.fn().mockReturnValue("gpt-realtime"),
  };
  const connections = {
    send: jest.fn(),
    close: jest.fn(),
  };
  const audioBridge = {
    forwardOpenAiAudio: jest.fn(),
  };
  const sessions = {
    connected: jest.fn(),
    failed: jest.fn(),
    recordLatency: jest.fn(),
  };
  const conversations = {
    storeUserTranscript: jest.fn(),
    storeAssistantTranscript: jest.fn(),
  };
  const knowledge = {
    search: jest.fn(),
  };
  const persistence = {
    enqueue: jest.fn((task: () => Promise<unknown>) => {
      void task();
      return true;
    }),
  };
  const metrics = {
    now: jest.fn(() => performance.now()),
    observe: jest.fn(),
    observeValue: jest.fn(),
    increment: jest.fn(),
  };
  const toolExecutor = {
    execute: jest.fn(),
  };
  const processor = new RealtimeEventProcessor(
    config as never,
    connections as never,
    audioBridge as never,
    sessions as never,
    conversations as never,
    knowledge as never,
    persistence as never,
    metrics as never,
    toolExecutor as never,
  );
  const connection = {
    realtimeSessionId: "realtime-1",
    streamSid: "MZ123",
    callSid: "CA123",
    conversationId: "conversation-1",
    context: {
      organizationId: "org-1",
      callId: "call-1",
      callSessionId: "call-session-1",
      agentId: "agent-1",
      agentName: "Reception",
      systemPrompt: "Be helpful.",
      language: "en-US",
      voice: "alloy" as const,
      knowledgeBaseIds: ["kb-1"],
    },
    sendToTwilio: jest.fn().mockReturnValue(true),
    closeTwilio: jest.fn(),
    ready: true,
    startupAudio: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    metrics.now.mockImplementation(() => performance.now());
    config.get.mockImplementation((key: string) =>
      key === "openai.realtimeModel" ? "gpt-realtime" : undefined,
    );
    processor.clear(connection.streamSid);
  });

  it("stores caller transcripts without gating normal realtime responses on RAG", async () => {
    await processor.process(connection, {
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "When are you open?",
    });

    expect(knowledge.search).not.toHaveBeenCalled();
    expect(connections.send).not.toHaveBeenCalledWith(
      "MZ123",
      expect.objectContaining({ type: "response.create" }),
    );
    expect(conversations.storeUserTranscript).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1" }),
      "conversation-1",
      "When are you open?",
      expect.objectContaining({ source: "realtime_voice" }),
    );
  });

  it("runs search_knowledge as a tenant-scoped realtime tool and continues the response", async () => {
    knowledge.search.mockResolvedValue({
      success: true,
      message: "Knowledge search completed.",
      chunks: [
        {
          chunkId: "chunk-1",
          sourceId: "document-1",
          sourceType: "document",
          sourceName: "Hours.pdf",
          relevanceScore: 0.91,
          knowledgeBaseId: "kb-1",
          text: "Office hours are 9 to 5.",
        },
      ],
    });

    await processor.process(connection, {
      type: "response.output_item.done",
      item: {
        type: "function_call",
        call_id: "call-1",
        name: "search_knowledge",
        arguments: JSON.stringify({ query: "When are you open?" }),
      },
    });

    expect(knowledge.search).toHaveBeenCalledWith(connection.context, {
      query: "When are you open?",
    });
    expect(connections.send).toHaveBeenCalledWith(
      "MZ123",
      expect.objectContaining({
        type: "conversation.item.create",
        item: expect.objectContaining({
          type: "function_call_output",
          call_id: "call-1",
        }),
      }),
    );
    expect(connections.send).toHaveBeenCalledWith("MZ123", {
      type: "response.create",
      response: { output_modalities: ["audio"] },
    });
  });

  it("executes a duplicate realtime tool call exactly once", async () => {
    knowledge.search.mockResolvedValue({ success: true, chunks: [] });
    const event = {
      type: "response.function_call_arguments.done",
      call_id: "duplicate-call",
      name: "search_knowledge",
      arguments: JSON.stringify({ query: "hours" }),
    };

    await processor.process(connection, event);
    await processor.process(connection, event);

    expect(knowledge.search).toHaveBeenCalledTimes(1);
  });

  it("executes voice tools with a system actor that cannot violate the user audit relation", async () => {
    toolExecutor.execute.mockResolvedValue({
      execution: { id: "execution-1" },
      result: { success: true, message: "Appointment booked." },
    });

    await processor.process(connection, {
      type: "response.function_call_arguments.done",
      call_id: "booking-call",
      name: "book_appointment",
      arguments: JSON.stringify({
        customerName: "Customer",
        phone: "+14155550100",
        email: "customer@example.com",
        preferredDate: "2026-07-01",
        preferredTime: "14:00",
        timezone: "America/Toronto",
      }),
    });

    expect(toolExecutor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          tenant: expect.objectContaining({ userId: "public-voice-call" }),
        }),
      }),
    );
  });

  it("answers immediately even when no knowledge base exists", async () => {
    const noKnowledgeConnection = {
      ...connection,
      context: { ...connection.context, knowledgeBaseIds: [] },
    };
    await processor.process(noKnowledgeConnection, {
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "Hello",
    });

    expect(knowledge.search).not.toHaveBeenCalled();
    expect(noKnowledgeConnection.context.knowledgeBaseIds).toEqual([]);
  });

  it("clears buffered Twilio audio when the caller interrupts", async () => {
    await processor.process(connection, { type: "input_audio_buffer.speech_started" });

    expect(connection.sendToTwilio).toHaveBeenCalledWith({
      event: "clear",
      streamSid: "MZ123",
    });
  });

  it("measures endpointing from OpenAI's audio endpoint, not speech duration", async () => {
    metrics.now.mockReturnValue(500);
    await processor.process(
      { ...connection, inputAudioOriginAt: 100 },
      { type: "input_audio_buffer.speech_stopped", audio_end_ms: 350 },
    );

    expect(metrics.observeValue).toHaveBeenCalledWith("endpointing_delay_ms", 50);
  });

  it("cancels and truncates unplayed assistant audio during barge-in", async () => {
    await processor.process(connection, {
      type: "response.output_item.added",
      item: { id: "item-1", role: "assistant" },
    });
    await processor.process(connection, {
      type: "response.output_audio.delta",
      delta: Buffer.alloc(800).toString("base64"),
    });
    await processor.process(connection, { type: "input_audio_buffer.speech_started" });

    expect(connections.send).toHaveBeenCalledWith("MZ123", {
      type: "response.cancel",
    });
    expect(connections.send).toHaveBeenCalledWith(
      "MZ123",
      expect.objectContaining({
        type: "conversation.item.truncate",
        item_id: "item-1",
        content_index: 0,
        audio_end_ms: expect.any(Number),
      }),
    );
  });

  it("cancels an active response before first audio and answers after caller stops", async () => {
    await processor.process(connection, { type: "response.created" });
    await processor.process(connection, { type: "input_audio_buffer.speech_started" });

    expect(connections.send).toHaveBeenCalledWith("MZ123", { type: "response.cancel" });
    await processor.process(connection, { type: "input_audio_buffer.speech_stopped" });
    await processor.process(connection, { type: "response.done" });

    expect(connections.send).toHaveBeenCalledWith("MZ123", {
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        instructions: expect.stringContaining("caller spoke while the greeting was starting"),
      },
    });
  });

  it("does not issue duplicate cancellation for repeated speech_started events", async () => {
    await processor.process(connection, { type: "response.created" });
    await processor.process(connection, { type: "input_audio_buffer.speech_started" });
    await processor.process(connection, { type: "input_audio_buffer.speech_started" });

    expect(connections.send).toHaveBeenCalledTimes(1);
    expect(connections.send).toHaveBeenCalledWith("MZ123", { type: "response.cancel" });
  });

  it("does not issue duplicate replacement responses for repeated speech_started before audio", async () => {
    await processor.process(connection, { type: "response.created" });
    await processor.process(connection, { type: "input_audio_buffer.speech_started" });
    await processor.process(connection, { type: "input_audio_buffer.speech_started" });
    await processor.process(connection, { type: "input_audio_buffer.speech_stopped" });
    await processor.process(connection, { type: "response.done" });

    expect(
      connections.send.mock.calls.filter(([, event]) => event.type === "response.create"),
    ).toHaveLength(1);
  });

  it("does not terminate event processing if sockets close during interruption", async () => {
    await processor.process(connection, { type: "response.created" });
    connections.send.mockImplementationOnce(() => {
      throw new Error("socket closed");
    });
    connection.sendToTwilio.mockImplementationOnce(() => {
      throw new Error("socket closed");
    });

    await expect(
      processor.process(connection, { type: "input_audio_buffer.speech_started" }),
    ).resolves.toBeUndefined();
  });

  it("ignores cancellation errors when no OpenAI response is active", async () => {
    await expect(
      processor.process(connection, {
        type: "error",
        error: {
          message: "Cancellation failed: no active response found",
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("does not cancel a response after completed playback", async () => {
    await processor.process(connection, {
      type: "response.output_item.added",
      item: { id: "item-1", role: "assistant" },
    });
    await processor.process(connection, {
      type: "response.output_audio.delta",
      delta: Buffer.alloc(800).toString("base64"),
    });
    await processor.process(connection, { type: "response.done" });
    connections.send.mockClear();

    await processor.process(connection, { type: "input_audio_buffer.speech_started" });

    expect(connections.send).not.toHaveBeenCalledWith("MZ123", {
      type: "response.cancel",
    });
  });

  it("defers a tool continuation until the active response is finished", async () => {
    knowledge.search.mockResolvedValue({
      success: true,
      message: "No matching knowledge found.",
      chunks: [],
    });
    await processor.process(connection, { type: "response.created" });

    await processor.process(connection, {
      type: "response.output_item.done",
      item: {
        type: "function_call",
        call_id: "tool-call-pending",
        name: "search_knowledge",
        arguments: JSON.stringify({ query: "Can you help me?" }),
      },
    });

    expect(connections.send).not.toHaveBeenCalledWith(
      "MZ123",
      expect.objectContaining({ type: "response.create" }),
    );

    await processor.process(connection, { type: "response.done" });

    expect(connections.send).toHaveBeenCalledWith("MZ123", {
      type: "response.create",
      response: { output_modalities: ["audio"] },
    });
  });

  it("keeps a tool continuation serialized when the caller interrupts during execution", async () => {
    let finishSearch: ((value: { success: boolean; chunks: never[] }) => void) | undefined;
    knowledge.search.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSearch = resolve;
        }),
    );
    await processor.process(connection, { type: "response.created" });
    const toolProcessing = processor.process(connection, {
      type: "response.function_call_arguments.done",
      call_id: "slow-tool-call",
      name: "search_knowledge",
      arguments: JSON.stringify({ query: "policy" }),
    });

    await processor.process(connection, { type: "input_audio_buffer.speech_started" });
    finishSearch?.({ success: true, chunks: [] });
    await toolProcessing;
    await processor.process(connection, { type: "response.done" });

    expect(connections.send).toHaveBeenCalledWith("MZ123", { type: "response.cancel" });
    expect(
      connections.send.mock.calls.filter(([, event]) => event.type === "response.create"),
    ).toHaveLength(1);
  });

  it("does not terminate the call when OpenAI reports an active response race", async () => {
    await expect(
      processor.process(connection, {
        type: "error",
        error: {
          message:
            "Conversation already has an active response in progress. Wait until the response is finished before creating a new one.",
        },
      }),
    ).resolves.toBeUndefined();
  });
});
