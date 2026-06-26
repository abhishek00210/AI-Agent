import { Injectable, NotFoundException } from "@nestjs/common";
import type { TenantContext } from "../tenant/tenant.service";
import { MessageRepository } from "./repositories/message.repository";
import { SmsQueueService } from "./sms-queue.service";

@Injectable()
export class RetryService {
  constructor(
    private readonly messages: MessageRepository,
    private readonly queue: SmsQueueService,
  ) {}

  async retry(context: TenantContext, messageId: string) {
    const message = await this.messages.findScoped(context.organizationId, messageId);
    if (!message) throw new NotFoundException("Communication message not found.");
    await this.messages.markQueued(context.organizationId, messageId);
    await this.queue.enqueue("RetrySMS", { organizationId: context.organizationId, messageId });
    return { messageId, status: "QUEUED" as const };
  }
}
