import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { DocumentService } from "./document.service";
import { CreateDocumentDto, ListDocumentsQueryDto, UpdateDocumentDto } from "./dto/document.dto";

@UseGuards(JwtAuthGuard)
@Controller("documents")
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly tenant: TenantService,
  ) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateDocumentDto) {
    return this.documentService.create(this.tenant.fromUser(user), body);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListDocumentsQueryDto) {
    return this.documentService.list(this.tenant.fromUser(user), query);
  }

  @Get(":id")
  details(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) documentId: string) {
    return this.documentService.getById(this.tenant.fromUser(user), documentId);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) documentId: string,
    @Body() body: UpdateDocumentDto,
  ) {
    return this.documentService.update(this.tenant.fromUser(user), documentId, body);
  }

  @Delete(":id")
  delete(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) documentId: string) {
    return this.documentService.delete(this.tenant.fromUser(user), documentId);
  }
}
