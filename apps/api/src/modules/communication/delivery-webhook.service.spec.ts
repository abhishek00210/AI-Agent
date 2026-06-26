import { ForbiddenException } from "@nestjs/common";
import { DeliveryWebhookService } from "./delivery-webhook.service";

describe("DeliveryWebhookService", () => {
  const signatures = { validateRequest: jest.fn() };
  const messages = {
    findByProviderId: jest.fn(),
    updateDelivery: jest.fn(),
    audit: jest.fn(),
  };
  const service = new DeliveryWebhookService(
    signatures as never,
    { getOrThrow: jest.fn().mockReturnValue("https://agent.example.com") } as never,
    messages as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("rejects an invalid provider signature before reading message state", async () => {
    signatures.validateRequest.mockReturnValue(false);
    await expect(service.status({ MessageSid: "SM123" }, "invalid")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(messages.findByProviderId).not.toHaveBeenCalled();
  });

  it("records Twilio delivery by provider SID", async () => {
    signatures.validateRequest.mockReturnValue(true);
    messages.findByProviderId.mockResolvedValue({
      id: "message-1",
      organizationId: "org-1",
      metadata: { appointmentId: "appointment-1" },
    });
    messages.updateDelivery.mockResolvedValue({ status: "DELIVERED" });

    await service.status({ MessageSid: "SM123", MessageStatus: "delivered" }, "valid");

    expect(messages.updateDelivery).toHaveBeenCalledWith(
      "message-1",
      "DELIVERED",
      expect.objectContaining({ appointmentId: "appointment-1" }),
    );
  });
});
