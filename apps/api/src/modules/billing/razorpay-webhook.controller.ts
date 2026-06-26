import { BadRequestException, Controller, Headers, HttpCode, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { StripeWebhookService } from "./stripe-webhook.service";

type RawRequest = FastifyRequest & { rawBody?: Buffer };

@Controller("billing/webhooks/razorpay")
export class RazorpayWebhookController {
  constructor(private readonly webhooks: StripeWebhookService) {}

  @Post()
  @HttpCode(200)
  handle(@Req() request: RawRequest, @Headers("x-razorpay-signature") signature?: string) {
    if (!request.rawBody) throw new BadRequestException("Raw Razorpay webhook body is required.");
    return this.webhooks.handleRazorpay(request.rawBody, signature);
  }
}
