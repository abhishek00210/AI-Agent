import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OpenAIEmbeddingProvider } from "../embedding/providers/openai-embedding.provider";
import { TenantModule } from "../tenant/tenant.module";
import { FaqController } from "./faq.controller";
import { FaqService } from "./faq.service";
import { FaqRepository } from "./repositories/faq.repository";

@Module({
  imports: [AuthModule, TenantModule],
  controllers: [FaqController],
  providers: [FaqService, FaqRepository, OpenAIEmbeddingProvider],
  exports: [FaqService, FaqRepository],
})
export class FaqModule {}
