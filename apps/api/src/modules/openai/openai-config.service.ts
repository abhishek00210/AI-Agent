import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class OpenAiConfigService {
  constructor(private readonly config: ConfigService) {}

  apiKey(): string {
    const apiKey = this.config.get<string>("openai.apiKey");
    if (!apiKey) {
      throw new ServiceUnavailableException("OpenAI API key is not configured.");
    }
    return apiKey;
  }

  responseModel(): string {
    return this.config.get<string>("openai.model") ?? "gpt-5.2";
  }

  timeoutMs(): number {
    return this.config.get<number>("openai.timeoutMs") ?? 30000;
  }

  transcriptionModel(): string {
    return (
      this.config.get<string>("openai.transcriptionModel") ?? "gpt-4o-transcribe-diarize"
    );
  }

  embeddingModel(): string {
    return this.config.get<string>("openai.embeddingModel") ?? "text-embedding-3-small";
  }

  embeddingDimensions(): number {
    return this.config.get<number>("openai.embeddingDimensions") ?? 1536;
  }
}
