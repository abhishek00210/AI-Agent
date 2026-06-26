import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RagRetrievedChunk } from "./retrieval.service";

@Injectable()
export class ContextBuilderService {
  constructor(private readonly config: ConfigService) {}

  build(chunks: RagRetrievedChunk[]): string {
    const maxLength = this.config.get<number>("rag.maxContextLength") ?? 6000;
    let context = "";

    for (const chunk of chunks) {
      const next = [
        `[Source: ${chunk.sourceName} | Type: ${chunk.sourceType} | Score: ${chunk.relevanceScore.toFixed(3)}]`,
        chunk.chunkText,
      ].join("\n");

      if ((context + "\n\n" + next).length > maxLength) {
        break;
      }

      context = context ? `${context}\n\n${next}` : next;
    }

    return context;
  }
}
