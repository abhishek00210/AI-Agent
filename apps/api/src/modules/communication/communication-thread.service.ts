import { Injectable, NotFoundException } from "@nestjs/common";
import type { CommunicationChannel, CommunicationDirection } from "../../../generated/prisma";
import { CommunicationThreadRepository } from "./repositories/communication-thread.repository";

@Injectable()
export class CommunicationThreadService {
  constructor(private readonly threads: CommunicationThreadRepository) {}

  recordMessage(input: {
    organizationId: string;
    contactId: string;
    channel: CommunicationChannel;
    direction: CommunicationDirection;
    messageAt?: Date;
  }) {
    return this.threads.upsertThread({
      ...input,
      incrementUnread: input.direction === "INBOUND",
    });
  }

  markRead(organizationId: string, threadId: string) {
    return this.threads.markRead(organizationId, threadId);
  }

  async list(organizationId: string, page = 1, limit = 25) {
    const [total, data] = await this.threads.list(organizationId, page, limit);
    return { total, page, limit, data };
  }

  async details(organizationId: string, threadId: string) {
    const thread = await this.threads.findScoped(organizationId, threadId);
    if (!thread) throw new NotFoundException("Communication thread not found.");
    return thread;
  }
}
