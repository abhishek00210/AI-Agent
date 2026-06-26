import { Injectable } from "@nestjs/common";
import type { RagRetrievedChunk } from "./retrieval.service";

@Injectable()
export class SourceCitationService {
  build(chunks: RagRetrievedChunk[]) {
    return chunks.map((chunk) => ({
      sourceId: chunk.sourceId,
      sourceType: chunk.sourceType,
      sourceName: chunk.sourceName,
      relevanceScore: chunk.relevanceScore,
      chunkReference: chunk.chunkIndex + 1,
      knowledgeBaseId: chunk.knowledgeBaseId,
      documentId: chunk.sourceType === "document" ? chunk.sourceId : null,
      websiteSourceId: chunk.sourceType === "website" ? chunk.sourceId : null,
      faqEntryId: chunk.sourceType === "faq" ? chunk.sourceId : null,
    }));
  }
}
