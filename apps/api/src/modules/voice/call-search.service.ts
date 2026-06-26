import { Injectable } from "@nestjs/common";
import type {
  CallDirection,
  CallEndReason,
  CallSource,
  CallStatus,
} from "../../../generated/prisma";
import type { ListCallsQueryDto } from "./dto/call.dto";

@Injectable()
export class CallSearchService {
  toRepositoryOptions(organizationId: string, query: ListCallsQueryDto) {
    return {
      organizationId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      cursor: query.cursor,
      search: normalizeOptionalText(query.search) ?? undefined,
      status: query.status as CallStatus | undefined,
      direction: query.direction as CallDirection | undefined,
      source: query.source as CallSource | undefined,
      endReason: query.endReason as CallEndReason | undefined,
      agentId: query.agentId,
      phoneNumberId: query.phoneNumberId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      durationMin: query.durationMin,
      durationMax: query.durationMax,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };
  }
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
