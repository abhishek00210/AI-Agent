import { OpenAIEmbeddingProvider } from "./openai-embedding.provider";

describe("OpenAIEmbeddingProvider cancellation", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("passes AbortSignal to the OpenAI embedding request", async () => {
    const controller = new AbortController();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "text-embedding-3-small",
        data: [{ index: 0, embedding: [0.1, 0.2] }],
      }),
    });
    global.fetch = fetchMock as never;
    const provider = new OpenAIEmbeddingProvider({
      get: jest.fn((key: string) => {
        if (key === "openai.apiKey") return "test-key";
        if (key === "openai.embeddingDimensions") return 2;
        return undefined;
      }),
    } as never);

    await provider.generate({ texts: ["hello"], signal: controller.signal });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
