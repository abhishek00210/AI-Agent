import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import {
  AssignPhoneNumberAgentDto,
  MarketplacePhoneNumberIdDto,
  PurchaseMarketplaceNumberDto,
  ReleaseMarketplaceNumberDto,
  SearchMarketplaceNumbersQueryDto,
} from "./dto/phone-number.dto";
import { PhoneNumberMarketplaceService } from "./phone-number-marketplace.service";

@UseGuards(JwtAuthGuard)
@Controller("voice/marketplace")
export class PhoneNumberMarketplaceController {
  constructor(
    private readonly marketplace: PhoneNumberMarketplaceService,
    private readonly tenant: TenantService,
  ) {}

  @Get("search")
  search(@CurrentUser() user: JwtPayload, @Query() query: SearchMarketplaceNumbersQueryDto) {
    return this.marketplace.search(this.tenant.fromUser(user), query);
  }

  @Post("purchase")
  purchase(@CurrentUser() user: JwtPayload, @Body() body: PurchaseMarketplaceNumberDto) {
    return this.marketplace.purchase(this.tenant.fromUser(user), body);
  }

  @Post("release")
  release(@CurrentUser() user: JwtPayload, @Body() body: ReleaseMarketplaceNumberDto) {
    return this.marketplace.release(this.tenant.fromUser(user), body.phoneNumberId);
  }

  @Post("assign-agent")
  assignAgent(
    @CurrentUser() user: JwtPayload,
    @Body() body: MarketplacePhoneNumberIdDto & AssignPhoneNumberAgentDto,
  ) {
    return this.marketplace.assignAgent(this.tenant.fromUser(user), body.phoneNumberId, body);
  }

  @Post("activate")
  activate(@CurrentUser() user: JwtPayload, @Body() body: MarketplacePhoneNumberIdDto) {
    return this.marketplace.activate(this.tenant.fromUser(user), body.phoneNumberId);
  }
}
