import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import { Transform } from "class-transformer";

export enum PhoneNumberStatusDto {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  UNASSIGNED = "UNASSIGNED",
}

export class ListPhoneNumbersQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(PhoneNumberStatusDto)
  status?: PhoneNumberStatusDto;

  @IsOptional()
  @IsUUID()
  agentId?: string;
}

export class AssignPhoneNumberAgentDto {
  @IsUUID()
  agentId!: string;
}

export class SearchMarketplaceNumbersQueryDto {
  @IsString()
  @IsIn(["CA", "IN"])
  country!: string;

  @IsOptional()
  @IsString()
  areaCode?: string;

  @IsOptional()
  @IsString()
  contains?: string;

  @IsOptional()
  @IsIn(["local", "toll-free", "mobile"])
  type?: "local" | "toll-free" | "mobile";

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  voice?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  sms?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class PurchaseMarketplaceNumberDto {
  @IsPhoneNumber()
  phoneNumber!: string;

  @IsString()
  @IsIn(["CA", "IN"])
  country!: string;

  @IsOptional()
  @IsString()
  areaCode?: string;

  @IsOptional()
  @IsUUID()
  agentId?: string;
}

export class ReleaseMarketplaceNumberDto {
  @IsUUID()
  phoneNumberId!: string;
}

export class MarketplacePhoneNumberIdDto {
  @IsUUID()
  phoneNumberId!: string;
}
