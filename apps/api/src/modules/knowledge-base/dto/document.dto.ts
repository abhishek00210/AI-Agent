import { Transform, Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export enum UploadStatusDto {
  PENDING = "PENDING",
  UPLOADED = "UPLOADED",
  FAILED = "FAILED",
}

export enum ProcessingStatusDto {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  EMBEDDING = "EMBEDDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export class CreateDocumentDto {
  @IsUUID()
  knowledgeBaseId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UploadPdfDto {
  @IsUUID()
  knowledgeBaseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(UploadStatusDto)
  uploadStatus?: UploadStatusDto;

  @IsOptional()
  @IsEnum(ProcessingStatusDto)
  processingStatus?: ProcessingStatusDto;
}

export class ListDocumentsQueryDto {
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
  limit?: number = 10;

  @IsOptional()
  @IsUUID()
  knowledgeBaseId?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(UploadStatusDto)
  uploadStatus?: UploadStatusDto;

  @IsOptional()
  @IsEnum(ProcessingStatusDto)
  processingStatus?: ProcessingStatusDto;
}
