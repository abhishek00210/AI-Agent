import { ForbiddenException } from "@nestjs/common";
import { TwilioWebhookGuard } from "./twilio-webhook.guard";

describe("TwilioWebhookGuard", () => {
  it("allows valid signed webhook requests", async () => {
    const deps = createDependencies(true);
    const guard = createGuard(deps);

    await expect(guard.canActivate(contextFixture("valid"))).resolves.toBe(true);
    expect(deps.signatures.validateRequest).toHaveBeenCalledWith({
      url: "https://api.example.com/api/v1/webhooks/twilio/voice",
      params: {
        CallSid: "CA123",
        From: "+14155551234",
        To: "+15551234567",
      },
      signature: "valid",
    });
  });

  it("rejects missing or invalid signatures with 403 and audits known numbers", async () => {
    const deps = createDependencies(false);
    deps.phoneNumbers.findByPhoneNumber.mockResolvedValue({
      id: "phone-1",
      organizationId: "org-1",
      deletedAt: null,
    });
    const guard = createGuard(deps);

    await expect(guard.canActivate(contextFixture(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(deps.calls.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        action: "call.invalid_webhook",
      }),
    );
  });
});

function createGuard(deps: ReturnType<typeof createDependencies>) {
  return new TwilioWebhookGuard(
    deps.signatures as never,
    deps.webhookUrls as never,
    deps.phoneNumbers as never,
    deps.calls as never,
  );
}

function createDependencies(valid: boolean) {
  return {
    signatures: { validateRequest: jest.fn().mockReturnValue(valid) },
    webhookUrls: {
      voiceUrl: jest.fn().mockReturnValue("https://api.example.com/api/v1/webhooks/twilio/voice"),
    },
    phoneNumbers: {
      findByPhoneNumber: jest.fn(),
    },
    calls: {
      createAuditEvent: jest.fn().mockResolvedValue({}),
    },
  };
}

function contextFixture(signature?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          "x-twilio-signature": signature,
        },
        body: {
          CallSid: "CA123",
          From: "+14155551234",
          To: "+15551234567",
        },
      }),
    }),
  } as never;
}
