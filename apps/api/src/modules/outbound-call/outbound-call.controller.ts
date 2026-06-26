import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyRequest } from "fastify";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { OutboundCallStatus } from "../../../generated/prisma";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { TwilioSignatureService } from "../twilio/twilio-signature.service";
import { ExotelSignatureService } from "../telephony/exotel-signature.service";
import { CreateOutboundCallDto, ListOutboundCallsDto } from "./dto/outbound-call.dto";
import { OutboundCallService } from "./outbound-call.service";

@Controller()
export class OutboundCallController {
  constructor(
    private readonly outboundCalls: OutboundCallService,
    private readonly tenant: TenantService,
    private readonly signatures: TwilioSignatureService,
    private readonly exotelSignatures: ExotelSignatureService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post("outbound-calls")
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateOutboundCallDto) {
    return this.outboundCalls.create(this.tenant.fromUser(user), body);
  }

  @UseGuards(JwtAuthGuard)
  @Get("outbound-calls")
  list(@CurrentUser() user: JwtPayload, @Query() query: ListOutboundCallsDto) {
    return this.outboundCalls.list(this.tenant.fromUser(user), {
      ...query,
      status: query.status as OutboundCallStatus | undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get("outbound-calls/:id")
  get(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.outboundCalls.get(this.tenant.fromUser(user), id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("outbound-calls/:id/cancel")
  cancel(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.outboundCalls.cancel(this.tenant.fromUser(user), id);
  }

  @Post(["webhooks/twilio/outbound-status", "webhooks/twilio/outbound/status"])
  @HttpCode(200)
  async status(@Body() body: Record<string, unknown>, @Req() request: FastifyRequest) {
    const params = normalizeParams(body);
    const valid = this.signatures.validateRequest({
      url: `${this.baseUrl}${request.url.split("?")[0]}`,
      params,
      signature: signatureHeader(request),
    });
    if (!valid) throw new ForbiddenException("Invalid Twilio signature.");
    await this.outboundCalls.handleStatusCallback({
      providerCallSid: requiredString(body.CallSid, "CallSid"),
      callStatus: optionalString(body.CallStatus),
      answeredBy: optionalString(body.AnsweredBy),
      durationSeconds: optionalNumber(body.CallDuration),
    });
    return { ok: true };
  }

  @Post(["webhooks/exotel/outbound-status", "webhooks/exotel/outbound/status", "webhooks/exotel/status"])
  @HttpCode(200)
  async exotelStatus(
    @Body() body: Record<string, unknown>,
    @Req() request: FastifyRequest & { rawBody?: Buffer },
  ) {
    const valid = this.exotelSignatures.validateRequest({
      url: `${this.baseUrl}${request.url.split("?")[0]}`,
      params: normalizeParams(body),
      rawBody: request.rawBody,
      signature: exotelSignatureHeader(request),
    });
    if (!valid) throw new ForbiddenException("Invalid Exotel signature.");
    await this.outboundCalls.handleStatusCallback({
      providerCallSid: requiredString(
        firstValue(body, "CallSid", "call_sid", "Sid", "sid"),
        "CallSid",
      ),
      callStatus: optionalString(firstValue(body, "CallStatus", "Status", "status", "CallType")),
      answeredBy: optionalString(firstValue(body, "AnsweredBy", "answered_by")),
      durationSeconds: optionalNumber(firstValue(body, "CallDuration", "Duration", "duration")),
    });
    return { ok: true };
  }

  private get baseUrl() {
    return (
      this.config.get<string>("voice.webhookBaseUrl") ??
      this.config.get<string>("api.appUrl") ??
      "http://localhost:4000"
    ).replace(/\/$/, "");
  }
}

function signatureHeader(request: FastifyRequest) {
  const header = request.headers["x-twilio-signature"];
  return Array.isArray(header) ? header[0] : header;
}

function exotelSignatureHeader(request: FastifyRequest) {
  for (const key of ["x-exotel-signature", "x-exotel-webhook-signature", "x-exotel-signature-sha256"]) {
    const header = request.headers[key];
    const value = Array.isArray(header) ? header[0] : header;
    if (value) return value;
  }
  return undefined;
}

function firstValue(body: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return value;
  }
  return undefined;
}

function normalizeParams(value: unknown): Record<string, string | string[] | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      Array.isArray(entry)
        ? entry.map((item) => String(item))
        : entry === undefined
          ? undefined
          : String(entry),
    ]),
  );
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${field} is required.`);
  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
