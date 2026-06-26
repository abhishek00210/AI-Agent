import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { DocumentService } from "./document.service";
import { UploadPdfDto } from "./dto/document.dto";
import { FileUploadService } from "./file-upload.service";

@UseGuards(JwtAuthGuard)
@Controller("documents")
export class PdfUploadController {
  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly documentService: DocumentService,
    private readonly tenant: TenantService,
  ) {}

  @Post("upload")
  async uploadPdf(
    @CurrentUser() user: JwtPayload,
    @Req() request: FastifyRequest,
  ) {
    const part = await request.file();
    const fields = part?.fields as Record<string, { value?: unknown }> | undefined;
    const body: UploadPdfDto = {
      knowledgeBaseId: String(fields?.knowledgeBaseId?.value ?? ""),
      description:
        fields?.description?.value === undefined
          ? undefined
          : String(fields.description.value),
    };
    const buffer = part ? await part.toBuffer() : undefined;
    return this.fileUploadService.uploadPdf(
      this.tenant.fromUser(user),
      body,
      part && buffer
        ? {
            originalname: part.filename,
            mimetype: part.mimetype,
            size: buffer.length,
            buffer,
          }
        : undefined,
    );
  }

  @Get(":id/download")
  download(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) documentId: string) {
    return this.documentService.createDownloadAccess(this.tenant.fromUser(user), documentId);
  }
}
