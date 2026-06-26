import { Injectable } from "@nestjs/common";
import { StorageService } from "../storage/storage.service";
import { RECORDING_MIME_TYPE, type FinalizeRecordingJob } from "./recording.types";
import { RecordingWriterService } from "./recording-writer.service";

@Injectable()
export class RecordingStorageService {
  constructor(
    private readonly storage: StorageService,
    private readonly writer: RecordingWriterService,
  ) {}

  async finalizeAndUpload(job: FinalizeRecordingJob) {
    const wavPath = job.rawPath.replace(/\.ulaw$/, ".wav");
    const fileName = `call-${job.callId}-recording.wav`;
    const wav = await this.writer.finalizeMulawToWav(job.rawPath, wavPath);
    const storagePath = this.storagePath(job);
    const upload = await this.storage.upload({
      key: storagePath,
      body: this.writer.createReadStream(wav.wavPath),
      contentType: RECORDING_MIME_TYPE,
      contentLength: wav.fileSizeBytes,
      metadata: {
        organizationId: job.organizationId,
        callId: job.callId,
        callSessionId: job.callSessionId,
        twilioCallSid: job.twilioCallSid,
      },
    });

    await this.writer.cleanup([job.rawPath, ...wav.segmentPaths, wav.wavPath]);

    return {
      fileName,
      storageProvider: upload.provider,
      storagePath: upload.key,
      durationSeconds: wav.durationSeconds,
      fileSizeBytes: wav.fileSizeBytes,
    };
  }

  private storagePath(job: FinalizeRecordingJob) {
    return `organizations/${job.organizationId}/calls/${job.callId}/recordings/${job.recordingId}.wav`;
  }
}
