import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  AvailablePhoneNumber,
  AvailablePhoneNumberSearchInput,
  OutboundCallInput,
  OutboundCallResult,
  PurchasedPhoneNumber,
  TelephonyAccount,
  TelephonyPhoneNumber,
  TelephonyProvider,
} from "./twilio.provider";

interface TwilioAccountResponse {
  sid: string;
  friendly_name?: string | null;
  status?: string | null;
}

interface TwilioIncomingPhoneNumbersResponse {
  incoming_phone_numbers?: TwilioIncomingPhoneNumber[];
}

interface TwilioIncomingPhoneNumber {
  sid: string;
  phone_number: string;
  friendly_name?: string | null;
  iso_country?: string | null;
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
    mms?: boolean;
  };
  voice_url?: string | null;
  sms_url?: string | null;
  date_created?: string | null;
}

interface TwilioAvailablePhoneNumbersResponse {
  available_phone_numbers?: TwilioAvailablePhoneNumber[];
}

interface TwilioAvailablePhoneNumber {
  phone_number: string;
  friendly_name?: string | null;
  iso_country?: string | null;
  region?: string | null;
  locality?: string | null;
  postal_code?: string | null;
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
    mms?: boolean;
  };
}

interface TwilioMessageResponse {
  sid: string;
  status?: string;
}

interface TwilioCallResponse {
  sid: string;
  status?: string;
  duration?: string | null;
}

interface TwilioRecordingResponse {
  sid: string;
  call_sid: string;
  status?: string;
  duration?: string | null;
  uri?: string | null;
}

