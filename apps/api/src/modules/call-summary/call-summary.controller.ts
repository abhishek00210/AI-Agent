import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { CallSummaryService } from "./call-summary.service";
import { ListCallSummariesQueryDto } from "./dto/call-summary.dto";

@UseGuards(JwtAuthGuard)
@Controller()
export class CallSummaryController {
  constructor(
    private readonly summaries: CallSummaryService,
    private readonly tenant: TenantService,
  ) {}

  @Get("call-summaries")
  list(@CurrentUser() user: JwtPayload, @Query() query: ListCallSummariesQueryDto) {
    return this.summaries.list(this.tenant.fromUser(user), query);
  }

  @Get("call-summaries/:id")
  get(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.summaries.get(this.tenant.fromUser(user), id);
  }

  @Get("calls/:id/summary")
  getByCall(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) callId: string) {
    return this.summaries.getByCall(this.tenant.fromUser(user), callId);
  }

  @Get("customers/:id/summaries")
  getByCustomer(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) customerId: string,
    @Query("limit") limit?: string,
  ) {
    return this.summaries.getByCustomer(
      this.tenant.fromUser(user),
      customerId,
      limit ? Number(limit) : undefined,
    );
  }
}
