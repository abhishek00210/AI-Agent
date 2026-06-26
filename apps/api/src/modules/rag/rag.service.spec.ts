import { BadRequestException } from "@nestjs/common";
import { RagService } from "./rag.service";

const context = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("RagService", () => {
  it("asks an agent with tenant-scoped knowledge bases and records analytics", async () => {
    const dependencies = createDependencies();
    dependencies.retrieval.assertAgent.mockResolvedValue({
      id: "agent-1",
      systemPrompt: "Answer like a receptionist.",
      knowledgeBases: [{ id: "kb-1", name: "Support" }],
    });
    dependencies.retrieval.search.mockResolvedValue([retrievedChunk]);
    dependencies.contextBuilder.build.mockReturnValue("context");
    dependencies.answerGeneration.generate.mockResolvedValue("Answer from knowledge.");

    const service = createService(dependencies);

    const result = await service.ask(context, {
      agentId: "agent-1",
      question: "What are your hours?",
    });

    expect(dependencies.retrieval.search).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", knowledgeBaseIds: ["kb-1"] }),
    );
    expect(result.answer).toBe("Answer from knowledge.");
    expect(result.sources).toHaveLength(1);
    expect(dependencies.repository.createSearchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        agentId: "agent-1",
        knowledgeBaseId: "kb-1",
        usedFaqChunks: 1,
      }),
    );
  });

  it("rejects agent questions before knowledge bases are assigned", async () => {
    const dependencies = createDependencies();
    dependencies.retrieval.assertAgent.mockResolvedValue({
      id: "agent-1",
      systemPrompt: "Prompt",
      knowledgeBases: [],
    });
    const service = createService(dependencies);

    await expect(
      service.ask(context, { agentId: "agent-1", question: "Question?" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

const retrievedChunk = {
  chunkId: "chunk-1",
  knowledgeBaseId: "kb-1",
  knowledgeBaseName: "Support",
  sourceId: "faq-1",
  sourceType: "faq" as const,
  sourceName: "Hours",
  chunkIndex: 0,
  chunkText: "Question: hours\nAnswer: 9 to 5",
  tokenCount: 8,
  relevanceScore: 0.91,
};

function createDependencies() {
  return {
    repository: {
      analytics: jest.fn(),
      createSearchEvent: jest.fn().mockResolvedValue({}),
      createAuditEvent: jest.fn().mockResolvedValue({}),
    },
    retrieval: {
      assertAgent: jest.fn(),
      assertKnowledgeBase: jest.fn(),
      search: jest.fn(),
    },
    contextBuilder: { build: jest.fn() },
    answerGeneration: { generate: jest.fn() },
    citations: {
      build: jest.fn().mockReturnValue([
        {
          sourceId: "faq-1",
          sourceType: "faq",
          sourceName: "Hours",
          relevanceScore: 0.91,
          chunkReference: 1,
          knowledgeBaseId: "kb-1",
        },
      ]),
    },
  };
}

function createService(dependencies: ReturnType<typeof createDependencies>) {
  return new RagService(
    dependencies.repository as unknown as ConstructorParameters<typeof RagService>[0],
    dependencies.retrieval as unknown as ConstructorParameters<typeof RagService>[1],
    dependencies.contextBuilder as unknown as ConstructorParameters<typeof RagService>[2],
    dependencies.answerGeneration as unknown as ConstructorParameters<typeof RagService>[3],
    dependencies.citations as unknown as ConstructorParameters<typeof RagService>[4],
  );
}
