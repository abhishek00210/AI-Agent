import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export enum OrganizationMemberRoleDto {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsIn(["CA", "IN"])
  country?: "CA" | "IN";

  @IsOptional()
  @IsIn(["CA", "IN"])
  countryCode?: "CA" | "IN";

  @IsOptional()
  @IsIn(["CAD", "INR"])
  currency?: "CAD" | "INR";

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsIn(["en", "fr", "hi"])
  language?: "en" | "fr" | "hi";

  @IsOptional()
  @IsIn(["TWILIO", "EXOTEL"])
  telephonyProvider?: "TWILIO" | "EXOTEL";

  @IsOptional()
  @IsIn(["STRIPE", "RAZORPAY"])
  paymentProvider?: "STRIPE" | "RAZORPAY";

  @IsOptional()
  @IsString()
  dateFormat?: string;

  @IsOptional()
  @IsString()
  timeFormat?: string;

  @IsOptional()
  @IsString()
  numberFormat?: string;

  @IsOptional()
  @IsString()
  businessHoursTimezone?: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsString()
  billingCompanyName?: string;

  @IsOptional()
  @IsString()
  taxRegion?: string;

  @IsOptional()
  @IsObject()
  billingAddress?: Record<string, unknown>;
}

export enum GreetingConfidenceThresholdDto {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export class UpdateGreetingSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  recencyWindowDays?: number;

  @IsOptional()
  @IsEnum(GreetingConfidenceThresholdDto)
  confidenceThreshold?: GreetingConfidenceThresholdDto;
}

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(OrganizationMemberRoleDto)
  role!: OrganizationMemberRoleDto;
}

export class UpdateMemberRoleDto {
  @IsEnum(OrganizationMemberRoleDto)
  role!: OrganizationMemberRoleDto;
}
