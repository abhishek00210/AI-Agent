import { HttpException, HttpStatus, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { CommunicationStatus, Prisma } from "../../../generated/prisma";
import { RedisService } from "../../redis/redis.service";
import type { TenantContext } from "../tenant/tenant.service";
import { normalizeE164 } from "../voice/e164";
import { CommunicationThreadService } from "./communication-thread.service";
import { MessageRepository } from "./repositories/message.repository";
import { SmsQueueService } from "./sms-queue.service";
import { FeatureGateService } from "../billing/feature-gate.service";
import { CustomerResolverService } from "../customer/customer-resolver.service";

@Injectable()
export class CommunicationService {
  constructor(
    private readonly messages: MessageRepository,
    private readonly threads: CommunicationThreadService,
    private readonly queue: SmsQueueService,
    private readonly redis: RedisService,
    @Optional() private readonly gates?: FeatureGateService,
    @Optional() private readonly customers?: CustomerResolverService,
  ) {}

  async send(
    context: TenantContext,
    input: {
      phone: string;
      message: string;
      threadId?: string;
      metadata?: Prisma.InputJsonValue;
      delayMs?: number;
      jobName?: "SendSMS" | "ReminderSMS";
    },
  ) {
    await this.gates?.assertAvailable(context.organizationId, "sms");
    await this.enforceRateLimit(context.organizationId);
    const phone = normalizeE164(input.phone);
    const existingThread = input.threadId
      ? await this.messages.findThread(context.organizationId, input.threadId)
      : null;
    if (input.threadId && !existingThread)
      throw new NotFoundException("Communication thread not found.");
    if (existingThread && existingThread.contact.phone !== phone)
      throw new NotFoundException("Thread does not belong to this phone number.");
    let threadId: string;
    if (!existingThread) {
      const contact =
        (await this.messages.findContact(context.organizationId, phone)) ??
        (await this.messages.createContact(context.organizationId, phone));
      const createdThread = await this.threads.recordMessage({
        organizationId: context.organizationId,
        contactId: contact.id,
        channel: "SMS",
        direction: "OUTBOUND",
      });
      threadId = createdThread.id;
    } else {
      await this.threads.recordMessage({
        organizationId: context.organizationId,
        contactId: existingThread.contactId,
        channel: "SMS",
        direction: "OUTBOUND",
      });
      threadId = existingThread.id;
    }
    const message = await this.messages.create({
      organizationId: context.organizationId,
      threadId,
      direction: "OUTBOUND",
      body: input.message.trim(),
      phone,
      metadata: input.metadata,
    });
    await this.messages.audit({
      organizationId: context.organizationId,
      action: "sms.queued",
      entityId: message.id,
      metadata: input.metadata,
    });
    await this.queue.enqueue(
      input.jobName ?? "SendSMS",
      { organizationId: context.organizationId, messageId: message.id },
      input.delayMs ?? 0,
    );
    const contactId =
      existingThread?.contactId ??
      (await this.messages.findThread(context.organizationId, threadId))?.contactId;
    if (contactId) {
      await this.customers?.resolveCustomer({
        organizationId: context.organizationId,
        contactId,
        phone,
        interaction: "MESSAGE",
      });
    }
    return {
      messageId: message.id,
      threadId,
      status: message.status,
      provider: message.provider,
    };
  }

  async scheduleAppointmentMessages(
    context: TenantContext,
    appointment: {
      id: string;
      confirmationNumber: string;
      startTime: Date;
      timezone: string;
      contact?: { phone: string | null; name: string } | null;
      suppressReminder?: boolean;
    },
  ) {
    if (!appointment.contact?.phone) return;
    const confirmationExists = await this.messages.findAutomation(
      context.organizationId,
      appointment.id,
      "APPOINTMENT_CONFIRMATION",
    );
    if (!confirmationExists) {
      await this.send(context, {
        phone: appointment.contact.phone,
        message: `Your appointment is confirmed. Confirmation: ${appointment.confirmationNumber}. Scheduled for ${formatAppointment(appointment.startTime, appointment.timezone)}.`,
        metadata: { appointmentId: appointment.id, automationType: "APPOINTMENT_CONFIRMATION" },
      });
    }
    if (appointment.suppressReminder) return;
    const reminderAt = appointment.startTime.getTime() - 24 * 60 * 60 * 1000;
    if (reminderAt > Date.now()) {
      const reminderExists = await this.messages.findAutomation(
        context.organizationId,
        appointment.id,
        "APPOINTMENT_REMINDER",
      );
      if (!reminderExists) {
        await this.send(context, {
          phone: appointment.contact.phone,
          message: `Reminder: your appointment is tomorrow at ${formatAppointment(appointment.startTime, appointment.timezone)}. Confirmation: ${appointment.confirmationNumber}.`,
          metadata: { appointmentId: appointment.id, automationType: "APPOINTMENT_REMINDER" },
          delayMs: reminderAt - Date.now(),
          jobName: "ReminderSMS",
        });
      }
    }
  }

  async listMessages(
    context: TenantContext,
    query: { page?: number; limit?: number; threadId?: string; status?: string },
  ) {
    if (query.threadId && !(await this.messages.findThread(context.organizationId, query.threadId)))
      throw new NotFoundException("Communication thread not found.");
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const [total, data] = await this.messages.list({
      organizationId: context.organizationId,
      threadId: query.threadId,
      status: query.status as CommunicationStatus | undefined,
      page,
      limit,
    });
    return { total, page, limit, data };
  }

  async getMessage(context: TenantContext, messageId: string) {
    const message = await this.messages.findScoped(context.organizationId, messageId);
    if (!message) throw new NotFoundException("Communication message not found.");
    return message;
  }

  private async enforceRateLimit(organizationId: string) {
    if (!this.redis.isAvailable) return;
    try {
      const key = `sms:rate:${organizationId}:${Math.floor(Date.now() / 60_000)}`;
      const count = await this.redis.rateLimitStore.incr(key);
      if (count === 1) await this.redis.rateLimitStore.expire(key, 70);
      if (count > 60)
        throw new HttpException("SMS rate limit exceeded.", HttpStatus.TOO_MANY_REQUESTS);
    } catch (error) {
      if (error instanceof HttpException) throw error;
    }
  }
}

function formatAppointment(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
