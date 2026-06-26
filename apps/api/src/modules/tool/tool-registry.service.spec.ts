import { ToolRegistryService } from "./tool-registry.service";

describe("ToolRegistryService realtime registration", () => {
  it("registers and returns model-only realtime tools", () => {
    const registry = new ToolRegistryService(
      { tools: jest.fn().mockReturnValue([]) } as never,
      {} as never,
    );
    const tool = {
      type: "function" as const,
      name: "search_knowledge",
      description: "Search tenant knowledge.",
      parameters: {
        type: "object" as const,
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
    };

    expect(registry.registerRealtimeTools([tool])).toEqual([tool]);
    expect(registry.registerRealtimeTools([tool])).toEqual([tool]);
  });
});
