import { NotFoundException } from "@nestjs/common";
import { RecordingService } from "./recording.service";

describe("RecordingService", () => {
  const recordings = {
    findById: jest.fn(),
    createAuditEvent: jest.fn().mockResolvedValue(undefined),
  };
  const storage = {
    createDownloadUrl: jest.fn(),
  };
  const service = new RecordingService(
    recordings as never,
    {} as never,
    {} as never,
    {} as never,
    storage as never,
  );
  const context = {
    organizationId: "org-1",
    userId: "user-1",
    role: "OWNER",
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("issues a five-minute signed URL only after tenant-scoped ownership lookup", async () => {
    recordings.findById.mockResolvedValue({
      id: "recording-1",
      organizationId: "org-1",
      callId: "call-1",
      status: "AVAILABLE",
      storagePath: "organizations/org-1/calls/call-1/recordings/recording-1.wav",
      fileName: "recording.wav",
      mimeType: "audio/wav",
    });
    storage.createDownloadUrl.mockResolvedValue({
      url: "https://storage.example/signed",
      expiresInSeconds: 300,
    });

    await expect(service.download(context, "recording-1")).resolves.toEqual({
      url: "https://storage.example/signed",
      expiresInSeconds: 300,
    });

    expect(recordings.findById).toHaveBeenCalledWith("org-1", "recording-1");
    expect(storage.createDownloadUrl).toHaveBeenCalledWith(
      "organizations/org-1/calls/call-1/recordings/recording-1.wav",
      "recording.wav",
      "audio/wav",
    );
  });

  it("does not issue a signed URL for a recording outside the current tenant", async () => {
    recordings.findById.mockResolvedValue(null);

    await expect(service.download(context, "recording-other-tenant")).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(storage.createDownloadUrl).not.toHaveBeenCalled();
  });
});
