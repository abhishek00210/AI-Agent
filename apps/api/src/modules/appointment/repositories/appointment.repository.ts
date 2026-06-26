import { Injectable } from "@nestjs/common";
import type { AppointmentSource, AppointmentStatus, Prisma } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

export interface ListAppointmentsOptions {
  organizationId: string;
  page: number;
  limit: number;
  search?: string;
  status?: AppointmentStatus;
  agentId?: string;
  contactId?: string;
  callId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

@Injectable()
export class AppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAgent(organizationId: string, agentId: string) {
    return this.prisma.agent.findFirst({
      where: { id: agentId, organizationId, deletedAt: null },
      select: { id: true, name: true, status: true },
    });
  }

  findContact(organizationId: string, contactId: string) {
    return this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      select: { id: true, name: true, phone: true, email: true },
    });
  }

  findConversation(organizationId: string, conversationId: string) {
    return this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId, deletedAt: null },
      select: { id: true, agentId: true },
    });
  }

  findCall(organizationId: string, callId: string) {
    return this.prisma.call.findFirst({
      where: { id: callId, organizationId },
      select: { id: true, agentId: true },
    });
  }

  async list(options: ListAppointmentsOptions) {
    const where: Prisma.AppointmentWhereInput = {
      organizationId: options.organizationId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.agentId ? { agentId: options.agentId } : {}),
      ...(options.contactId ? { contactId: options.contactId } : {}),
      ...(options.callId ? { callId: options.callId } : {}),
      ...(options.search
        ? {
            OR: [
              { title: { contains: options.search, mode: "insensitive" } },
              { confirmationNumber: { contains: options.search, mode: "insensitive" } },
              { notes: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(options.dateFrom || options.dateTo
        ? {
            startTime: {
              ...(options.dateFrom ? { gte: options.dateFrom } : {}),
              ...(options.dateTo ? { lte: options.dateTo } : {}),
            },
          }
        : {}),
    };
    const skip = (options.page - 1) * options.limit;
    const [total, data] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where,
        orderBy: { startTime: "asc" },
        skip,
        take: options.limit,
        include: appointmentInclude,
      }),
    ]);
    return { total, data };
  }

  findById(organizationId: string, appointmentId: string) {
    return this.prisma.appointment.findFirst({
      where: { id: appointmentId, organizationId },
      include: appointmentInclude,
    });
  }

  findByIdempotencyKey(organizationId: string, idempotencyKey: string) {
    return this.prisma.appointment.findUnique({
      where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } },
      include: appointmentInclude,
    });
  }

  createTransactional(input: {
    organizationId: string;
    agentId: string;
    contactId?: string | null;
    conversationId?: string | null;
    callId?: string | null;
    title: string;
    description?: string | null;
    status: AppointmentStatus;
    timezone: string;
    startTime: Date;
    endTime: Date;
    source: AppointmentSource;
    confirmationNumber: string;
    idempotencyKey?: string | null;
    notes?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.$transaction(
      async (tx) =>
        tx.appointment.create({
          data: input,
          include: appointmentInclude,
        }),
      { isolationLevel: "Serializable" },
    );
  }

  update(organizationId: string, appointmentId: string, data: Prisma.AppointmentUpdateInput) {
    return this.prisma.appointment.update({
      where: { id: appointmentId, organizationId },
      data,
      include: appointmentInclude,
    });
  }

  cancel(organizationId: string, appointmentId: string) {
    return this.update(organizationId, appointmentId, { status: "CANCELLED" });
  }

  createAuditEvent(input: {
    organizationId: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditEvent.create({ data: input });
  }
}

export const appointmentInclude = {
  agent: { select: { id: true, name: true, status: true } },
  contact: { select: { id: true, name: true, phone: true, email: true } },
  conversation: { select: { id: true, status: true, channel: true, source: true } },
  call: { select: { id: true, twilioCallSid: true, callerNumber: true, calledNumber: true } },
} satisfies Prisma.AppointmentInclude;
