import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { RealtimeMetricsService } from "../../../common/metrics/realtime-metrics.service";
import type {
  CallResult,
  PhoneNumberResult,
  PhoneNumberSearchInput,
  RecordingResult,
  SmsResult,
  TelephonyHealthResult,
  TelephonyProvider,
  VerificationResult,
} from "./telephony-provider.interface";

@Injectable()
export class ExotelProvider implements TelephonyProvider {
  readonly name = "EXOTEL" as const;

  constructor(
    private readonly config: ConfigService,
    private readonly metrics: RealtimeMetricsService,
  ) {}

  isConfigured() {
    return Boolean(this.accountSid && this.apiKey && this.apiToken);
  }

  async health(): Promise<TelephonyHealthResult> {
    const startedAt = this.metrics.now();
    if (!this.isConfigured()) {
      return {
        provider: this.name,
        configured: false,
        healthy: false,
        latencyMs: Math.round(this.metrics.now() - startedAt),
        status: "NOT_CONFIGURED",
      };
    }

    try {
      await this.requestJson("GET", this.v2Path("IncomingPhoneNumbers"), undefined, {
        allow404: false,
      });
      return {
        provider: this.name,
        configured: true,
        healthy: true,
        latencyMs: Math.round(this.metrics.now() - startedAt),
        status: "OK",
        accountSid: this.accountSid,
      };
    } catch (error) {
      return {
        provider: this.name,
        configured: true,
        healthy: false,
        latencyMs: Math.round(this.metrics.now() - startedAt),
        status: "ERROR",
        accountSid: this.accountSid,
        error: readError(error),
      };
    }
  }

  async listNumbers(): Promise<PhoneNumberResult[]> {
    const response = await this.requestJson("GET", this.v2Path("IncomingPhoneNumbers"));
    return readArray(response, "incoming_phone_numbers", "IncomingPhoneNumbers", "phone_numbers")
      .map((number) => this.mapPhoneNumber(number))
      .filter((number): number is PhoneNumberResult => Boolean(number));
  }

  async searchNumbers(input: PhoneNumberSearchInput): Promise<PhoneNumberResult[]> {
    const country = (input.countryCode || "IN").trim().toUpperCase();
    const type = exotelNumberType(input.type);
    const params = new URLSearchParams();
    if (input.sms) params.set("IncomingSMS", "true");
    if (input.areaCode) params.set("InRegion", input.areaCode.toUpperCase());
    if (input.contains) params.set("Contains", input.contains.replace(/\D/g, ""));
    const response = await this.requestJson(
      "GET",
      `${this.v2Path(`AvailablePhoneNumbers/${country}/${type}`)}${query(params)}`,
    );
    return readArray(response, "available_phone_numbers", "AvailablePhoneNumbers", "phone_numbers")
      .slice(0, Math.min(Math.max(input.limit ?? 20, 1), 100))
      .map((number) => this.mapPhoneNumber(number, { countryCode: country, providerSid: "" }))
      .filter((number): number is PhoneNumberResult => Boolean(number));
  }

  async purchaseNumber(
    phoneNumber: string,
    input: { friendlyName?: string; voiceWebhookUrl?: string; smsWebhookUrl?: string },
  ): Promise<PhoneNumberResult> {
    const normalized = normalizePhone(phoneNumber, "IN");
    const response = await this.requestJson("POST", this.v2Path("IncomingPhoneNumbers"), {
      PhoneNumber: normalized,
      FriendlyName: input.friendlyName,
      ...this.flowUrlBody(),
    });
    const payload = readObject(response, "incoming_phone_number", "IncomingPhoneNumber", "ExoPhone") ?? response;
    const mapped = this.mapPhoneNumber(payload, { phoneNumber: normalized });
    if (!mapped) throw new ServiceUnavailableException("Exotel did not return a purchased number.");
    this.metrics.increment("telephony_exotel_numbers_purchased");
    return mapped;
  }

  async releaseNumber(providerNumberSid: string): Promise<void> {
    await this.requestJson("DELETE", this.v2Path(`IncomingPhoneNumbers/${encodeURIComponent(providerNumberSid)}`));
    this.metrics.increment("telephony_exotel_numbers_released");
  }

  disableNumber(providerNumberSid: string): Promise<void> {
    return this.releaseNumber(providerNumberSid);
  }

  async assignNumber(
    providerNumberSid: string,
    input: { voiceWebhookUrl?: string; smsWebhookUrl?: string },
  ): Promise<void> {
    void input;
    await this.requestJson("PUT", this.v2Path(`IncomingPhoneNumbers/${encodeURIComponent(providerNumberSid)}`), {
      ...this.flowUrlBody(),
    });
    this.metrics.increment("telephony_exotel_numbers_assigned");
  }

  async createInboundCall(): Promise<CallResult> {
    throw new ServiceUnavailableException("Exotel inbound calls are created by Exotel webhooks.");
  }

