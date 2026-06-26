import { Type } from "class-transformer";
import { AppointmentStatus, CustomerLeadStatus, LeadStatus } from "../../../../generated/prisma";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export enum CampaignTypeDto {
  FOLLOW_UP = "FOLLOW_UP",
  RE_ENGAGEMENT = "RE_ENGAGEMENT",
  REMINDER = "REMINDER",
  SALES_OUTREACH = "SALES_OUTREACH",
}

export enum CampaignScheduleTypeDto {
  IMMEDIATE = "IMMEDIATE",
  SCHEDULED = "SCHEDULED",
  RECURRING = "RECURRING",
}

export class CampaignTargetingDto {
  @IsOptional()
  @IsArray()
  @IsEnum(LeadStatus, { each: true })
  leadStatuses?: LeadStatus[];

  @IsOptional()
  @IsArray()
  @IsEnum(CustomerLeadStatus, { each: true })
  customerStatuses?: CustomerLeadStatus[];

  @IsOptional()
  @IsArray()
  @IsEnum(AppointmentStatus, { each: true })
  appointmentStatuses?: AppointmentStatus[];

  @IsOptional()
  @IsDateString()
  lastContactBefore?: string;

  @IsOptional()
  @IsDateString()
  lastContactAfter?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(CustomerLeadStatus)
  customerType?: CustomerLeadStatus;
}

export class CreateCampaignDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(CampaignTypeDto)
  campaignType!: CampaignTypeDto;

  @IsUUID()
  assignedAgentId!: string;

  @IsEnum(CampaignScheduleTypeDto)
  scheduleType!: CampaignScheduleTypeDto;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsObject()
  recurrence?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxAttempts?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10_000)
  @IsUUID("4", { each: true })
  customerProfileIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignTargetingDto)
  targeting?: CampaignTargetingDto;
}

export class ListCampaignsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
