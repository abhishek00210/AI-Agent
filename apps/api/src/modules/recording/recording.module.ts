import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { TenantModule } from "../tenant/tenant.module";
import { TranscriptionModule } from "../transcription/transcription.module";
import { RecordingBufferService } from "./recording-buffer.service";
import { RecordingController } from "./recording.controller";
import { RecordingRepository } from "./repositories/recording.repository";
import { RecordingService } from "./recording.service";
import { RecordingStorageService } from "./recording-storage.service";
import { RecordingUploadWorker } from "./recording-upload-worker";
import { RecordingWriterService } from "./recording-writer.service";

@Module({
  imports: [AuthModule, TenantModule, StorageModule, TranscriptionModule],
  controllers: [RecordingController],
  providers: [
    RecordingService,
    RecordingBufferService,
    RecordingWriterService,
    RecordingStorageService,
    RecordingUploadWorker,
    RecordingRepository,
  ],
  exports: [RecordingService, RecordingBufferService],
})
export class RecordingModule {}
