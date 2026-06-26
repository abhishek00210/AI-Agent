import { Body, Controller, Headers, Post } from "@nestjs/common";
import { DeliveryWebhookService } from "./delivery-webhook.service";

@Controller("webhooks/twilio/sms")
export class CommunicationWebhookController {
  constructor(private readonly delivery: DeliveryWebhookService) {}

  @Post("status")
  async status(
    @Body() body: Record<string, string>,
    @Headers("x-twilio-signature") signature?: string,
  ) {
    await this.delivery.status(body, signature);
    return { received: true };
  }

  @Post("inbound")
  async inbound(
    @Body() body: Record<string, string>,
    @Headers("x-twilio-signature") signature?: string,
  ) {
    await this.delivery.inbound(body, signature);
    return "<Response></Response>";
  }

  @Post()
  async legacyInbound(
    @Body() body: Record<string, string>,
    @Headers("x-twilio-signature") signature?: string,
  ) {
    await this.delivery.inbound(body, signature, "");
    return "<Response></Response>";
  }
}
