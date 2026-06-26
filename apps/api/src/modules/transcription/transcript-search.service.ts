import { Injectable } from "@nestjs/common";
import type { TranscriptStatus } from "../../../generated/prisma";
import type { ListTranscriptsQueryDto } from "./dto/transcript.dto";
import { TranscriptRepository } from "./repositories/transcript.repository";

@Injectable()
export class TranscriptSearchService {
  constructor(private readonly transcripts: TranscriptRepository) {}

  list(organizationId: string, query: ListTranscriptsQueryDto) {
    return this.transcripts.list({
      organizationId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search?.trim() || undefined,
      status: query.status as TranscriptStatus | undefined,
      callId: query.callId,
      agentId: query.agentId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    });
  }
}
