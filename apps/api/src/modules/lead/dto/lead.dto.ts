import { IsArray, IsEnum, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { Transform } from "class-transformer";

export enum LeadStatusDto {
  NEW = "NEW",
  CONTACTED = "CONTACTED",
  QUALIFIED = "QUALIFIED",
  BOOKED = "BOOKED",
  CUSTOMER = "CUSTOMER",
  LOST = "LOST",
  CLOSED = "CLOSED",
}

export enum LeadSourceDto {
  VOICE = "VOICE",
  CHAT = "CHAT",
  WIDGET = "WIDGET",
  MANUAL = "MANUAL",
  IMPORT = "IMPORT",
  AI_AGENT = "AI_AGENT",
}

export class ListLeadsQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @IsEnum(LeadStatusDto)
  status?: LeadStatusDto;

  @IsOptional()
  @IsEnum(LeadSourceDto)
  source?: LeadSourceDto;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === "true")
  includeDeleted?: boolean;
}

export class CreateLeadDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsEnum(LeadSourceDto)
  source?: LeadSourceDto;

  @IsOptional()
  @IsEnum(LeadStatusDto)
  status?: LeadStatusDto;

  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  countryCode?: string;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsEnum(LeadStatusDto)
  status?: LeadStatusDto;

  @IsOptional()
  @IsUUID()
  assignedAgentId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  countryCode?: string;
}

export enum LeadImportDuplicateStrategyDto {
  SKIP = "SKIP",
  UPDATE_EXISTING = "UPDATE_EXISTING",
  CREATE_NEW = "CREATE_NEW",
}

export class ConfirmLeadImportDto {
  @IsEnum(LeadImportDuplicateStrategyDto)
  duplicateStrategy!: LeadImportDuplicateStrategyDto;
}

export class CreateCampaignFromLeadImportDto {
  @IsUUID()
  assignedAgentId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  campaignType?: "FOLLOW_UP" | "RE_ENGAGEMENT" | "REMINDER" | "SALES_OUTREACH";

  @IsOptional()
  @IsString()
  scheduleType?: "IMMEDIATE" | "SCHEDULED";

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  @Max(5)
  maxAttempts?: number;
}
