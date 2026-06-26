import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from "class-validator";

export class CreatePortRequestDto {
  @Matches(/^\+?[1-9]\d{7,14}$/)
  phoneNumber!: string;

  @IsIn(["CA", "US", "GB", "AU"])
  countryCode!: string;

  @IsString() @Length(2, 120)
  currentCarrier!: string;

  @IsString() @Length(1, 120)
  accountNumber!: string;

  @IsOptional() @IsString() @MaxLength(64)
  accountPin?: string;

  @IsString() @Length(2, 160)
  businessName!: string;

  @IsObject()
  businessAddress!: Record<string, string>;

  @IsString() @Length(2, 160)
  authorizedContactName!: string;

  @IsEmail()
  authorizedContactEmail!: string;

  @Matches(/^\+?[1-9]\d{7,14}$/)
  authorizedContactPhone!: string;

  @IsOptional() @IsUUID()
  assignedAgentId?: string;
}

export class AssignPortRequestAgentDto {
  @IsOptional() @IsUUID()
  agentId?: string | null;
}

export class AdminUpdatePortRequestDto {
  @IsIn([
    "PENDING",
    "DOCUMENT_REQUIRED",
    "SUBMITTED",
    "PROCESSING",
    "REJECTED",
    "APPROVED",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
  ])
  status!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  statusMessage?: string;

  @IsOptional() @IsString() @MaxLength(160)
  twilioPortRequestId?: string;

  @IsOptional() @IsString()
  estimatedPortDate?: string;
}

