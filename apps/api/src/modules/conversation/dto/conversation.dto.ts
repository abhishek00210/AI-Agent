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
  MinLength,
} from "class-validator";

export enum ConversationChannelDto {
  WEB_CHAT = "WEB_CHAT",
  VOICE = "VOICE",
  SMS = "SMS",
  WHATSAPP = "WHATSAPP",
}

export enum ConversationStatusDto {
  ACTIVE = "ACTIVE",
  CLOSED = "CLOSED",
  ARCHIVED = "ARCHIVED",
}

export class CreateConversationDto {
  @IsUUID()
  agentId!: string;

  @IsEnum(ConversationChannelDto)
  channel!: ConversationChannelDto;
}

export class ListConversationsQueryDto {
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
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(ConversationStatusDto)
  status?: ConversationStatusDto;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class ListMessagesQueryDto {
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
  limit?: number = 50;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  content!: string;
}