  async createOutboundCall(input: {
    to: string;
    from: string;
    voiceUrl: string;
    statusCallbackUrl: string;
  }): Promise<CallResult> {
    const response = await this.requestJson("POST", this.v1Path("Calls/connect"), {
      From: normalizePhone(input.to, "IN"),
      CallerId: normalizePhone(input.from, "IN"),
      StreamUrl: input.voiceUrl,
      StreamType: "bidirectional",
      Record: "true",
      StatusCallback: input.statusCallbackUrl,
      StatusCallbackEvents: "initiated,ringing,answered,completed,busy,failed,no-answer",
      StatusCallbackContentType: "application/json",
    });
    const call = readObject(response, "Call", "call") ?? response;
    const providerCallSid = stringValue(call, "Sid", "sid", "CallSid", "call_sid");
    if (!providerCallSid) throw new ServiceUnavailableException("Exotel did not return a call SID.");
    this.metrics.increment("telephony_exotel_outbound_calls");
    return {
      provider: this.name,
      providerCallSid,
      status: stringValue(call, "Status", "status") ?? "queued",
      durationSeconds: numberValue(call, "Duration", "duration"),
      failureReason: stringValue(call, "FailureReason", "failure_reason", "ErrorMessage"),
    };
  }

  async endCall(providerCallSid: string): Promise<void> {
    await this.requestJson("POST", this.v1Path(`Calls/${encodeURIComponent(providerCallSid)}`), {
      Status: "completed",
    });
  }

  async getCall(providerCallSid: string): Promise<CallResult> {
    const response = await this.requestJson(
      "GET",
      this.v1Path(`Calls/${encodeURIComponent(providerCallSid)}`),
    );
    const call = readObject(response, "Call", "call") ?? response;
    return {
      provider: this.name,
      providerCallSid: stringValue(call, "Sid", "sid", "CallSid", "call_sid") ?? providerCallSid,
      status: stringValue(call, "Status", "status") ?? "unknown",
      durationSeconds: numberValue(call, "Duration", "duration"),
      failureReason: stringValue(call, "FailureReason", "failure_reason", "ErrorMessage"),
    };
  }

  async getRecording(providerRecordingSid: string): Promise<RecordingResult> {
    if (/^https?:\/\//i.test(providerRecordingSid)) {
      return {
        provider: this.name,
        providerRecordingSid,
        callSid: providerRecordingSid,
        status: "completed",
        mediaUrl: providerRecordingSid,
      };
    }
    const response = await this.requestJson(
      "GET",
      this.v1Path(`Calls/${encodeURIComponent(providerRecordingSid)}`),
    );
    const call = readObject(response, "Call", "call") ?? response;
    const mediaUrl = stringValue(call, "RecordingUrl", "recording_url", "RecordingURL");
    return {
      provider: this.name,
      providerRecordingSid: mediaUrl ?? providerRecordingSid,
      callSid: stringValue(call, "Sid", "sid", "CallSid", "call_sid") ?? providerRecordingSid,
      status: mediaUrl ? "completed" : "processing",
      durationSeconds: numberValue(call, "Duration", "duration"),
      mediaUrl,
    };
  }

  async sendSms(input: {
    to: string;
    from: string;
    body: string;
    statusCallbackUrl?: string;
  }): Promise<SmsResult> {
    const response = await this.requestJson("POST", this.v1Path("Sms/send"), {
      To: normalizePhone(input.to, "IN"),
      From: normalizePhone(input.from, "IN"),
      Body: input.body,
      StatusCallback: input.statusCallbackUrl,
    });
    const message = readObject(response, "SMSMessage", "SmsMessage", "SMS", "sms") ?? response;
    const providerMessageId =
      stringValue(message, "Sid", "sid", "SmsSid", "sms_sid") ?? `exotel:${Date.now()}`;
    this.metrics.increment("telephony_exotel_sms");
    return {
      provider: this.name,
      providerMessageId,
      status: stringValue(message, "Status", "status") ?? "queued",
    };
  }

  verifyNumber(input: {
    to: string;
    from: string;
    code: string;
    method: "SMS" | "VOICE";
  }): Promise<VerificationResult> {
    return this.createVerification(input);
  }

  async createVerification(input: {
    to: string;
    from: string;
    code: string;
    method: "SMS" | "VOICE";
  }): Promise<VerificationResult> {
    if (input.method === "VOICE") {
      throw new ServiceUnavailableException("Exotel voice OTP is not enabled for this account.");
    }
    const result = await this.sendSms({
      to: input.to,
      from: input.from,
      body: `Your verification code is ${input.code}.`,
    });
    return {
      provider: this.name,
      providerVerificationId: result.providerMessageId,
      status: result.status,
    };
  }

  async lookupNumber(phoneNumber: string): Promise<PhoneNumberResult | null> {
    const normalized = normalizePhone(phoneNumber, "IN");
    const numbers = await this.listNumbers();
    return numbers.find((number) => number.phoneNumber === normalized) ?? null;
  }

