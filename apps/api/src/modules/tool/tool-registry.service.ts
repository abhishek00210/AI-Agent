import { Injectable, OnModuleInit } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { BuiltInToolsFactory } from "./builtins/built-in-tools";
import { ToolExecutionRepository } from "./repositories/tool-execution.repository";
import type { AiToolDefinition, ToolDefinition } from "./tool.types";

@Injectable()
export class ToolRegistryService implements OnModuleInit {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly realtimeTools = new Map<string, AiToolDefinition>();

  constructor(
    private readonly builtIns: BuiltInToolsFactory,
    private readonly repository: ToolExecutionRepository,
  ) {}

  async onModuleInit() {
    for (const tool of this.builtIns.tools()) {
      this.tools.set(tool.name, tool);
    }
  }

  get(name: string) {
    return this.tools.get(name) ?? null;
  }

  all() {
    return [...this.tools.values()];
  }

  registerRealtimeTools(definitions: AiToolDefinition[]): AiToolDefinition[] {
    for (const definition of definitions) {
      this.realtimeTools.set(definition.name, definition);
    }
    return definitions.map((definition) => this.realtimeTools.get(definition.name)!);
  }

  async ensureCatalog(organizationId: string) {
    await Promise.all(
      this.all().map((tool) =>
        this.repository.upsertCatalog({
          organizationId,
          name: tool.name,
          displayName: tool.displayName,
          description: tool.description,
          schema: tool.jsonSchema as unknown as Prisma.InputJsonValue,
        }),
      ),
    );
  }

  async availableForModel(organizationId: string): Promise<AiToolDefinition[]> {
    await this.ensureCatalog(organizationId);
    const enabled = new Set(
      (await this.repository.listTools(organizationId))
        .filter((tool) => tool.enabled)
        .map((tool) => tool.name),
    );
    return this.all()
      .filter((tool) => enabled.has(tool.name))
      .map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.jsonSchema,
      }));
  }
}
