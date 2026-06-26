import { SourceCitationService } from "./source-citation.service";
import type { RagRetrievedChunk } from "./retrieval.service";

describe("SourceCitationService", () => {
  it("includes explicit source IDs for document, website, and FAQ citations", () => {
    const service = new SourceCitationService();

    const citations = service.build([
      chunkFixture({ sourceId: "document-1", sourceType: "document", sourceName: "Menu PDF" }),
      chunkFixture({ sourceId: "website-1", sourceType: "website", sourceName: "Pricing Page" }),
      chunkFixture({ sourceId: "faq-1", sourceType: "faq", sourceName: "Hours FAQ" }),
    ]);

    expect(citations).toEqual([
      expect.objectContaining({
        sourceId: "document-1",
        documentId: "document-1",
        websiteSourceId: null,
        faqEntryId: null,
      }),
      expect.objectContaining({
        sourceId: "website-1",
        documentId: null,
        websiteSourceId: "website-1",
        faqEntryId: null,
      }),
      expect.objectContaining({
        sourceId: "faq-1",
        documentId: null,
        websiteSourceId: null,
        faqEntryId: "faq-1",
      }),
    ]);
  });
});

function chunkFixture(
  overrides: Pick<RagRetrievedChunk, "sourceId" | "sourceType" | "sourceName">,
): RagRetrievedChunk {
  return {
    chunkId: `chunk-${overrides.sourceId}`,
    knowledgeBaseId: "kb-1",
    knowledgeBaseName: "Main KB",
    sourceId: overrides.sourceId,
    sourceType: overrides.sourceType,
    sourceName: overrides.sourceName,
    chunkIndex: 0,
    chunkText: "A useful chunk.",
    tokenCount: 4,
    relevanceScore: 0.9,
  };
}
