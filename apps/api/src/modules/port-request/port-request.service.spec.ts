import { ConflictException, NotFoundException } from "@nestjs/common";
import { PortRequestService } from "./port-request.service";

const context = {
  organizationId: "org-1",
  userId: "user-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("PortRequestService", () => {
  const prisma = {
    phoneNumber: { findUnique: jest.fn() },
    portRequest: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    portRequestHistory: { create: jest.fn() },
    auditEvent: { create: jest.fn() },
    emailQueue: { create: jest.fn() },
    agent: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const encryption = {
    encrypt: jest.fn((value: string) => `encrypted:${value}`),
    decrypt: jest.fn(),
  };
  const storage = { upload: jest.fn(), delete: jest.fn(), createDownloadUrl: jest.fn() };
  const provider = { listNumbers: jest.fn(), assignNumber: jest.fn() };
  const telephony = { resolve: jest.fn(() => provider) };
  const usage = { increment: jest.fn() };
  const service = new PortRequestService(
    prisma as never,
    encryption as never,
    storage as never,
    telephony as never,
    { submit: jest.fn() } as never,
    {
      voiceUrl: jest.fn(() => "https://api/voice"),
      smsUrl: jest.fn(() => "https://api/sms"),
    } as never,
    usage as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.phoneNumber.findUnique.mockResolvedValue(null);
    prisma.portRequest.findUnique.mockResolvedValue(null);
    prisma.agent.findFirst.mockResolvedValue({ id: "agent-1" });
  });

  it("creates tenant-scoped requests with encrypted carrier fields", async () => {
    const record = { id: "port-1", organizationId: "org-1", countryCode: "CA" };
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) => {
      prisma.portRequest.create.mockResolvedValue(record);
      return callback(prisma);
    });
    prisma.portRequest.findFirst.mockResolvedValue(portFixture());

    const result = await service.create(context, input());

    expect(encryption.encrypt).toHaveBeenCalledWith("ACC-123");
    expect(result.organizationId).toBe("org-1");
    expect(usage.increment).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: "PORT_REQUESTS" }),
    );
  });

  it("prevents a second active request for the same tenant and number", async () => {
    prisma.portRequest.findUnique.mockResolvedValue({ status: "PROCESSING" });
    await expect(service.create(context, input())).rejects.toBeInstanceOf(ConflictException);
  });

  it("does not expose another tenant's request", async () => {
    prisma.portRequest.findFirst.mockResolvedValue(null);
    await expect(service.get(context, "port-2")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.portRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "port-2", organizationId: "org-1" } }),
    );
  });

  it("refuses completion until the number exists in Twilio inventory", async () => {
    prisma.portRequest.findUnique.mockResolvedValue(portFixture());
    provider.listNumbers.mockResolvedValue([]);
    await expect(
      service.adminUpdate("port-1", { status: "COMPLETED" }, "admin-1"),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

function input() {
  return {
    phoneNumber: "+14165550100",
    countryCode: "CA",
    currentCarrier: "Bell",
    accountNumber: "ACC-123",
    accountPin: "1234",
    businessName: "Example Inc",
    businessAddress: { line1: "1 Main St", city: "Toronto", region: "ON", postalCode: "M1M1M1" },
    authorizedContactName: "Owner",
    authorizedContactEmail: "owner@example.com",
    authorizedContactPhone: "+14165550101",
    assignedAgentId: "agent-1",
  };
}

function portFixture() {
  return {
    id: "port-1",
    organizationId: "org-1",
    phoneNumber: "+14165550100",
    countryCode: "CA",
    currentCarrier: "Bell",
    encryptedAccountNumber: "encrypted",
    encryptedAccountPin: "encrypted",
    businessName: "Example Inc",
    businessAddress: {},
    authorizedContactName: "Owner",
    authorizedContactEmail: "owner@example.com",
    authorizedContactPhone: "+14165550101",
    loaDocumentId: "doc-1",
    status: "SUBMITTED",
    statusMessage: null,
    twilioPortRequestId: null,
    estimatedPortDate: null,
    submittedAt: new Date(),
    completedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    assignedAgentId: "agent-1",
    activatedAt: null,
    phoneNumberId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignedAgent: { id: "agent-1", name: "Agent", status: "ACTIVE" },
    loaDocument: {
      id: "doc-1",
      originalFileName: "loa.pdf",
      fileType: "application/pdf",
      fileSize: 10,
      storagePath: "path",
      createdAt: new Date(),
    },
    phoneRecord: null,
    history: [],
    organization: { id: "org-1", name: "Example" },
  };
}
