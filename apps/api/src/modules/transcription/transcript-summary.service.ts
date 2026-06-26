import { Injectable, Logger } from "@nestjs/common";
import { OpenAiProvider } from "../openai/openai.provider";

const SUMMARY_INPUT_LIMIT = 40_000;

@Injectable()
export class TranscriptSummaryService {
  private readonly logger = new Logger(TranscriptSummaryService.name);

  constructor(private readonly ai: OpenAiProvider) {}

  async generate(fullText: string, organizationId: string): Promise<string | undefined> {
    if (!fullText.trim()) return undefined;
    try {
      const result = await this.ai.generateResponse({
        instructions:
          "Summarize this call faithfully. Include call purpose, customer questions, agent responses, important decisions, and outstanding tasks. Do not invent facts. Use concise headings and bullets.",
        messages: [{ role: "user", content: fullText.slice(0, SUMMARY_INPUT_LIMIT) }],
        user: organizationId,
      });
      return result.content;
    } catch (error) {
      this.logger.warn(
        `Transcript summary generation failed without failing transcription: ${readError(error)}`,
      );
      return undefined;
    }
  }
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
