import { IsIn, IsOptional, IsString, IsUUID, Length, Matches } from "class-validator";

export class CreateExternalNumberDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: "phoneNumber must be a valid international number." })
  phoneNumber!: string;

  @IsString()
  @IsIn(["CA", "US", "GB", "AU"])
  countryCode!: "CA" | "US" | "GB" | "AU";

  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @IsOptional()
  @IsUUID()
  forwardingTargetPhoneNumberId?: string;

  @IsOptional()
  @IsIn(["SMS", "VOICE"])
  verificationMethod?: "SMS" | "VOICE";
}

export class VerifyExternalNumberDto {
  @IsUUID()
  id!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}

export class ResendExternalNumberOtpDto {
  @IsOptional()
  @IsIn(["SMS", "VOICE"])
  verificationMethod?: "SMS" | "VOICE";
}

export class AssignExternalNumberAgentDto {
  @IsOptional()
  @IsUUID()
  agentId?: string | null;

  @IsOptional()
  @IsUUID()
  forwardingTargetPhoneNumberId?: string;
}
