import { BadRequestException, Controller, Headers, HttpCode, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { StripeWebhookService } from "./stripe-webhook.service";

type RawRequest = FastifyRequest & { rawBody?: Buffer };

@Controller("billing/webhooks/stripe")
export class StripeWebhookController {
  constructor(private readonly webhooks: StripeWebhookService) {}

  @Post()
  @HttpCode(200)
  handle(@Req() request: RawRequest, @Headers("stripe-signature") signature?: string) {
    if (!request.rawBody) throw new BadRequestException("Raw Stripe webhook body is required.");
    return this.webhooks.handle(request.rawBody, signature);
  }
}
