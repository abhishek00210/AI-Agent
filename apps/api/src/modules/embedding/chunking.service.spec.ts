import { ChunkingService, estimateTokenCount } from "./chunking.service";

describe("ChunkingService", () => {
  it("cleans duplicate lines and chunks content with overlap", () => {
    const service = new ChunkingService();
    const content = [
      "Navigation",
      "Navigation",
      "This is the first paragraph with useful content for a customer support knowledge base.",
      "This is the second paragraph with enough detail to require multiple chunks.",
    ].join("\n");

    const chunks = service.chunk(content, { chunkSize: 80, chunkOverlap: 20 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.chunkIndex).toBe(0);
    expect(chunks[0]?.chunkText.match(/Navigation/g)).toHaveLength(1);
    expect(chunks.every((chunk) => chunk.tokenCount > 0)).toBe(true);
  });

  it("returns no chunks for empty text", () => {
    const service = new ChunkingService();
    expect(service.chunk("   \n\t ")).toEqual([]);
  });

  it("estimates token counts from words", () => {
    expect(estimateTokenCount("one two three four")).toBe(6);
  });
});