@Injectable()
export class TwilioService implements TelephonyProvider {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.accountSid && this.authSecret);
  }

  describe() {
    return {
      provider: "twilio" as const,
      configured: this.isConfigured(),
      accountSid: this.accountSid || null,
    };
  }

  async validateConnection(): Promise<TelephonyAccount> {
    const account = await this.request<TwilioAccountResponse>(
      `/2010-04-01/Accounts/${this.accountSid}.json`,
    );
    return {
      accountSid: account.sid,
      friendlyName: account.friendly_name ?? null,
      status: account.status ?? null,
    };
  }

  async listPhoneNumbers(): Promise<TelephonyPhoneNumber[]> {
    const result = await this.request<TwilioIncomingPhoneNumbersResponse>(
      `/2010-04-01/Accounts/${this.accountSid}/IncomingPhoneNumbers.json?PageSize=1000`,
    );
    return (result.incoming_phone_numbers ?? []).map((number) => ({
      providerSid: number.sid,
      phoneNumber: number.phone_number,
      friendlyName: number.friendly_name ?? null,
      country: number.iso_country ?? null,
      capabilities: {
        voice: Boolean(number.capabilities?.voice),
        sms: Boolean(number.capabilities?.sms),
        mms: Boolean(number.capabilities?.mms),
      },
      voiceWebhookUrl: number.voice_url ?? null,
      smsWebhookUrl: number.sms_url ?? null,
    }));
  }

  async searchAvailablePhoneNumbers(
    input: AvailablePhoneNumberSearchInput,
  ): Promise<AvailablePhoneNumber[]> {
    const countryCode = normalizeCountryCode(input.countryCode);
    const typePath = availableNumberTypePath(input.type);
    const query = new URLSearchParams();
    query.set("PageSize", String(Math.min(Math.max(input.limit ?? 20, 1), 50)));
    if (input.areaCode) query.set("AreaCode", input.areaCode);
    if (input.contains) query.set("Contains", input.contains);
    if (input.voice !== undefined) query.set("VoiceEnabled", String(input.voice));
    if (input.sms !== undefined) query.set("SmsEnabled", String(input.sms));

    const result = await this.request<TwilioAvailablePhoneNumbersResponse>(
      `/2010-04-01/Accounts/${this.accountSid}/AvailablePhoneNumbers/${countryCode}/${typePath}.json?${query.toString()}`,
    );

    return (result.available_phone_numbers ?? []).map((number) => ({
      phoneNumber: number.phone_number,
      friendlyName: number.friendly_name ?? null,
      countryCode: number.iso_country ?? countryCode,
      region: number.region ?? null,
      locality: number.locality ?? null,
      postalCode: number.postal_code ?? null,
      capabilities: {
        voice: Boolean(number.capabilities?.voice),
        sms: Boolean(number.capabilities?.sms),
        mms: Boolean(number.capabilities?.mms),
      },
    }));
  }

  async purchasePhoneNumber(
    phoneNumber: string,
    input: { friendlyName?: string; voiceWebhookUrl?: string; smsWebhookUrl?: string },
  ): Promise<PurchasedPhoneNumber> {
    const body = new URLSearchParams();
    body.set("PhoneNumber", phoneNumber);
    if (input.friendlyName) body.set("FriendlyName", input.friendlyName);
    if (input.voiceWebhookUrl) body.set("VoiceUrl", input.voiceWebhookUrl);
    if (input.smsWebhookUrl) body.set("SmsUrl", input.smsWebhookUrl);

    const number = await this.request<TwilioIncomingPhoneNumber>(
      `/2010-04-01/Accounts/${this.accountSid}/IncomingPhoneNumbers.json`,
      { method: "POST", body },
    );

    return toTelephonyPhoneNumber(number);
  }

  async assignNumber(
    phoneNumberSid: string,
    input: { voiceWebhookUrl?: string; smsWebhookUrl?: string },
  ): Promise<void> {
    const body = new URLSearchParams();
    if (input.voiceWebhookUrl) {
      body.set("VoiceUrl", input.voiceWebhookUrl);
    }
    if (input.smsWebhookUrl) {
      body.set("SmsUrl", input.smsWebhookUrl);
    }
    if (body.size === 0) {
      return;
    }
    await this.request(
      `/2010-04-01/Accounts/${this.accountSid}/IncomingPhoneNumbers/${phoneNumberSid}.json`,
      {
        method: "POST",
        body,
      },
    );
  }

  async removeNumber(phoneNumberSid: string): Promise<void> {
    const body = new URLSearchParams();
    body.set("VoiceUrl", "");
    body.set("SmsUrl", "");
    await this.request(
      `/2010-04-01/Accounts/${this.accountSid}/IncomingPhoneNumbers/${phoneNumberSid}.json`,
      {
        method: "POST",
        body,
      },
    );
  }

  async releaseNumber(phoneNumberSid: string): Promise<void> {
    await this.request(
      `/2010-04-01/Accounts/${this.accountSid}/IncomingPhoneNumbers/${phoneNumberSid}.json`,
      { method: "DELETE" },
    );
  }

  async endCallWithMessage(callSid: string, message: string): Promise<void> {
    const body = new URLSearchParams();
    body.set("Twiml", `<Response><Say>${escapeXml(message)}</Say><Hangup/></Response>`);
    await this.request(`/2010-04-01/Accounts/${this.accountSid}/Calls/${callSid}.json`, {
      method: "POST",
      body,
    });
  }

  async sendVerificationSms(input: { to: string; from: string; code: string }) {
    return this.sendSms({
      to: input.to,
      from: input.from,
      body: `Your Zodo phone verification code is ${input.code}. It expires in 10 minutes.`,
    });
  }

  async sendSms(input: { to: string; from: string; body: string; statusCallbackUrl?: string }) {
    const body = new URLSearchParams();
    body.set("To", input.to);
    body.set("From", input.from);
    body.set("Body", input.body);
    if (input.statusCallbackUrl) body.set("StatusCallback", input.statusCallbackUrl);
    const result = await this.request<TwilioMessageResponse>(
      `/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      { method: "POST", body },
    );
    return { providerMessageId: result.sid, status: result.status ?? "queued" };
  }

  async sendVerificationCall(input: { to: string; from: string; code: string }) {
    const digits = input.code.split("").join(", ");
    const body = new URLSearchParams();
    body.set("To", input.to);
    body.set("From", input.from);
    body.set(
      "Twiml",
      `<Response><Say>Your Zodo verification code is ${escapeXml(digits)}. I repeat, ${escapeXml(digits)}.</Say></Response>`,
    );
    const result = await this.request<TwilioCallResponse>(
      `/2010-04-01/Accounts/${this.accountSid}/Calls.json`,
      { method: "POST", body },
    );
    return { providerCallId: result.sid, status: result.status ?? "queued" };
  }

  async startOutboundCall(input: OutboundCallInput): Promise<OutboundCallResult> {
    const body = new URLSearchParams();
    body.set("To", input.to);
    body.set("From", input.from);
    body.set("Url", input.voiceUrl);
    body.set("Method", "POST");
    body.set("StatusCallback", input.statusCallbackUrl);
    body.set("StatusCallbackMethod", "POST");
    body.set("StatusCallbackEvent", "initiated ringing answered completed");
    body.set("MachineDetection", "Enable");
    body.set("MachineDetectionTimeout", "5");
    const result = await this.request<TwilioCallResponse>(
      `/2010-04-01/Accounts/${this.accountSid}/Calls.json`,
      { method: "POST", body },
    );
    return { providerCallSid: result.sid, status: result.status ?? "queued" };
  }

  async cancelOutboundCall(callSid: string): Promise<void> {
    const path = `/2010-04-01/Accounts/${this.accountSid}/Calls/${encodeURIComponent(callSid)}.json`;
    const cancel = new URLSearchParams();
    cancel.set("Status", "canceled");
    try {
      await this.request<TwilioCallResponse>(path, { method: "POST", body: cancel });
    } catch {
      const complete = new URLSearchParams();
      complete.set("Status", "completed");
      await this.request<TwilioCallResponse>(path, { method: "POST", body: complete });
    }
  }

  async completeCall(callSid: string): Promise<void> {
    const body = new URLSearchParams();
    body.set("Status", "completed");
    await this.request<TwilioCallResponse>(
      `/2010-04-01/Accounts/${this.accountSid}/Calls/${encodeURIComponent(callSid)}.json`,
      { method: "POST", body },
    );
  }

  async getCall(callSid: string) {
    const call = await this.request<TwilioCallResponse>(
      `/2010-04-01/Accounts/${this.accountSid}/Calls/${encodeURIComponent(callSid)}.json`,
    );
    return {
      providerCallSid: call.sid,
      status: call.status ?? "unknown",
      durationSeconds: numberOrNull(call.duration),
    };
  }

  async getRecording(recordingSid: string) {
    const recording = await this.request<TwilioRecordingResponse>(
      `/2010-04-01/Accounts/${this.accountSid}/Recordings/${encodeURIComponent(recordingSid)}.json`,
    );
    return {
      providerRecordingSid: recording.sid,
      callSid: recording.call_sid,
      status: recording.status ?? "unknown",
      durationSeconds: numberOrNull(recording.duration),
      mediaUrl: recording.uri
        ? `https://api.twilio.com${recording.uri.replace(/\.json$/, ".mp3")}`
        : null,
    };
  }

  async lookupPhoneNumber(phoneNumber: string): Promise<TelephonyPhoneNumber | null> {
    const numbers = await this.listPhoneNumbers();
    return numbers.find((number) => number.phoneNumber === phoneNumber) ?? null;
  }

  private async request<T = unknown>(
    path: string,
    options: { method?: string; body?: URLSearchParams } = {},
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException("Twilio credentials are not configured.");
    }

    const response = await fetch(`https://api.twilio.com${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.authUsername}:${this.authSecret}`).toString(
          "base64",
        )}`,
        ...(options.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: options.body,
    });

    if (!response.ok) {
      const message = await readTwilioError(response);
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new BadRequestException(message);
      }
      throw new ServiceUnavailableException(message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private get accountSid(): string {
    return this.config.get<string>("twilio.accountSid") ?? "";
  }

  private get authUsername(): string {
    return this.config.get<string>("twilio.apiKey") || this.accountSid;
  }

  private get authSecret(): string {
    return (
      this.config.get<string>("twilio.apiSecret") ||
      this.config.get<string>("twilio.authToken") ||
      ""
    );
  }
}

async function readTwilioError(response: Response): Promise<string> {
  const fallback =
    "Twilio request failed. The selected number or country may require additional Twilio verification, regulatory documents, or account permissions.";
  try {
    const payload = (await response.json()) as {
      message?: unknown;
      code?: unknown;
      more_info?: unknown;
    };
    const message = typeof payload.message === "string" ? payload.message : null;
    const code =
      typeof payload.code === "string" || typeof payload.code === "number"
        ? String(payload.code)
        : null;
    if (!message) return fallback;
    return code
      ? `Twilio request failed (${code}): ${message}`
      : `Twilio request failed: ${message}`;
  } catch {
    return fallback;
  }
}

function toTelephonyPhoneNumber(number: TwilioIncomingPhoneNumber): PurchasedPhoneNumber {
  return {
    providerSid: number.sid,
    phoneNumber: number.phone_number,
    friendlyName: number.friendly_name ?? null,
    country: number.iso_country ?? null,
    capabilities: {
      voice: Boolean(number.capabilities?.voice),
      sms: Boolean(number.capabilities?.sms),
      mms: Boolean(number.capabilities?.mms),
    },
    voiceWebhookUrl: number.voice_url ?? null,
    smsWebhookUrl: number.sms_url ?? null,
    dateCreated: number.date_created ?? null,
  };
}

function normalizeCountryCode(countryCode: string): string {
  return countryCode.trim().toUpperCase();
}

function availableNumberTypePath(type: AvailablePhoneNumberSearchInput["type"]): string {
  switch (type) {
    case "toll-free":
      return "TollFree";
    case "mobile":
      return "Mobile";
    case "local":
    default:
      return "Local";
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function numberOrNull(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
