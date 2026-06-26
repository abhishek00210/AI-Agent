import { PortEncryptionService } from "./port-encryption.service";

describe("PortEncryptionService", () => {
  it("encrypts carrier credentials with authenticated encryption", () => {
    const service = new PortEncryptionService({
      get: jest.fn((key: string) => key === "PORTING_ENCRYPTION_KEY" ? "a-long-production-secret" : undefined),
    } as never);
    const encrypted = service.encrypt("carrier-account-123");
    expect(encrypted).not.toContain("carrier-account-123");
    expect(service.decrypt(encrypted)).toBe("carrier-account-123");
  });

  it("rejects ciphertext tampering", () => {
    const service = new PortEncryptionService({ get: jest.fn(() => "secret") } as never);
    const encrypted = service.encrypt("1234");
    expect(() => service.decrypt(`${encrypted}x`)).toThrow();
  });
});

