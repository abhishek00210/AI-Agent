export interface TelephonyAccount {
  accountSid: string;
  friendlyName: string | null;
  status: string | null;
}

export interface TelephonyPhoneNumber {
  providerSid: string;
  phoneNumber: string;
  friendlyName: string | null;
  country: string | null;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  voiceWebhookUrl: string | null;
  smsWebhookUrl: string | null;
}

export interface AvailablePhoneNumberSearchInput {
  countryCode: string;
  areaCode?: string;
  contains?: string;
  type?: "local" | "toll-free" | "mobile";
  voice?: boolean;
  sms?: boolean;
  limit?: number;
}

export interface AvailablePhoneNumber {
  phoneNumber: string;
  friendlyName: string | null;
  countryCode: string | null;
  region: string | null;
  locality: string | null;
  postalCode: string | null;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

export interface PurchasedPhoneNumber extends TelephonyPhoneNumber {
  dateCreated?: string | null;
}

export interface OutboundCallInput {
  to: string;
  from: string;
  voiceUrl: string;
  statusCallbackUrl: string;
}

export interface OutboundCallResult {
  providerCallSid: string;
  status: string;
}

export interface TelephonyProvider {
  isConfigured(): boolean;
  validateConnection(): Promise<TelephonyAccount>;
  listPhoneNumbers(): Promise<TelephonyPhoneNumber[]>;
  searchAvailablePhoneNumbers(input: AvailablePhoneNumberSearchInput): Promise<AvailablePhoneNumber[]>;
  purchasePhoneNumber(
    phoneNumber: string,
    input: { friendlyName?: string; voiceWebhookUrl?: string; smsWebhookUrl?: string },
  ): Promise<PurchasedPhoneNumber>;
  assignNumber(
    phoneNumberSid: string,
    input: { voiceWebhookUrl?: string; smsWebhookUrl?: string },
  ): Promise<void>;
  removeNumber(phoneNumberSid: string): Promise<void>;
  releaseNumber(phoneNumberSid: string): Promise<void>;
  endCallWithMessage(callSid: string, message: string): Promise<void>;
  startOutboundCall(input: OutboundCallInput): Promise<OutboundCallResult>;
  cancelOutboundCall(callSid: string): Promise<void>;
}
