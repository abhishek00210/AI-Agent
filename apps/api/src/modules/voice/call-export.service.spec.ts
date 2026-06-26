import { CallExportService } from "./call-export.service";
import { CallExportFormatDto } from "./dto/call.dto";

const context = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("CallExportService", () => {
  it("exports tenant-scoped CSV rows with transcript summaries", async () => {
    const calls = {
      exportRows: jest.fn().mockResolvedValue({ data: [exportRowFixture()], nextCursor: null }),
      createAuditEvent: jest.fn().mockResolvedValue({ id: "audit-1" }),
    };
    const search = {
      toRepositoryOptions: jest.fn().mockReturnValue({
        organizationId: "org-1",
        page: 1,
        limit: 5000,
        search: "roofing",
      }),
    };
    const service = new CallExportService(calls as never, search as never);

    const result = await service.export(context, {
      format: CallExportFormatDto.CSV,
      search: "roofing",
    });

    expect(result.contentType).toContain("text/csv");
    const csv = await readStream(result.stream);
    expect(calls.exportRows).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", search: "roofing" }),
      null,
      expect.any(Number),
    );
    expect(csv).toContain("Roofing appointment requested");
    expect(csv).not.toContain("storagePath");
    expect(calls.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        actorUserId: "user-1",
        action: "call.exported",
      }),
    );
  });

  it("exports xlsx files when requested", async () => {
    const calls = {
      exportRows: jest.fn().mockResolvedValue({ data: [exportRowFixture()], nextCursor: null }),
      createAuditEvent: jest.fn().mockResolvedValue({ id: "audit-1" }),
    };
    const service = new CallExportService(
      calls as never,
      {
        toRepositoryOptions: jest.fn().mockReturnValue({ organizationId: "org-1", limit: 5000 }),
      } as never,
    );

    const result = await service.export(context, { format: CallExportFormatDto.XLSX });

    expect(result.fileName).toMatch(/\.xlsx$/);
    expect(result.contentType).toContain("spreadsheetml");
    const output = await readStreamBuffer(result.stream);
    expect(output.byteLength).toBeGreaterThan(100);
  });

  it("streams exports in cursor batches", async () => {
    const first = exportRowFixture("call-1");
    const second = exportRowFixture("call-2");
    const calls = {
      exportRows: jest
        .fn()
        .mockResolvedValueOnce({ data: [first], nextCursor: "next" })
        .mockResolvedValueOnce({ data: [second], nextCursor: null }),
      createAuditEvent: jest.fn().mockResolvedValue({ id: "audit-1" }),
    };
    const service = new CallExportService(
      calls as never,
      {
        toRepositoryOptions: jest.fn().mockReturnValue({
          organizationId: "org-1",
          limit: 50_000,
        }),
      } as never,
    );

    const result = await service.export(context, { format: CallExportFormatDto.CSV });
    const csv = await readStream(result.stream);

    expect(calls.exportRows).toHaveBeenCalledTimes(2);
    expect(calls.exportRows).toHaveBeenNthCalledWith(2, expect.any(Object), "next", expect.any(Number));
    expect(csv).toContain("call-1");
    expect(csv).toContain("call-2");
  });
});

async function readStream(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readStreamBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
  }
  return Buffer.concat(chunks);
}

function exportRowFixture(id = "call-1") {
  const now = new Date("2026-06-16T10:00:00.000Z");
  return {
    id,
    twilioCallSid: "CA123",
    callerNumber: "+14155551234",
    calledNumber: "+15551234567",
    direction: "INBOUND",
    status: "COMPLETED",
    source: "VOICE",
    endReason: "CALLER_HANGUP",
    startedAt: now,
    answeredAt: now,
    endedAt: now,
    durationSeconds: 42,
    agent: { id: "agent-1", name: "Reception" },
    phoneNumber: { id: "phone-1", phoneNumber: "+15551234567", friendlyName: "Main" },
    callTranscript: {
      id: "tr-1",
      status: "COMPLETED",
      summary: "Roofing appointment requested",
    },
  };
}
