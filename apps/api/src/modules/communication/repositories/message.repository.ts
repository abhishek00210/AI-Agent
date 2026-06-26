import { Injectable } from "@nestjs/common";
import type {
  CommunicationDirection,
  CommunicationProvider,
  CommunicationStatus,
  Prisma,
} from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: {
    organizationId: string;
    threadId: string;
    direction: CommunicationDirection;
    body: string;
    phone: string;
    status?: CommunicationStatus;
    providerMessageId?: string;
    metadata?: Prisma.InputJsonValue;
    provider?: CommunicationProvider;
  }) {
    return this.prisma.communicationMessage.create({
      data: { ...input, provider: input.provider ?? "TWILIO", status: input.status ?? "QUEUED" },
      include: { thread: { include: { contact: true } } },
    });
  }

  findScoped(organizationId: string, messageId: string) {
    return this.prisma.communicationMessage.findFirst({
      where: { id: messageId, organizationId },
      include: { thread: { include: { contact: true } } },
    });
  }

  findByProviderId(providerMessageId: string) {
    return this.prisma.communicationMessage.findFirst({
      where: { providerMessageId },
      include: { thread: { include: { contact: true } } },
    });
  }

  list(input: {
    organizationId: string;
    threadId?: string;
    status?: CommunicationStatus;
    page: number;
    limit: number;
  }) {
    const where: Prisma.CommunicationMessageWhereInput = {
      organizationId: input.organizationId,
      ...(input.threadId ? { threadId: input.threadId } : {}),
      ...(input.status ? { status: input.status } : {}),
    };
    return this.prisma.$transaction([
      this.prisma.communicationMessage.count({ where }),
      this.prisma.communicationMessage.findMany({
        where,
        include: { thread: { include: { contact: true } } },
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
    ]);
  }

  markSending(organizationId: string, id: string) {
    return this.prisma.communicationMessage.update({
      where: { id, organizationId },
      data: { status: "SENDING" },
    });
  }

  markQueued(organizationId: string, id: string) {
    return this.prisma.communicationMessage.update({
      where: { id, organizationId },
      data: { status: "QUEUED", failedAt: null },
    });
  }

  markSent(
    organizationId: string,
    id: string,
    providerMessageId: string,
    provider?: CommunicationProvider,
  ) {
    return this.prisma.communicationMessage.update({
      where: { id, organizationId },
      data: {
        status: "SENT",
        providerMessageId,
        provider,
        sentAt: new Date(),
        failedAt: null,
      },
    });
  }

  async markFailed(organizationId: string, id: string, reason: string) {
    const current = await this.findScoped(organizationId, id);
    const metadata = isJsonObject(current?.metadata) ? current.metadata : {};
    return this.prisma.communicationMessage.update({
      where: { id, organizationId },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        metadata: { ...metadata, failureReason: reason.slice(0, 500) },
      },
    });
  }

  updateDelivery(id: string, status: CommunicationStatus, metadata?: Prisma.InputJsonValue) {
    return this.prisma.communicationMessage.update({
      where: { id },
      data: {
        status,
        ...(status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
        ...(status === "READ" ? { readAt: new Date() } : {}),
        ...(status === "FAILED" ? { failedAt: new Date() } : {}),
        ...(metadata ? { metadata } : {}),
      },
    });
  }

  findThread(organizationId: string, threadId: string) {
    return this.prisma.communicationThread.findFirst({
      where: { id: threadId, organizationId },
      include: { contact: true },
    });
  }

  findThreadById(threadId: string) {
    return this.prisma.communicationThread.findUnique({
      where: { id: threadId },
      include: { contact: true },
    });
  }

  findContact(organizationId: string, phone: string) {
    return this.prisma.contact.findFirst({ where: { organizationId, phone, deletedAt: null } });
  }

  createContact(organizationId: string, phone: string) {
    return this.prisma.contact.create({ data: { organizationId, name: phone, phone } });
  }

  sendingNumber(organizationId: string) {
    return this.prisma.phoneNumber.findFirst({
      where: {
        organizationId,
        status: "ACTIVE",
        deletedAt: null,
        capabilities: { path: ["sms"], equals: true },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  receivingNumber(phoneNumber: string) {
    return this.prisma.phoneNumber.findFirst({
      where: { phoneNumber, status: "ACTIVE", deletedAt: null },
      select: { organizationId: true, phoneNumber: true },
    });
  }

  findAutomation(organizationId: string, appointmentId: string, automationType: string) {
    return this.prisma.communicationMessage.findFirst({
      where: {
        organizationId,
        metadata: { path: ["appointmentId"], equals: appointmentId },
        AND: { metadata: { path: ["automationType"], equals: automationType } },
      },
    });
  }

  audit(input: {
    organizationId: string;
    action: string;
    entityId: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditEvent.create({
      data: { ...input, entityType: "CommunicationMessage" },
    });
  }
}

function isJsonObject(value: Prisma.JsonValue | undefined): value is Prisma.JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
