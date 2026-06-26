import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { WebsiteSourceRepository } from "./repositories/website-source.repository";
import { UrlSafetyService } from "./url-safety.service";
import { WebsiteExtractionService } from "./website-extraction.service";
import { WebsiteScraperController } from "./website-scraper.controller";
import { WebsiteScraperQueue } from "./website-scraper.queue";
import { WebsiteScraperService } from "./website-scraper.service";

@Module({
  imports: [AuthModule, TenantModule],
  controllers: [WebsiteScraperController],
  providers: [
    WebsiteScraperService,
    WebsiteExtractionService,
    WebsiteScraperQueue,
    UrlSafetyService,
    WebsiteSourceRepository,
  ],
})
export class WebsiteScraperModule {}
