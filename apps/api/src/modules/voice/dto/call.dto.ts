import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export enum CallStatusDto {
  RINGING = "RINGING",
  ROUTING = "ROUTING",
  CONNECTED = "CONNECTED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  MISSED = "MISSED",
}

export enum CallDirectionDto {
  INBOUND = "INBOUND",
  OUTBOUND = "OUTBOUND",
}

export enum CallSourceDto {
  VOICE = "VOICE",
  WIDGET = "WIDGET",
  INTERNAL = "INTERNAL",
}

export enum CallEndReasonDto {
  CALLER_HANGUP = "CALLER_HANGUP",
  AI_HANGUP = "AI_HANGUP",
  TIMEOUT = "TIMEOUT",
  ERROR = "ERROR",
  TRANSFER = "TRANSFER",
  UNKNOWN = "UNKNOWN",
}

export enum CallSortByDto {
  STARTED_AT = "startedAt",
  DURATION_SECONDS = "durationSeconds",
  STATUS = "status",
}

export enum SortOrderDto {
  ASC = "asc",
  DESC = "desc",
}

export enum CallExportFormatDto {
  CSV = "csv",
  XLSX = "xlsx",
}

export class ListCallsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(300)
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(CallStatusDto)
  status?: CallStatusDto;

  @IsOptional()
  @IsEnum(CallDirectionDto)
  direction?: CallDirectionDto;

  @IsOptional()
  @IsEnum(CallSourceDto)
  source?: CallSourceDto;

  @IsOptional()
  @IsEnum(CallEndReasonDto)
  endReason?: CallEndReasonDto;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsUUID()
  phoneNumberId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationMax?: number;

  @IsOptional()
  @IsEnum(CallSortByDto)
  sortBy?: CallSortByDto = CallSortByDto.STARTED_AT;

  @IsOptional()
  @IsEnum(SortOrderDto)
  sortOrder?: SortOrderDto = SortOrderDto.DESC;
}

export class ExportCallsQueryDto extends ListCallsQueryDto {
  @IsOptional()
  @IsEnum(CallExportFormatDto)
  format?: CallExportFormatDto = CallExportFormatDto.CSV;
}
