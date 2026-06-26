import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { TenantModule } from "../tenant/tenant.module";
import { DocumentController } from "./document.controller";
import { DocumentService } from "./document.service";
import { FileUploadService } from "./file-upload.service";
import { KnowledgeBaseController } from "./knowledge-base.controller";
import { KnowledgeBaseService } from "./knowledge-base.service";
import { PdfUploadController } from "./pdf-upload.controller";
import { DocumentRepository } from "./repositories/document.repository";
import { KnowledgeBaseRepository } from "./repositories/knowledge-base.repository";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [AuthModule, TenantModule, StorageModule, BillingModule],
  controllers: [KnowledgeBaseController, DocumentController, PdfUploadController],
  providers: [
    KnowledgeBaseService,
    DocumentService,
    FileUploadService,
    KnowledgeBaseRepository,
    DocumentRepository,
  ],
})
export class KnowledgeBaseModule {}
