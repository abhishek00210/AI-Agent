import { IsEmail, IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export class CreateCustomerDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(160) company?: string;
  @IsOptional() @IsObject() address?: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @IsOptional() @IsIn(["NEW", "CONTACTED", "QUALIFIED", "BOOKED", "CUSTOMER", "LOST"])
  leadStatus?: "NEW" | "CONTACTED" | "QUALIFIED" | "BOOKED" | "CUSTOMER" | "LOST";
}
