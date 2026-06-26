import { ServiceUnavailableException } from "@nestjs/common";
import { OpenAiProvider } from "./openai.provider";
import type { OpenAiConfigService } from "./openai-config.service";

describe("OpenAiProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("maps OpenAI rate limits to a user-friendly service error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
    }) as unknown as typeof fetch;
    const provider = new OpenAiProvider(createConfig() as OpenAiConfigService);

    await expect(provider.generateResponse(generateInput())).rejects.toThrow(
      new ServiceUnavailableException(
        "AI service is temporarily rate limited. Please try again shortly.",
      ),
    );
  });

  it("maps invalid credentials to a user-friendly service error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as unknown as typeof fetch;
    const provider = new OpenAiProvider(createConfig() as OpenAiConfigService);

    await expect(provider.generateResponse(generateInput())).rejects.toThrow(
      new ServiceUnavailableException("AI service credentials are not configured correctly."),
    );
  });

  it("maps server failures to a user-friendly service error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;
    const provider = new OpenAiProvider(createConfig() as OpenAiConfigService);

    await expect(provider.generateResponse(generateInput())).rejects.toThrow(
      new ServiceUnavailableException("AI service is temporarily unavailable. Please try again."),
    );
  });

  it("maps request timeouts to a user-friendly service error", async () => {
    const abortError = Object.assign(new Error("Request aborted"), { name: "AbortError" });
    global.fetch = jest.fn().mockRejectedValue(abortError) as unknown as typeof fetch;
    const provider = new OpenAiProvider(createConfig() as OpenAiConfigService);

    await expect(provider.generateResponse(generateInput())).rejects.toThrow(
      new ServiceUnavailableException("AI service timed out. Please try again."),
    );
  });

  it("executes OpenAI function calls and submits function_call_output", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "response-1",
          model: "gpt-5.2",
          output: [
            {
              id: "item-1",
              type: "function_call",
              call_id: "call-1",
              name: "create_lead",
              arguments: JSON.stringify({ name: "Ada", email: "ada@example.com" }),
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "response-2",
          model: "gpt-5.2",
          output_text: "I created the lead.",
          usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        }),
      }) as unknown as typeof fetch;
    const provider = new OpenAiProvider(createConfig() as OpenAiConfigService);
    const executeTool = jest.fn().mockResolvedValue({
      success: true,
      message: "Lead created.",
      executionId: "execution-1",
    });

    const result = await provider.generateResponse({
      ...generateInput(),
      tools: [
        {
          type: "function",
          name: "create_lead",
          description: "Create a lead.",
          parameters: {
            type: "object",
            properties: { name: { type: "string" } },
            required: ["name"],
            additionalProperties: false,
          },
        },
      ],
      executeTool,
    });

    expect(executeTool).toHaveBeenCalledWith({
      id: "item-1",
      callId: "call-1",
      name: "create_lead",
      arguments: { name: "Ada", email: "ada@example.com" },
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body).input).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "function_call_output",
          call_id: "call-1",
          output: expect.stringContaining("Lead created."),
        }),
      ]),
    );
    expect(result.content).toBe("I created the lead.");
    expect(result.toolCalls).toEqual([
      { callId: "call-1", name: "create_lead", executionId: "execution-1", success: true },
    ]);
  });
});

function createConfig(): Pick<OpenAiConfigService, "apiKey" | "responseModel" | "timeoutMs"> {
  return {
    apiKey: () => "test-key",
    responseModel: () => "gpt-5.2",
    timeoutMs: () => 30000,
  };
}

function generateInput() {
  return {
    instructions: "Be helpful.",
    messages: [{ role: "user" as const, content: "Hello" }],
    user: "user-1",
  };
}
