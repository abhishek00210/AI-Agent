export const CALL_SUMMARY_QUEUE_NAME = "call-summary";
export const CALL_SUMMARY_VERSION = "call-summary-v1";

export interface GenerateCallSummaryJob {
  organizationId: string;
  transcriptId: string;
  force?: boolean;
}
