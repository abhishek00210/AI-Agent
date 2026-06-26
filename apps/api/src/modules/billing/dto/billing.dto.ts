import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class CreateCheckoutDto {
  @IsIn(["STARTER", "PRO", "AGENCY"])
  plan!: "STARTER" | "PRO" | "AGENCY";
}

export class ChangePlanDto extends CreateCheckoutDto {}

export class CancelSubscriptionDto {
  @IsOptional()
  @IsIn(["IMMEDIATE", "PERIOD_END"])
  mode?: "IMMEDIATE" | "PERIOD_END";
}

export class PauseSubscriptionDto {
  @IsInt()
  @Min(1)
  @Max(30)
  days!: number;
}
