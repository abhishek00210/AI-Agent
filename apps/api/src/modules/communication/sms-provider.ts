export const SMS_PROVIDER = Symbol("SMS_PROVIDER");

export interface SendSmsProviderInput {
  organizationId: string;
  to: string;
  from: string;
  body: string;
  statusCallbackUrl: string;
}

export interface SendSmsProviderResult {
  provider: "TWILIO" | "EXOTEL";
  providerMessageId: string;
  status: string;
}

export interface SMSProvider {
  readonly name: "TWILIO" | "EXOTEL";
  send(input: SendSmsProviderInput): Promise<SendSmsProviderResult>;
}
