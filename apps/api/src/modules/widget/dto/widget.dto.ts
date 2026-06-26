import {
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export enum WidgetStatusDto {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export enum WidgetPositionDto {
  BOTTOM_RIGHT = "BOTTOM_RIGHT",
  BOTTOM_LEFT = "BOTTOM_LEFT",
}

export class CreateWidgetDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsUUID()
  agentId!: string;

  @IsEnum(WidgetPositionDto)
  position!: WidgetPositionDto;

  @IsHexColor()
  primaryColor!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  welcomeMessage!: string;

  @IsEnum(WidgetStatusDto)
  status!: WidgetStatusDto;
}

export class UpdateWidgetDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsEnum(WidgetPositionDto)
  position?: WidgetPositionDto;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  welcomeMessage?: string;

  @IsOptional()
  @IsEnum(WidgetStatusDto)
  status?: WidgetStatusDto;
}

export class ListWidgetsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class PublicWidgetInitDto {
  @IsUUID()
  widgetId!: string;

  @IsString()
  @MinLength(16)
  @MaxLength(160)
  publicKey!: string;
}

export class PublicWidgetConversationDto extends PublicWidgetInitDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  visitorId?: string;
}

export class PublicWidgetChatDto extends PublicWidgetInitDto {
  @IsUUID()
  conversationId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(120)
  visitorId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  message!: string;
}
