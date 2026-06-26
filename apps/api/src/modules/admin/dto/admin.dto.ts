import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;
}

export class AdminListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  organizationId?: string;
}

export class AdminStatusDto {
  @IsIn(["ACTIVE", "SUSPENDED", "ARCHIVED", "TRIAL_EXPIRED"])
  status!: "ACTIVE" | "SUSPENDED" | "ARCHIVED" | "TRIAL_EXPIRED";

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;
}

export class AdminOrganizationLocalizationDto {
  @IsIn(["CA", "IN"])
  country!: "CA" | "IN";

  @IsOptional()
  @IsIn(["en", "fr", "hi"])
  language?: "en" | "fr" | "hi";

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessHoursTimezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxRegion?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;
}

export class UserStatusDto {
  @IsIn(["ACTIVE", "SUSPENDED"])
  status!: "ACTIVE" | "SUSPENDED";

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;
}

export class AgentStatusDto {
  @IsIn(["ACTIVE", "INACTIVE", "DRAFT"])
  status!: "ACTIVE" | "INACTIVE" | "DRAFT";

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;
}

export class DeleteConfirmDto {
  @IsString()
  @IsIn(["DELETE", "ARCHIVE"])
  confirmation!: "DELETE" | "ARCHIVE";

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;
}

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(12)
  @MaxLength(100)
  newPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;
}

export class AdminPlanOverrideDto {
  @IsIn(["STARTER", "PRO", "AGENCY"])
  plan!: "STARTER" | "PRO" | "AGENCY";

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;
}

export class AdminCancelSubscriptionDto {
  @IsOptional()
  @IsIn(["IMMEDIATE", "PERIOD_END"])
  mode?: "IMMEDIATE" | "PERIOD_END";

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;
}

export class AdminResumeSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;
}

export class AdminFeatureOverrideDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  feature!: string;

  @IsOptional()
  enabled?: boolean;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;
}

export class GrantTrialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;

  days?: number;
}

export class CreateSupportTicketDto {
  @IsUUID()
  organizationId!: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsOptional()
  @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"])
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}

export class UpdateSupportTicketDto {
  @IsOptional()
  @IsIn(["OPEN", "PENDING", "RESOLVED", "CLOSED"])
  status?: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";

  @IsOptional()
  @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"])
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";

  @IsOptional()
  @IsUUID()
  assignedAdminId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reply?: string;
}

export class AdminAssignExternalNumberDto {
  @IsOptional()
  @IsUUID()
  agentId?: string | null;
}
