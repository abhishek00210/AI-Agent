import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CallSummaryModule } from "../call-summary/call-summary.module";
import { OpenAiModule } from "../openai/openai.module";
import { StorageModule } from "../storage/storage.module";
import { TenantModule } from "../tenant/tenant.module";
import { TranscriptRepository } from "./repositories/transcript.repository";
import { SpeakerSegmentationService } from "./speaker-segmentation.service";
import { TranscriptController } from "./transcript.controller";
import { TranscriptSearchService } from "./transcript-search.service";
import { TranscriptSummaryService } from "./transcript-summary.service";
import { TranscriptWorker } from "./transcript.worker";
import { TranscriptionService } from "./transcription.service";

@Module({
  imports: [AuthModule, TenantModule, StorageModule, OpenAiModule, CallSummaryModule],
  controllers: [TranscriptController],
  providers: [
    TranscriptionService,
    TranscriptWorker,
    TranscriptRepository,
    TranscriptSearchService,
    TranscriptSummaryService,
    SpeakerSegmentationService,
  ],
  exports: [TranscriptionService, TranscriptWorker],
})
export class TranscriptionModule {}
