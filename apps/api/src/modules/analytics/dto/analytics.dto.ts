import { IsDateString, IsIn, IsOptional } from "class-validator";

export class AnalyticsQueryDto {
  @IsOptional()
  @IsIn(["TODAY", "7D", "30D", "CUSTOM"])
  range?: "TODAY" | "7D" | "30D" | "CUSTOM";

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
