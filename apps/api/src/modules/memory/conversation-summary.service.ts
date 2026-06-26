import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { Message } from "./memory.types";
import { OpenAiProvider } from "../openai/openai.provider";

@Injectable()
export class ConversationSummaryService {
  constructor(private readonly provider: OpenAiProvider) {}

  async summarize(input: { messages: Message[]; userId?: string }) {
    const transcript = toTranscript(input.messages);
    if (!transcript) {
      return "No meaningful conversation context has been captured yet.";
    }

    try {
      const response = await this.provider.generateResponse({
        instructions: [
          "You create concise long-term conversation memory for an AI voice agent SaaS platform.",
          "Summarize only durable, useful context. Ignore greetings, filler, and duplicate turns.",
          "Include key topics, decisions, user details, business details, preferences, appointments, and outstanding requests.",
          "Do not invent details. Keep the summary under 180 words.",
        ].join("\n"),
        messages: [{ role: "user", content: `Conversation transcript:\n${transcript}` }],
        user: input.userId,
      });
      return response.content.trim();
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException("Memory summary generation failed. Please try again.");
    }
  }
}

export function toTranscript(messages: Message[]): string {
  return messages
    .filter((message) => message.content.trim())
    .map((message) => {
      const timestamp = message.createdAt.toISOString();
      return `[${timestamp}] ${message.senderType}: ${message.content.trim()}`;
    })
    .join("\n");
}
