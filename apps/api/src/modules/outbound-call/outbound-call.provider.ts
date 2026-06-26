export interface StartOutboundCallInput {
  to: string;
  from: string;
}

export interface StartOutboundCallResult {
  providerCallSid: string;
  status: string;
}

export abstract class OutboundCallProvider {
  abstract startCall(input: StartOutboundCallInput): Promise<StartOutboundCallResult>;
  abstract cancelCall(providerCallSid: string): Promise<void>;
  abstract leaveVoicemailOrHangUp(input: {
    providerCallSid: string;
    mode: "LEAVE_MESSAGE" | "HANG_UP";
    message: string;
  }): Promise<void>;
}