  private mapPhoneNumber(
    raw: unknown,
    fallback: Partial<PhoneNumberResult> = {},
  ): PhoneNumberResult | null {
    if (!raw || typeof raw !== "object") return null;
    const number = raw as Record<string, unknown>;
    const phoneNumber = stringValue(number, "phone_number", "PhoneNumber", "number") ?? fallback.phoneNumber;
    if (!phoneNumber) return null;
    const capabilities = readObject(number, "capabilities", "Capabilities") ?? {};
    return {
      provider: this.name,
      providerSid:
        stringValue(number, "sid", "Sid", "exophone_sid", "ExoPhoneSid") ??
        fallback.providerSid ??
        phoneNumber,
      phoneNumber,
      friendlyName: stringValue(number, "friendly_name", "FriendlyName") ?? fallback.friendlyName ?? null,
      country: stringValue(number, "country", "Country") ?? fallback.country ?? "IN",
      countryCode: stringValue(number, "country", "Country") ?? fallback.countryCode ?? "IN",
      region: stringValue(number, "region", "Region") ?? fallback.region ?? null,
      locality: stringValue(number, "locality", "Locality") ?? fallback.locality ?? null,
      postalCode: stringValue(number, "postal_code", "PostalCode") ?? fallback.postalCode ?? null,
      capabilities: {
        voice: boolCapability(capabilities, "voice", "Voice", true),
        sms: boolCapability(capabilities, "sms", "SMS", false),
        mms: false,
      },
      dateCreated: stringValue(number, "date_created", "DateCreated") ?? fallback.dateCreated ?? null,
    };
  }

  private async requestJson(
    method: string,
    path: string,
    body?: Record<string, string | undefined>,
    options: { allow404?: boolean } = {},
  ): Promise<Record<string, unknown>> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException("Exotel credentials are not configured.");
    }
    const url = /^https?:\/\//i.test(path) ? path : `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:${this.apiToken}`).toString("base64")}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: body ? formBody(body) : undefined,
    });
    const text = await response.text();
    if (!response.ok) {
      if (response.status === 404 && options.allow404) return {};
      throw new ServiceUnavailableException(`Exotel API failed with ${response.status}: ${safeText(text)}`);
    }
    if (!text.trim()) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { raw: text };
    }
  }

  private v1Path(path: string) {
    return `/v1/Accounts/${encodeURIComponent(this.accountSid)}/${path.replace(/^\//, "")}`;
  }

  private v2Path(path: string) {
    return `/v2_beta/Accounts/${encodeURIComponent(this.accountSid)}/${path.replace(/^\//, "")}`;
  }

  private get baseUrl() {
    const subdomain = this.config.get<string>("exotel.subdomain") || "api.in.exotel.com";
    return `https://${subdomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }

  private get accountSid() {
    return this.config.get<string>("exotel.accountSid") ?? "";
  }

  private get apiKey() {
    return this.config.get<string>("exotel.apiKey") ?? "";
  }

  private get apiToken() {
    return this.config.get<string>("exotel.apiToken") ?? "";
  }

  private get voiceFlowUrl() {
    return this.config.get<string>("exotel.voiceFlowUrl") ?? "";
  }

  private get smsFlowUrl() {
    return this.config.get<string>("exotel.smsFlowUrl") ?? "";
  }

  private flowUrlBody() {
    return {
      VoiceUrl: this.voiceFlowUrl || undefined,
      SMSUrl: this.smsFlowUrl || undefined,
    };
  }
}

function exotelNumberType(type?: PhoneNumberSearchInput["type"]) {
  if (type === "toll-free") return "TollFree";
  if (type === "mobile") return "Mobile";
  return "Landline";
}

function formBody(body: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  return params;
}

function query(params: URLSearchParams) {
  const value = params.toString();
  return value ? `?${value}` : "";
}

function normalizePhone(value: string, country: "IN") {
  const parsed = parsePhoneNumberFromString(value, country);
  if (!parsed?.isValid()) {
    throw new BadRequestException("Invalid Indian phone number.");
  }
  return parsed.number;
}

function readArray(
  raw: unknown,
  ...keys: string[]
): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.filter(isRecord);
  if (!isRecord(raw)) return [];
  for (const key of keys) {
    const value = raw[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  for (const value of Object.values(raw)) {
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

function readObject(raw: unknown, ...keys: string[]): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  for (const key of keys) {
    if (isRecord(raw[key])) return raw[key];
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(raw: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function numberValue(raw: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function boolCapability(raw: Record<string, unknown>, lower: string, upper: string, fallback: boolean) {
  const value = raw[lower] ?? raw[upper];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes"].includes(value.toLowerCase());
  return fallback;
}

function safeText(value: string) {
  return value.replace(/(api[_-]?key|api[_-]?token|authorization)[^,\s}]*/gi, "$1=redacted").slice(0, 500);
}

function readError(error: unknown) {
  return error instanceof Error ? error.message : "Exotel health check failed.";
}
