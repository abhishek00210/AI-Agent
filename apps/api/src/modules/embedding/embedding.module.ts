import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { TenantModule } from "../tenant/tenant.module";
import { ChunkingService } from "./chunking.service";
import { EmbeddingController } from "./embedding.controller";
import { EmbeddingQueue } from "./embedding.queue";
import { EmbeddingService } from "./embedding.service";
import { PdfTextExtractionService } from "./pdf-text-extraction.service";
import { OpenAIEmbeddingProvider } from "./providers/openai-embedding.provider";
import { EmbeddingRepository } from "./repositories/embedding.repository";

@Module({
  imports: [AuthModule, TenantModule, StorageModule],
  controllers: [EmbeddingController],
  providers: [
    EmbeddingService,
    EmbeddingQueue,
    ChunkingService,
    PdfTextExtractionService,
    OpenAIEmbeddingProvider,
    EmbeddingRepository,
  ],
})
export class EmbeddingModule {}
