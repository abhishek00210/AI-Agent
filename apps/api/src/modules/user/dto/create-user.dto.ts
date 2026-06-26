import { IsEmail, IsEnum, IsString, MinLength } from "class-validator";

export enum UserStatusDto {
  ACTIVE = "ACTIVE",
  INVITED = "INVITED",
  SUSPENDED = "SUSPENDED",
}

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEnum(UserStatusDto)
  status: UserStatusDto = UserStatusDto.INVITED;
}
