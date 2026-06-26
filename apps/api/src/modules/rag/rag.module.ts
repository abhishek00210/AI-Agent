import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OpenAIEmbeddingProvider } from "../embedding/providers/openai-embedding.provider";
import { TenantModule } from "../tenant/tenant.module";
import { AnswerGenerationService } from "./answer-generation.service";
import { ContextBuilderService } from "./context-builder.service";
import { RagController } from "./rag.controller";
import { RagService } from "./rag.service";
import { RagRepository } from "./repositories/rag.repository";
import { RetrievalService } from "./retrieval.service";
import { SourceCitationService } from "./source-citation.service";

@Module({
  imports: [AuthModule, TenantModule],
  controllers: [RagController],
  providers: [
    RagService,
    RetrievalService,
    ContextBuilderService,
    AnswerGenerationService,
    SourceCitationService,
    RagRepository,
    OpenAIEmbeddingProvider,
  ],
  exports: [RetrievalService, ContextBuilderService, SourceCitationService, RagRepository],
})
export class RagModule {}
