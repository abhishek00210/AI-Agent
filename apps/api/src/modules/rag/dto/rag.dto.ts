import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class AskAgentDto {
  @IsUUID()
  agentId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  question!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}

export class SearchKnowledgeBaseDto {
  @IsUUID()
  knowledgeBaseId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}
