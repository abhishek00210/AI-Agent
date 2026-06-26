import { NotFoundException } from "@nestjs/common";
import { AgentService } from "./agent.service";
import { AgentStatusDto } from "./dto/agent.dto";
import type { AgentRepository } from "./repositories/agent.repository";
import type { TenantContext } from "../tenant/tenant.service";

const context: TenantContext = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER",
};

const now = new Date("2026-06-08T00:00:00.000Z");

const agent = {
  id: "agent-1",
  organizationId: "org-1",
  name: "Reception Agent",
  description: "Answers calls",
  language: "en-US",
  voice: "alloy",
  systemPrompt: "You are a professional receptionist for our company.",
  status: "DRAFT" as const,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

function createRepositoryMock(): jest.Mocked<AgentRepository> {
  return {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    createAuditEvent: jest.fn(),
  } as unknown as jest.Mocked<AgentRepository>;
}

describe("AgentService", () => {
  it("creates an agent in the current organization and audits it", async () => {
    const repository = createRepositoryMock();
    repository.create.mockResolvedValue(agent);
    repository.createAuditEvent.mockResolvedValue({} as never);
    const gates = { assertAvailable: jest.fn().mockResolvedValue(undefined) };
    const service = new AgentService(repository, gates as never);

    const result = await service.create(context, {
      name: " Reception Agent ",
      description: " Answers calls ",
      language: "en-US",
      voice: "alloy",
      systemPrompt: " You are a professional receptionist for our company. ",
      status: AgentStatusDto.DRAFT,
    });

    expect(repository.create).toHaveBeenCalledWith({
      organizationId: "org-1",
      name: "Reception Agent",
      description: "Answers calls",
      language: "en-US",
      voice: "alloy",
      systemPrompt: "You are a professional receptionist for our company.",
      status: "DRAFT",
    });
    expect(gates.assertAvailable).toHaveBeenCalledWith("org-1", "agents");
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        actorUserId: "user-1",
        action: "agent.created",
        entityType: "Agent",
        entityId: "agent-1",
      }),
    );
    expect(result.organizationId).toBe("org-1");
  });

  it("lists agents with pagination, search, and status scoped to tenant", async () => {
    const repository = createRepositoryMock();
    repository.list.mockResolvedValue({ total: 1, data: [agent] });
    const service = new AgentService(repository);

    const result = await service.list(context, {
      page: 2,
      limit: 5,
      search: " reception ",
      status: AgentStatusDto.DRAFT,
    });

    expect(repository.list).toHaveBeenCalledWith({
      organizationId: "org-1",
      page: 2,
      limit: 5,
      search: "reception",
      status: "DRAFT",
    });
    expect(result).toMatchObject({ total: 1, page: 2, limit: 5 });
    expect(result.data).toHaveLength(1);
  });

  it("throws when an agent is outside the current organization scope", async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(null);
    const service = new AgentService(repository);

    await expect(service.getById(context, "other-agent")).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findById).toHaveBeenCalledWith("org-1", "other-agent");
  });

  it("updates an agent after tenant-scoped lookup and audits the change", async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValueOnce(agent).mockResolvedValueOnce({
      ...agent,
      name: "Updated Agent",
      status: "ACTIVE",
    });
    repository.update.mockResolvedValue({ count: 1 });
    repository.createAuditEvent.mockResolvedValue({} as never);
    const service = new AgentService(repository);

    const result = await service.update(context, "agent-1", {
      name: " Updated Agent ",
      status: AgentStatusDto.ACTIVE,
    });

    expect(repository.update).toHaveBeenCalledWith("org-1", "agent-1", {
      name: "Updated Agent",
      status: "ACTIVE",
    });
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "agent.updated", entityId: "agent-1" }),
    );
    expect(result.name).toBe("Updated Agent");
  });

  it("soft deletes an agent and writes an audit event", async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(agent);
    repository.softDelete.mockResolvedValue({ count: 1 });
    repository.createAuditEvent.mockResolvedValue({} as never);
    const service = new AgentService(repository);

    await expect(service.delete(context, "agent-1")).resolves.toEqual({ success: true });

    expect(repository.softDelete).toHaveBeenCalledWith("org-1", "agent-1");
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "agent.deleted", entityId: "agent-1" }),
    );
  });

  it("duplicates an agent as a draft copy in the current organization", async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(agent);
    repository.create.mockResolvedValue({
      ...agent,
      id: "agent-copy",
      name: "Copy of Reception Agent",
    });
    repository.createAuditEvent.mockResolvedValue({} as never);
    const service = new AgentService(repository);

    const result = await service.duplicate(context, "agent-1");

    expect(repository.create).toHaveBeenCalledWith({
      organizationId: "org-1",
      name: "Copy of Reception Agent",
      description: "Answers calls",
      language: "en-US",
      voice: "alloy",
      systemPrompt: "You are a professional receptionist for our company.",
      status: "DRAFT",
    });
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "agent.duplicated", entityId: "agent-copy" }),
    );
    expect(result.name).toBe("Copy of Reception Agent");
  });
});
