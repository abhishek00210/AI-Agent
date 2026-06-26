import { Injectable } from "@nestjs/common";
import type {
  StorageDownloadAccess,
  StorageDownloadResult,
  StorageUploadInput,
  StorageUploadResult,
} from "./storage.provider";
import { S3StorageProvider } from "./s3-storage.provider";

@Injectable()
export class StorageService {
  constructor(private readonly provider: S3StorageProvider) {}

  get providerName() {
    return this.provider.providerName;
  }

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  bucketName(): string {
    return this.provider.bucketName();
  }

  upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    return this.provider.upload(input);
  }

  download(key: string): Promise<StorageDownloadResult> {
    return this.provider.download(key);
  }

  downloadToFile(key: string, destinationPath: string): Promise<void> {
    return this.provider.downloadToFile(key, destinationPath);
  }

  delete(key: string): Promise<void> {
    return this.provider.delete(key);
  }

  createDownloadUrl(
    key: string,
    fileName: string,
    contentType?: string,
  ): Promise<StorageDownloadAccess> {
    return this.provider.createDownloadUrl(key, fileName, contentType);
  }

  capabilities() {
    return {
      provider: this.providerName,
      configured: this.isConfigured(),
      mode: "s3-compatible-ready",
    };
  }
}
