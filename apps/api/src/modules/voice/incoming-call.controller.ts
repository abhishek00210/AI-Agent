import { Body, Controller, Header, HttpCode, Post, UseGuards } from "@nestjs/common";
import { IncomingCallService } from "./incoming-call.service";
import { TwilioWebhookGuard } from "./twilio-webhook.guard";

@Controller("webhooks/twilio")
export class IncomingCallController {
  constructor(private readonly incomingCalls: IncomingCallService) {}

  @Post("voice")
  @HttpCode(200)
  @Header("Content-Type", "text/xml")
  @UseGuards(TwilioWebhookGuard)
  voice(@Body() body: Record<string, unknown>) {
    return this.incomingCalls.handle(body);
  }
}
