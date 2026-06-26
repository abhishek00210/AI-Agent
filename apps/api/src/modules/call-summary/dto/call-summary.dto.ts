import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

export enum SentimentDto {
  POSITIVE = "POSITIVE",
  NEUTRAL = "NEUTRAL",
  NEGATIVE = "NEGATIVE",
}

export enum OutcomeDto {
  BOOKED_APPOINTMENT = "BOOKED_APPOINTMENT",
  QUALIFIED_LEAD = "QUALIFIED_LEAD",
  FOLLOW_UP_REQUIRED = "FOLLOW_UP_REQUIRED",
  INFORMATION_PROVIDED = "INFORMATION_PROVIDED",
  TRANSFERRED = "TRANSFERRED",
  UNRESOLVED = "UNRESOLVED",
  OTHER = "OTHER",
}

export class ListCallSummariesQueryDto {
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
  limit?: number = 25;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(SentimentDto)
  sentiment?: SentimentDto;

  @IsOptional()
  @IsEnum(OutcomeDto)
  outcome?: OutcomeDto;
}
