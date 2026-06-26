import { Module } from "@nestjs/common";
import { S3StorageProvider } from "./s3-storage.provider";
import { StorageController } from "./storage.controller";
import { StorageService } from "./storage.service";

@Module({
  controllers: [StorageController],
  providers: [S3StorageProvider, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
