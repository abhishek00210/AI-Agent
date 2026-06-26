import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export enum OutboundCallReasonTypeDto {
  LEAD_FOLLOW_UP = "LEAD_FOLLOW_UP",
  QUOTE_FOLLOW_UP = "QUOTE_FOLLOW_UP",
  MISSED_APPOINTMENT = "MISSED_APPOINTMENT",
  REVIEW_REQUEST = "REVIEW_REQUEST",
  MANUAL_CALL = "MANUAL_CALL",
  AUTOMATION_CALL = "AUTOMATION_CALL",
  FOLLOW_UP = "FOLLOW_UP",
  SYSTEM_TRIGGER = "SYSTEM_TRIGGER",
  REACTIVATION = "REACTIVATION",
}

export enum OutboundCallStatusDto {
  PENDING = "PENDING",
  SCHEDULED = "SCHEDULED",
  DIALING = "DIALING",
  RINGING = "RINGING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  BUSY = "BUSY",
  NO_ANSWER = "NO_ANSWER",
  VOICEMAIL = "VOICEMAIL",
  CANCELLED = "CANCELLED",
}

export class ListOutboundCallsDto {
  @IsOptional()
  @IsEnum(OutboundCallStatusDto)
  status?: OutboundCallStatusDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class CreateOutboundCallDto {
  @IsUUID()
  customerProfileId!: string;

  @IsUUID()
  agentId!: string;

  @IsOptional()
  @IsUUID()
  phoneNumberId?: string;

  @IsOptional()
  @IsEnum(OutboundCallReasonTypeDto)
  reasonType?: OutboundCallReasonTypeDto;

  @IsString()
  reasonDescription!: string;
}
