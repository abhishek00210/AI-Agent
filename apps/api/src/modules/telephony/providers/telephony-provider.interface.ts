export type TelephonyProviderName = "TWILIO" | "EXOTEL";

export type Country = "CA" | "IN" | "US" | "GB" | "AU";

export interface ProviderCapabilities extends Record<string, boolean> {
  voice: boolean;
  sms: boolean;
  mms: boolean;
}

export interface PhoneNumberSearchInput {
  countryCode: string;
  areaCode?: string;
  contains?: string;
  type?: "local" | "toll-free" | "mobile";
  voice?: boolean;
  sms?: boolean;
  limit?: number;
}

export interface PhoneNumberResult {
  provider: TelephonyProviderName;
  providerSid: string;
  phoneNumber: string;
  friendlyName: string | null;
  country: string | null;
  countryCode?: string | null;
  region?: string | null;
  locality?: string | null;
  postalCode?: string | null;
  capabilities: ProviderCapabilities;
  voiceWebhookUrl?: string | null;
  smsWebhookUrl?: string | null;
  dateCreated?: string | null;
}

export interface CallResult {
  provider: TelephonyProviderName;
  providerCallSid: string;
  status: string;
  durationSeconds?: number | null;
  failureReason?: string | null;
}

export interface RecordingResult {
  provider: TelephonyProviderName;
  providerRecordingSid: string;
  callSid: string;
  status: string;
  durationSeconds?: number | null;
  mediaUrl?: string | null;
}

export interface SmsResult {
  provider: TelephonyProviderName;
  providerMessageId: string;
  status: string;
}

export interface VerificationResult {
  provider: TelephonyProviderName;
  providerVerificationId: string;
  status: string;
}

export interface TelephonyHealthResult {
  provider: TelephonyProviderName;
  configured: boolean;
  healthy: boolean;
  latencyMs: number;
  status?: string | null;
  accountSid?: string | null;
  error?: string | null;
}

export interface TelephonyProvider {
  readonly name: TelephonyProviderName;
  isConfigured(): boolean;
  health(): Promise<TelephonyHealthResult>;
  listNumbers(): Promise<PhoneNumberResult[]>;
  searchNumbers(input: PhoneNumberSearchInput): Promise<PhoneNumberResult[]>;
  purchaseNumber(
    phoneNumber: string,
    input: { friendlyName?: string; voiceWebhookUrl?: string; smsWebhookUrl?: string },
  ): Promise<PhoneNumberResult>;
  releaseNumber(providerNumberSid: string): Promise<void>;
  disableNumber(providerNumberSid: string): Promise<void>;
  assignNumber(
    providerNumberSid: string,
    input: { voiceWebhookUrl?: string; smsWebhookUrl?: string },
  ): Promise<void>;
  createInboundCall(input: {
    to: string;
    from: string;
    twiml?: string;
    voiceUrl?: string;
  }): Promise<CallResult>;
  createOutboundCall(input: {
    to: string;
    from: string;
    voiceUrl: string;
    statusCallbackUrl: string;
  }): Promise<CallResult>;
  endCall(
    providerCallSid: string,
    input?: { message?: string; status?: "canceled" | "completed" },
  ): Promise<void>;
  getCall(providerCallSid: string): Promise<CallResult>;
  getRecording(providerRecordingSid: string): Promise<RecordingResult>;
  sendSms(input: {
    to: string;
    from: string;
    body: string;
    statusCallbackUrl?: string;
  }): Promise<SmsResult>;
  verifyNumber(input: {
    to: string;
    from: string;
    code: string;
    method: "SMS" | "VOICE";
  }): Promise<VerificationResult>;
  createVerification(input: {
    to: string;
    from: string;
    code: string;
    method: "SMS" | "VOICE";
  }): Promise<VerificationResult>;
  lookupNumber(phoneNumber: string): Promise<PhoneNumberResult | null>;
}
