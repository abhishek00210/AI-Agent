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
import { CreateFaqDto, ListFaqsQueryDto, UpdateFaqDto } from "./dto/faq.dto";
import { FaqService } from "./faq.service";

@UseGuards(JwtAuthGuard)
@Controller("faqs")
export class FaqController {
  constructor(
    private readonly faqs: FaqService,
    private readonly tenant: TenantService,
  ) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateFaqDto) {
    return this.faqs.create(this.tenant.fromUser(user), body);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListFaqsQueryDto) {
    return this.faqs.list(this.tenant.fromUser(user), query);
  }

  @Get(":id")
  details(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) faqId: string) {
    return this.faqs.getById(this.tenant.fromUser(user), faqId);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) faqId: string,
    @Body() body: UpdateFaqDto,
  ) {
    return this.faqs.update(this.tenant.fromUser(user), faqId, body);
  }

  @Delete(":id")
  delete(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) faqId: string) {
    return this.faqs.delete(this.tenant.fromUser(user), faqId);
  }
}
