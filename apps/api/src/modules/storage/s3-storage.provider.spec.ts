import { S3StorageProvider } from "./s3-storage.provider";

describe("S3StorageProvider", () => {
  it("creates download URLs with a five-minute cryptographic expiry", async () => {
    const values: Record<string, string> = {
      "storage.region": "us-east-1",
      "storage.endpoint": "https://storage.example.com",
      "storage.accessKeyId": "test-access-key",
      "storage.secretAccessKey": "test-secret-key",
      "storage.bucket": "private-recordings",
    };
    const provider = new S3StorageProvider({
      get: (key: string) => values[key],
    } as never);

    const access = await provider.createDownloadUrl(
      "organizations/org-1/calls/call-1/recordings/recording-1.wav",
      "recording.wav",
      "audio/wav",
    );
    const signedUrl = new URL(access.url);

    expect(access.expiresInSeconds).toBe(300);
    expect(signedUrl.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(signedUrl.searchParams.get("response-content-type")).toBe("audio/wav");
  });
});
