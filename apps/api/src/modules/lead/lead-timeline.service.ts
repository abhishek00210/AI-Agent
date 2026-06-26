import { Injectable } from "@nestjs/common";
import type { Prisma, TimelineEventType } from "../../../generated/prisma";
import { LeadRepository } from "./repositories/lead.repository";

@Injectable()
export class LeadTimelineService {
  constructor(private readonly leads: LeadRepository) {}

  create(input: {
    organizationId: string;
    leadId: string;
    type: TimelineEventType;
    title: string;
    description?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.leads.createTimelineEvent(input);
  }
}
