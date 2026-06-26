import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export enum AutomationExecutionStatusDto {
  PENDING = "PENDING",
  SCHEDULED = "SCHEDULED",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export class ListAutomationExecutionsDto {
  @IsOptional() @IsEnum(AutomationExecutionStatusDto) status?: AutomationExecutionStatusDto;
  @IsOptional() @IsUUID() customerProfileId?: string;
  @IsOptional() @IsUUID() workflowId?: string;
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}

export class UpdateAutomationWorkflowDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateAutomationRuleDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(525600) delayMinutes?: number;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsObject() conditions?: Record<string, unknown>;
}

export class CancelAutomationDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class UpdateAutomationTemplateDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsOptional() @IsString() @MaxLength(4000) body?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
