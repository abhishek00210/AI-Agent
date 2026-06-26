import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  EmbeddingProvider,
  GenerateEmbeddingsInput,
  GenerateEmbeddingsResult,
} from "./embedding.provider";

interface OpenAIEmbeddingResponse {
  data: Array<{
    index: number;
    embedding: number[];
  }>;
  model: string;
}

@Injectable()
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly config: ConfigService) {}

  async generate(input: GenerateEmbeddingsInput): Promise<GenerateEmbeddingsResult> {
    const apiKey = this.config.get<string>("openai.apiKey");

    if (!apiKey) {
      throw new ServiceUnavailableException("OpenAI API key is not configured.");
    }

    const model = this.config.get<string>("openai.embeddingModel") ?? "text-embedding-3-small";
    const dimensions = this.config.get<number>("openai.embeddingDimensions") ?? 1536;
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: input.signal,
      body: JSON.stringify({
        model,
        input: input.texts,
        dimensions,
        encoding_format: "float",
        user: input.user,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message =
        typeof body?.error?.message === "string"
          ? body.error.message
          : `OpenAI embeddings request failed with status ${response.status}.`;
      throw new ServiceUnavailableException(message);
    }

    const body = (await response.json()) as OpenAIEmbeddingResponse;
    const ordered = [...body.data].sort((a, b) => a.index - b.index);
    const vectors = ordered.map((item) => item.embedding);

    return {
      model: body.model || model,
      dimensions: vectors[0]?.length ?? dimensions,
      vectors,
    };
  }
}
