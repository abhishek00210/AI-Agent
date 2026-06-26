import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface ResponsesApiResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{ text?: string }>;
  }>;
}

@Injectable()
export class AnswerGenerationService {
  constructor(private readonly config: ConfigService) {}

  async generate(input: {
    question: string;
    context: string;
    agentSystemPrompt: string;
  }): Promise<string> {
    if (!input.context.trim()) {
      return "I could not find relevant knowledge for that question in the connected knowledge base.";
    }

    const apiKey = this.config.get<string>("openai.apiKey");
    if (!apiKey) {
      throw new ServiceUnavailableException("OpenAI API key is not configured.");
    }

    const model = this.config.get<string>("openai.ragModel") ?? "gpt-5.2";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: [
          input.agentSystemPrompt,
          "Answer using the retrieved knowledge first.",
          "If the retrieved knowledge does not contain the answer, say the information is unavailable.",
          "Do not fabricate details. Keep the answer concise and useful.",
        ].join("\n\n"),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Retrieved knowledge:\n${input.context}\n\nUser question:\n${input.question}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message =
        typeof body?.error?.message === "string"
          ? body.error.message
          : `OpenAI response generation failed with status ${response.status}.`;
      throw new ServiceUnavailableException(message);
    }

    const body = (await response.json()) as ResponsesApiResponse;
    return body.output_text ?? extractOutputText(body) ?? "No answer was generated.";
  }
}

function extractOutputText(body: ResponsesApiResponse): string | null {
  const text = body.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n")
    .trim();
  return text || null;
}
