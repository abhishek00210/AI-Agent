import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  StorageDownloadAccess,
  StorageDownloadResult,
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
} from "./storage.provider";

const DOWNLOAD_URL_EXPIRES_IN_SECONDS = 300;

@Injectable()
export class S3StorageProvider implements StorageProvider {
  providerName = "s3-compatible" as const;
  private readonly client: S3Client;

  constructor(private readonly config: ConfigService) {
    this.client = new S3Client({
      region: this.config.get<string>("storage.region") ?? "us-east-1",
      endpoint: this.config.get<string>("storage.endpoint") || undefined,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.get<string>("storage.accessKeyId") ?? "",
        secretAccessKey: this.config.get<string>("storage.secretAccessKey") ?? "",
      },
    });
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>("storage.bucket") &&
      this.config.get<string>("storage.accessKeyId") &&
      this.config.get<string>("storage.secretAccessKey"),
    );
  }

  bucketName(): string {
    return this.config.get<string>("storage.bucket") ?? "";
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    this.assertConfigured();

    const result = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName(),
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
        Metadata: input.metadata,
      }),
    );

    return {
      key: input.key,
      bucket: this.bucketName(),
      provider: this.providerName,
      etag: result.ETag,
    };
  }

  async download(key: string): Promise<StorageDownloadResult> {
    this.assertConfigured();

    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucketName(),
        Key: key,
      }),
    );

    if (!result.Body) {
      throw new ServiceUnavailableException("Stored object did not return a body.");
    }

    return {
      body: Buffer.from(await result.Body.transformToByteArray()),
      contentType: result.ContentType,
      contentLength: result.ContentLength,
    };
  }

  async downloadToFile(key: string, destinationPath: string): Promise<void> {
    this.assertConfigured();
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucketName(),
        Key: key,
      }),
    );
    if (!result.Body) {
      throw new ServiceUnavailableException("Stored object did not return a body.");
    }
    await pipeline(result.Body as unknown as Readable, createWriteStream(destinationPath));
  }

  async delete(key: string): Promise<void> {
    this.assertConfigured();

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName(),
        Key: key,
      }),
    );
  }

  async createDownloadUrl(
    key: string,
    fileName: string,
    contentType = "application/pdf",
  ): Promise<StorageDownloadAccess> {
    this.assertConfigured();

    const command = new GetObjectCommand({
      Bucket: this.bucketName(),
      Key: key,
      ResponseContentType: contentType,
      ResponseContentDisposition: `attachment; filename="${sanitizeFileName(fileName)}"`,
    });

    return {
      url: await getSignedUrl(this.client, command, {
        expiresIn: DOWNLOAD_URL_EXPIRES_IN_SECONDS,
      }),
      expiresInSeconds: DOWNLOAD_URL_EXPIRES_IN_SECONDS,
    };
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException("Object storage is not configured.");
    }
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}
