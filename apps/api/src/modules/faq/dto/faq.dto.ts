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

export enum FaqStatusDto {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export class CreateFaqDto {
  @IsUUID()
  knowledgeBaseId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  answer!: string;

  @IsOptional()
  @IsEnum(FaqStatusDto)
  status?: FaqStatusDto = FaqStatusDto.ACTIVE;
}

export class UpdateFaqDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  answer?: string;

  @IsOptional()
  @IsEnum(FaqStatusDto)
  status?: FaqStatusDto;
}

export class ListFaqsQueryDto {
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
  @IsEnum(FaqStatusDto)
  status?: FaqStatusDto;
}
