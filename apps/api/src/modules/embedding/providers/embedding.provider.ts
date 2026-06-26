export interface GenerateEmbeddingsInput {
  texts: string[];
  user?: string;
  signal?: AbortSignal;
}

export interface GenerateEmbeddingsResult {
  model: string;
  dimensions: number;
  vectors: number[][];
}

export interface EmbeddingProvider {
  generate(input: GenerateEmbeddingsInput): Promise<GenerateEmbeddingsResult>;
}
