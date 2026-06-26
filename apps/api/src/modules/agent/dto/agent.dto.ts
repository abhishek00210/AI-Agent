import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export enum AgentStatusDto {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DRAFT = "DRAFT",
}

export class CreateAgentDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsIn(["en-US", "hi-IN", "es-ES", "fr-FR", "de-DE", "ar-SA"])
  language!: string;

  @IsString()
  @IsIn(["alloy", "echo", "fable", "onyx", "nova", "shimmer"])
  voice!: string;

  @IsString()
  @MinLength(20)
  systemPrompt!: string;

  @IsEnum(AgentStatusDto)
  status!: AgentStatusDto;
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(["en-US", "hi-IN", "es-ES", "fr-FR", "de-DE", "ar-SA"])
  language?: string;

  @IsOptional()
  @IsString()
  @IsIn(["alloy", "echo", "fable", "onyx", "nova", "shimmer"])
  voice?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  systemPrompt?: string;

  @IsOptional()
  @IsEnum(AgentStatusDto)
  status?: AgentStatusDto;
}

export class ListAgentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(AgentStatusDto)
  status?: AgentStatusDto;
}
