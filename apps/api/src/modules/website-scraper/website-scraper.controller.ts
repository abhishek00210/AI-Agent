import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { CreateWebsiteSourceDto, ListWebsiteSourcesQueryDto } from "./dto/website-source.dto";
import { WebsiteScraperQueue } from "./website-scraper.queue";
import { WebsiteScraperService } from "./website-scraper.service";

@UseGuards(JwtAuthGuard)
@Controller("website-sources")
export class WebsiteScraperController {
  private readonly logger = new Logger(WebsiteScraperController.name);

  constructor(
    private readonly websiteScraperService: WebsiteScraperService,
    private readonly queue: WebsiteScraperQueue,
    private readonly tenant: TenantService,
  ) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() body: CreateWebsiteSourceDto) {
    const source = await this.websiteScraperService.create(this.tenant.fromUser(user), body);
    void this.enqueueScrape({
      websiteSourceId: source.id,
      actorUserId: user.userId,
      kind: "initial",
    });
    return source;
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListWebsiteSourcesQueryDto) {
    return this.websiteScraperService.list(this.tenant.fromUser(user), query);
  }

  @Get(":id")
  details(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) sourceId: string) {
    return this.websiteScraperService.getById(this.tenant.fromUser(user), sourceId);
  }

  @Post(":id/rescrape")
  async rescrape(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) sourceId: string) {
    const source = await this.websiteScraperService.prepareRescrape(
      this.tenant.fromUser(user),
      sourceId,
    );
    void this.enqueueScrape({
      websiteSourceId: source.id,
      actorUserId: user.userId,
      kind: "rescrape",
    });
    return source;
  }

  @Delete(":id")
  delete(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) sourceId: string) {
    return this.websiteScraperService.delete(this.tenant.fromUser(user), sourceId);
  }

  private async enqueueScrape(input: {
    websiteSourceId: string;
    actorUserId?: string;
    kind: "initial" | "rescrape";
  }) {
    try {
      await this.queue.enqueue(input);
    } catch (error) {
      this.logger.warn(
        `Unable to enqueue website scrape ${input.websiteSourceId}: ${
          error instanceof Error ? error.message : "Unknown queue error"
        }`,
      );
    }
  }
}
