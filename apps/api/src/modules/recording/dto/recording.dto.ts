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

export enum RecordingStatusDto {
  PENDING = "PENDING",
  RECORDING = "RECORDING",
  PROCESSING = "PROCESSING",
  AVAILABLE = "AVAILABLE",
  FAILED = "FAILED",
  DELETED = "DELETED",
}

export class ListRecordingsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(RecordingStatusDto)
  status?: RecordingStatusDto;

  @IsOptional()
  @IsUUID()
  callId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
