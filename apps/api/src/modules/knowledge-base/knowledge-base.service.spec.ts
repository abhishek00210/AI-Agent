import { BadRequestException, NotFoundException } from "@nestjs/common";
import { KnowledgeBaseService } from "./knowledge-base.service";
import { KnowledgeBaseStatusDto } from "./dto/knowledge-base.dto";
import type { KnowledgeBaseRepository } from "./repositories/knowledge-base.repository";
import type { TenantContext } from "../tenant/tenant.service";

const context: TenantContext = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER",
};

const now = new Date("2026-06-08T00:00:00.000Z");

const knowledgeBase = {
  id: "kb-1",
  organizationId: "org-1",
  agentId: "agent-1",
  name: "Reception Knowledge",
  description: "Reference material",
  status: "DRAFT" as const,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  agent: { id: "agent-1", name: "Reception Agent" },
  _count: { documents: 2 },
};

function createRepositoryMock(): jest.Mocked<KnowledgeBaseRepository> {
  return {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    agentExists: jest.fn(),
    createAuditEvent: jest.fn(),
  } as unknown as jest.Mocked<KnowledgeBaseRepository>;
}

describe("KnowledgeBaseService", () => {
  it("creates a tenant-scoped knowledge base and validates assigned agent ownership", async () => {
    const repository = createRepositoryMock();
    repository.agentExists.mockResolvedValue({ id: "agent-1" });
    repository.create.mockResolvedValue(knowledgeBase);
    repository.createAuditEvent.mockResolvedValue({} as never);
    const service = new KnowledgeBaseService(repository);

    const result = await service.create(context, {
      name: " Reception Knowledge ",
      description: " Reference material ",
      agentId: "agent-1",
      status: KnowledgeBaseStatusDto.DRAFT,
    });

    expect(repository.agentExists).toHaveBeenCalledWith("org-1", "agent-1");
    expect(repository.create).toHaveBeenCalledWith({
      organizationId: "org-1",
      agentId: "agent-1",
      name: "Reception Knowledge",
      description: "Reference material",
      status: "DRAFT",
    });
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        actorUserId: "user-1",
        action: "knowledge_base.created",
        entityType: "KnowledgeBase",
        entityId: "kb-1",
      }),
    );
    expect(result.documentsCount).toBe(2);
  });

  it("rejects assignment to an agent outside the current organization", async () => {
    const repository = createRepositoryMock();
    repository.agentExists.mockResolvedValue(null);
    const service = new KnowledgeBaseService(repository);

    await expect(
      service.create(context, {
        name: "Reception Knowledge",
        agentId: "other-agent",
        status: KnowledgeBaseStatusDto.DRAFT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lists knowledge bases with pagination and tenant filters", async () => {
    const repository = createRepositoryMock();
    repository.list.mockResolvedValue({ total: 1, data: [knowledgeBase] });
    const service = new KnowledgeBaseService(repository);

    const result = await service.list(context, {
      page: 2,
      limit: 5,
      search: " reception ",
      status: KnowledgeBaseStatusDto.DRAFT,
    });

    expect(repository.list).toHaveBeenCalledWith({
      organizationId: "org-1",
      page: 2,
      limit: 5,
      search: "reception",
      status: "DRAFT",
    });
    expect(result).toMatchObject({ total: 1, page: 2, limit: 5 });
  });

  it("throws not found for cross-tenant knowledge base access", async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(null);
    const service = new KnowledgeBaseService(repository);

    await expect(service.getById(context, "other-kb")).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findById).toHaveBeenCalledWith("org-1", "other-kb");
  });

  it("updates a knowledge base and audits the change", async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValueOnce(knowledgeBase).mockResolvedValueOnce({
      ...knowledgeBase,
      name: "Updated Knowledge",
      status: "ACTIVE",
      agentId: null,
      agent: null,
    });
    repository.update.mockResolvedValue({ count: 1 });
    repository.createAuditEvent.mockResolvedValue({} as never);
    const service = new KnowledgeBaseService(repository);

    const result = await service.update(context, "kb-1", {
      name: " Updated Knowledge ",
      agentId: null,
      status: KnowledgeBaseStatusDto.ACTIVE,
    });

    expect(repository.update).toHaveBeenCalledWith("org-1", "kb-1", {
      name: "Updated Knowledge",
      agentId: null,
      status: "ACTIVE",
    });
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "knowledge_base.updated", entityId: "kb-1" }),
    );
    expect(result.assignedAgent).toBeNull();
  });

  it("soft deletes a knowledge base and audits it", async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(knowledgeBase);
    repository.softDelete.mockResolvedValue({ count: 1 });
    repository.createAuditEvent.mockResolvedValue({} as never);
    const service = new KnowledgeBaseService(repository);

    await expect(service.delete(context, "kb-1")).resolves.toEqual({ success: true });

    expect(repository.softDelete).toHaveBeenCalledWith("org-1", "kb-1");
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "knowledge_base.deleted", entityId: "kb-1" }),
    );
  });
});
