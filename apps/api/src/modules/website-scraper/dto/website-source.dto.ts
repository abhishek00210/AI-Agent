import { Transform, Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export enum WebsiteSourceStatusDto {
  PENDING = "PENDING",
  SCRAPING = "SCRAPING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export class CreateWebsiteSourceDto {
  @IsUUID()
  knowledgeBaseId!: string;

  @IsString()
  @MaxLength(2048)
  url!: string;
}

export class ListWebsiteSourcesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsUUID()
  knowledgeBaseId?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(WebsiteSourceStatusDto)
  status?: WebsiteSourceStatusDto;
}
