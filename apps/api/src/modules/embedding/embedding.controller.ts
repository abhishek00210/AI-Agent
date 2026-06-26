import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { ListChunksQueryDto } from "./dto/embedding.dto";
import { EmbeddingQueue } from "./embedding.queue";
import { EmbeddingService } from "./embedding.service";

@UseGuards(JwtAuthGuard)
@Controller("embeddings")
export class EmbeddingController {
  constructor(
    private readonly embeddings: EmbeddingService,
    private readonly queue: EmbeddingQueue,
    private readonly tenant: TenantService,
  ) {}

  @Post("process/document/:id")
  async processDocument(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    const context = this.tenant.fromUser(user);
    const status = await this.embeddings.prepareDocumentProcessing(context, id);
    await this.queue.enqueueDocument({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      documentId: id,
    });
    return status;
  }

  @Post("process/website/:id")
  async processWebsite(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    const context = this.tenant.fromUser(user);
    const status = await this.embeddings.prepareWebsiteProcessing(context, id);
    await this.queue.enqueueWebsite({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      websiteSourceId: id,
    });
    return status;
  }

  @Get("status/:id")
  status(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.embeddings.getStatus(this.tenant.fromUser(user), id);
  }

  @Get("stats/:knowledgeBaseId")
  stats(
    @CurrentUser() user: JwtPayload,
    @Param("knowledgeBaseId", ParseUUIDPipe) knowledgeBaseId: string,
  ) {
    return this.embeddings.stats(this.tenant.fromUser(user), knowledgeBaseId);
  }

  @Get("chunks/:knowledgeBaseId")
  chunks(
    @CurrentUser() user: JwtPayload,
    @Param("knowledgeBaseId", ParseUUIDPipe) knowledgeBaseId: string,
    @Query() query: ListChunksQueryDto,
  ) {
    return this.embeddings.listChunks(this.tenant.fromUser(user), knowledgeBaseId, query);
  }
}
