import { Body, Controller, Header, HttpCode, Post, UseGuards } from "@nestjs/common";
import { IncomingCallService } from "./incoming-call.service";
import { ExotelWebhookGuard } from "./exotel-webhook.guard";

@Controller("webhooks/exotel")
export class ExotelIncomingCallController {
  constructor(private readonly incomingCalls: IncomingCallService) {}

  @Post("voice")
  @HttpCode(200)
  @Header("Content-Type", "text/xml")
  @UseGuards(ExotelWebhookGuard)
  voice(@Body() body: Record<string, unknown>) {
    return this.incomingCalls.handle(normalizeExotelInbound(body), { mediaProvider: "EXOTEL" });
  }
}

function normalizeExotelInbound(body: Record<string, unknown>) {
  return {
    ...body,
    CallSid: required(body, "CallSid", "call_sid", "Sid", "sid"),
    From: required(body, "CallFrom", "From", "from", "Caller"),
    To: required(body, "CallTo", "To", "to", "Called", "DialWhomNumber"),
    Direction: value(body, "Direction", "direction") ?? "inbound",
    Timestamp: value(body, "Timestamp", "timestamp", "DateCreated"),
  };
}

function required(body: Record<string, unknown>, ...keys: string[]) {
  const result = value(body, ...keys);
  if (!result) return "";
  return result;
}

function value(body: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const entry = body[key];
    if (typeof entry === "string" && entry.trim()) return entry.trim();
    if (typeof entry === "number") return String(entry);
  }
  return undefined;
}
