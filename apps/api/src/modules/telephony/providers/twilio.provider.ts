import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RealtimeMetricsService } from "../../../common/metrics/realtime-metrics.service";
import { TwilioService } from "../../twilio/twilio.service";
import type {
  CallResult,
  PhoneNumberResult,
  RecordingResult,
  SmsResult,
  TelephonyHealthResult,
  TelephonyProvider,
  VerificationResult,
  PhoneNumberSearchInput,
} from "./telephony-provider.interface";

@Injectable()
export class TwilioProvider implements TelephonyProvider {
  readonly name = "TWILIO" as const;

  constructor(
    private readonly twilio: TwilioService,
    private readonly config: ConfigService,
    private readonly metrics: RealtimeMetricsService,
  ) {}

  isConfigured() {
    return this.twilio.isConfigured();
  }

  async health(): Promise<TelephonyHealthResult> {
    const startedAt = this.metrics.now();
    try {
      const account = await this.twilio.validateConnection();
      return {
        provider: this.name,
        configured: true,
        healthy: true,
        latencyMs: Math.round(this.metrics.now() - startedAt),
        status: account.status,
        accountSid: account.accountSid,
      };
    } catch (error) {
      return {
        provider: this.name,
        configured: this.isConfigured(),
        healthy: false,
        latencyMs: Math.round(this.metrics.now() - startedAt),
        error: error instanceof Error ? error.message : "Twilio health check failed.",
      };
    }
  }

  async searchNumbers(input: PhoneNumberSearchInput): Promise<PhoneNumberResult[]> {
    const numbers = await this.twilio.searchAvailablePhoneNumbers(input);
    return numbers.map((number) => ({
      provider: this.name,
      providerSid: "",
      ...number,
      country: number.countryCode,
    }));
  }

  async listNumbers(): Promise<PhoneNumberResult[]> {
    const numbers = await this.twilio.listPhoneNumbers();
    return numbers.map((number) => ({ provider: this.name, ...number }));
  }

  async purchaseNumber(
    phoneNumber: string,
    input: { friendlyName?: string; voiceWebhookUrl?: string; smsWebhookUrl?: string },
  ): Promise<PhoneNumberResult> {
    return { provider: this.name, ...(await this.twilio.purchasePhoneNumber(phoneNumber, input)) };
  }

  releaseNumber(providerNumberSid: string) {
    return this.twilio.releaseNumber(providerNumberSid);
  }

  disableNumber(providerNumberSid: string) {
    return this.twilio.removeNumber(providerNumberSid);
  }

  assignNumber(
    providerNumberSid: string,
    input: { voiceWebhookUrl?: string; smsWebhookUrl?: string },
  ) {
    return this.twilio.assignNumber(providerNumberSid, input);
  }

  async createInboundCall(): Promise<CallResult> {
    throw new ServiceUnavailableException("Twilio inbound calls are created by Twilio webhooks.");
  }

  async createOutboundCall(input: {
    to: string;
    from: string;
    voiceUrl: string;
    statusCallbackUrl: string;
  }): Promise<CallResult> {
    const result = await this.twilio.startOutboundCall(input);
    this.metrics.increment("telephony_twilio_outbound_calls");
    return {
      provider: this.name,
      providerCallSid: result.providerCallSid,
      status: result.status,
    };
  }

  async endCall(
    providerCallSid: string,
    input?: { message?: string; status?: "canceled" | "completed" },
  ) {
    if (input?.message) {
      await this.twilio.endCallWithMessage(providerCallSid, input.message);
      return;
    }
    if (input?.status === "canceled") {
      await this.twilio.cancelOutboundCall(providerCallSid);
      return;
    }
    await this.twilio.completeCall(providerCallSid);
  }

  async getCall(providerCallSid: string): Promise<CallResult> {
    const call = await this.twilio.getCall(providerCallSid);
    return {
      provider: this.name,
      providerCallSid: call.providerCallSid,
      status: call.status,
      durationSeconds: call.durationSeconds,
    };
  }

  async getRecording(providerRecordingSid: string): Promise<RecordingResult> {
    const recording = await this.twilio.getRecording(providerRecordingSid);
    return {
      provider: this.name,
      providerRecordingSid: recording.providerRecordingSid,
      callSid: recording.callSid,
      status: recording.status,
      durationSeconds: recording.durationSeconds,
      mediaUrl: recording.mediaUrl,
    };
  }

  async sendSms(input: {
    to: string;
    from: string;
    body: string;
    statusCallbackUrl?: string;
  }): Promise<SmsResult> {
    const result = await this.twilio.sendSms(input);
    this.metrics.increment("telephony_twilio_sms");
    return {
      provider: this.name,
      providerMessageId: result.providerMessageId,
      status: result.status,
    };
  }

  async verifyNumber(input: {
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
    const result =
      input.method === "SMS"
        ? await this.twilio.sendVerificationSms(input)
        : await this.twilio.sendVerificationCall(input);
    return {
      provider: this.name,
      providerVerificationId:
        "providerMessageId" in result ? result.providerMessageId : result.providerCallId,
      status: result.status,
    };
  }

  async lookupNumber(phoneNumber: string): Promise<PhoneNumberResult | null> {
    const number = await this.twilio.lookupPhoneNumber(phoneNumber);
    return number ? { provider: this.name, ...number } : null;
  }

  statusCallbackUrl(path: string) {
    return `${this.webhookBaseUrl}${path}`;
  }

  private get webhookBaseUrl() {
    return (
      this.config.get<string>("voice.webhookBaseUrl") ??
      this.config.get<string>("api.appUrl") ??
      "http://localhost:4000"
    ).replace(/\/$/, "");
  }
}
