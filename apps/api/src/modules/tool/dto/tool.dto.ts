import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export enum ToolExecutionStatusDto {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  REJECTED = "REJECTED",
}

export class ListToolExecutionsQueryDto {
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
  @IsEnum(ToolExecutionStatusDto)
  status?: ToolExecutionStatusDto;

  @IsOptional()
  @IsString()
  toolName?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  callId?: string;

  @IsOptional()
  @IsString()
  agentId?: string;
}

export class UpdateToolStatusDto {
  @IsBoolean()
  enabled!: boolean;
}
