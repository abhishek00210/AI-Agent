import { Injectable } from "@nestjs/common";
import type { TenantContext } from "../tenant/tenant.service";
import { CallRepository } from "./repositories/call.repository";

@Injectable()
export class CallAnalyticsService {
  constructor(private readonly calls: CallRepository) {}

  stats(context: TenantContext) {
    return this.calls.stats(context.organizationId);
  }
}
