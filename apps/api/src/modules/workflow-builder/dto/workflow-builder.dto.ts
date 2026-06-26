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
  MinLength,
  ValidateNested,
} from "class-validator";

export enum WorkflowTriggerDto {
  NEW_LEAD = "NEW_LEAD",
  MISSED_APPOINTMENT = "MISSED_APPOINTMENT",
  APPOINTMENT_COMPLETED = "APPOINTMENT_COMPLETED",
  NO_RESPONSE = "NO_RESPONSE",
  UPCOMING_APPOINTMENT = "UPCOMING_APPOINTMENT",
  QUOTE_SENT = "QUOTE_SENT",
}
export enum WorkflowActionDto {
  SMS = "SMS",
  EMAIL = "EMAIL",
  CALL = "CALL",
}
export enum WorkflowTimingDto {
  AFTER_TRIGGER = "AFTER_TRIGGER",
  BEFORE_EVENT = "BEFORE_EVENT",
}
export enum WorkflowTemplateCategoryDto {
  LEAD = "LEAD",
  APPOINTMENT = "APPOINTMENT",
  REVIEW = "REVIEW",
  QUOTE = "QUOTE",
  CUSTOM = "CUSTOM",
}

export class WorkflowConfigurationDto {
  @IsEnum(WorkflowTriggerDto) triggerType!: WorkflowTriggerDto;
  @Type(() => Number) @IsInt() @Min(0) @Max(525600) delayMinutes!: number;
  @IsEnum(WorkflowTimingDto) timing!: WorkflowTimingDto;
  @IsEnum(WorkflowActionDto) actionType!: WorkflowActionDto;
  @IsString() @MinLength(1) @MaxLength(4000) messageTemplate!: string;
  @IsOptional() @IsString() @MaxLength(200) emailSubject?: string;
  @IsObject() conditions: Record<string, unknown> = {};
  @IsOptional() @IsUUID() assignedAgentId?: string;
}

export class ActivateWorkflowTemplateDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(525600) delayMinutes?: number;
  @IsOptional() @IsEnum(WorkflowTimingDto) timing?: WorkflowTimingDto;
  @IsOptional() @IsEnum(WorkflowActionDto) actionType?: WorkflowActionDto;
  @IsOptional() @IsString() @MaxLength(4000) messageTemplate?: string;
  @IsOptional() @IsString() @MaxLength(200) emailSubject?: string;
  @IsOptional() @IsObject() conditions?: Record<string, unknown>;
  @IsOptional() @IsUUID() assignedAgentId?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class CreateWorkflowDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ValidateNested() @Type(() => WorkflowConfigurationDto) configuration!: WorkflowConfigurationDto;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class ListWorkflowTemplatesDto {
  @IsOptional() @IsEnum(WorkflowTemplateCategoryDto) category?: WorkflowTemplateCategoryDto;
}
