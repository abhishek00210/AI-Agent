import { Injectable } from "@nestjs/common";

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

export interface TextChunk {
  chunkIndex: number;
  chunkText: string;
  tokenCount: number;
}

@Injectable()
export class ChunkingService {
  chunk(content: string, options: { chunkSize?: number; chunkOverlap?: number } = {}): TextChunk[] {
    const cleaned = this.clean(content);
    if (!cleaned) {
      return [];
    }

    const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const chunkOverlap = Math.min(options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP, chunkSize - 1);
    const chunks: TextChunk[] = [];
    let start = 0;

    while (start < cleaned.length) {
      const end = Math.min(start + chunkSize, cleaned.length);
      const chunkText = this.trimToSentenceBoundary(cleaned.slice(start, end));

      if (chunkText) {
        chunks.push({
          chunkIndex: chunks.length,
          chunkText,
          tokenCount: estimateTokenCount(chunkText),
        });
      }

      if (end >= cleaned.length) {
        break;
      }

      start = Math.max(end - chunkOverlap, start + 1);
    }

    return chunks;
  }

  clean(content: string): string {
    const lines = content
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const deduped: string[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      const key = line.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      deduped.push(line);
    }

    return deduped
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private trimToSentenceBoundary(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length < DEFAULT_CHUNK_SIZE * 0.7) {
      return trimmed;
    }

    const boundary = Math.max(
      trimmed.lastIndexOf(". "),
      trimmed.lastIndexOf("! "),
      trimmed.lastIndexOf("? "),
      trimmed.lastIndexOf("\n"),
    );

    if (boundary < DEFAULT_CHUNK_SIZE * 0.5) {
      return trimmed;
    }

    return trimmed.slice(0, boundary + 1).trim();
  }
}

export function estimateTokenCount(content: string): number {
  const words = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words * 1.3));
}
