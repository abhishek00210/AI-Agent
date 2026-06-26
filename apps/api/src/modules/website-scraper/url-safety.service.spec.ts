import { BadRequestException } from "@nestjs/common";
import { UrlSafetyService } from "./url-safety.service";

describe("UrlSafetyService", () => {
  const service = new UrlSafetyService();

  it.each([
    "not-a-url",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "ftp://example.com",
    "https://user:password@example.com",
    "http://localhost:3000",
    "http://api.localhost",
    "http://127.0.0.1",
    "http://10.0.0.5",
    "http://172.16.0.10",
    "http://192.168.1.10",
    "http://169.254.10.20",
    "http://[::1]",
  ])("rejects unsafe URL %s", async (url) => {
    await expect(service.validatePublicHttpUrl(url)).rejects.toBeInstanceOf(BadRequestException);
  });
});
