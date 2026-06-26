import { NotFoundException } from "@nestjs/common";
import { CallService } from "./call.service";

const context = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("CallService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists calls with tenant-scoped filters", async () => {
    const deps = createDependencies();
    deps.calls.list.mockResolvedValue({ total: 1, data: [callFixture()] });
    const service = new CallService(
      deps.calls as never,
      deps.search as never,
      deps.analytics as never,
    );

    const result = await service.list(context, {
      page: 2,
      limit: 10,
      search: "CA123",
      status: "ROUTING" as never,
      agentId: "agent-1",
      phoneNumberId: "phone-1",
    });

    expect(deps.calls.list).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        page: 2,
        limit: 10,
        search: "CA123",
        status: "ROUTING",
        agentId: "agent-1",
        phoneNumberId: "phone-1",
      }),
    );
    expect(result.data[0].twilioCallSid).toBe("CA123");
  });

  it("blocks cross-tenant call details", async () => {
    const deps = createDependencies();
    deps.calls.findById.mockResolvedValue(null);
    const service = new CallService(
      deps.calls as never,
      deps.search as never,
      deps.analytics as never,
    );

    await expect(service.getById(context, "call-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

function createDependencies() {
  return {
    calls: {
      list: jest.fn(),
      findById: jest.fn(),
      stats: jest.fn(),
    },
    search: {
      toRepositoryOptions: jest.fn((_organizationId, query) => ({
        organizationId: "org-1",
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        search: query.search,
        status: query.status,
        agentId: query.agentId,
        phoneNumberId: query.phoneNumberId,
      })),
    },
    analytics: {
      stats: jest.fn(),
    },
  };
}

function callFixture() {
  const now = new Date("2026-06-09T10:00:00.000Z");
  return {
    id: "call-1",
    organizationId: "org-1",
    agentId: "agent-1",
    phoneNumberId: "phone-1",
    twilioCallSid: "CA123",
    callerNumber: "+14155551234",
    calledNumber: "+15551234567",
    direction: "INBOUND",
    status: "ROUTING",
    startedAt: now,
    endedAt: null,
    durationSeconds: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    agent: { id: "agent-1", name: "Reception", status: "ACTIVE" },
    phoneNumber: { id: "phone-1", phoneNumber: "+15551234567", friendlyName: "Main" },
  };
}
