import { Injectable } from "@nestjs/common";
import { AppointmentService, mapToolSource } from "../../appointment/appointment.service";
import { LeadService } from "../../lead/lead.service";
import { CommunicationService } from "../../communication/communication.service";
import type { ToolDefinition } from "../tool.types";
import { ToolExecutionRepository } from "../repositories/tool-execution.repository";
import {
  bookAppointmentSchema,
  builtInJsonSchemas,
  createLeadSchema,
  sendEmailSchema,
  sendSmsSchema,
} from "./tool-schemas";
import type { z } from "zod";

type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
type SendEmailInput = z.infer<typeof sendEmailSchema>;
type CreateLeadInput = z.infer<typeof createLeadSchema>;
type SendSmsInput = z.infer<typeof sendSmsSchema>;

@Injectable()
export class BuiltInToolsFactory {
  constructor(
    private readonly repository: ToolExecutionRepository,
    private readonly appointments: AppointmentService,
    private readonly leads: LeadService,
    private readonly communications: CommunicationService,
  ) {}

  tools(): ToolDefinition[] {
    return [
      {
        name: "book_appointment",
        displayName: "Book Appointment",
        description:
          "Book a local appointment for a customer after confirming date, time, timezone, phone, and email.",
        schema: bookAppointmentSchema,
        jsonSchema: builtInJsonSchemas.bookAppointment,
        execute: async (input, context) => {
          const result = await this.appointments.bookFromTool(context.tenant, {
            agentId: context.agentId ?? "",
            conversationId: context.conversationId,
            callId: context.callId,
            source: mapToolSource(context.source),
            customerName: input.customerName,
            phone: input.phone,
            email: input.email,
            preferredDate: input.preferredDate,
            preferredTime: input.preferredTime,
            timezone: input.timezone,
            notes: input.notes,
          });
          const { lead } = await this.leads.capture(context.tenant, {
            conversationId: context.conversationId,
            callId: context.callId,
            agentId: context.agentId,
            name: input.customerName,
            phone: input.phone,
            email: input.email,
            notes: input.notes,
            source: context.source,
          });
          return {
            success: true,
            message: result.message,
            data: {
              appointmentId: result.appointment.id,
              confirmationNumber: result.appointment.confirmationNumber,
              startTime: result.appointment.startTime.toISOString(),
              endTime: result.appointment.endTime.toISOString(),
              timezone: result.appointment.timezone,
              status: result.appointment.status,
              leadId: lead.id,
            },
          };
        },
      } satisfies ToolDefinition<BookAppointmentInput>,
      {
        name: "send_email",
        displayName: "Queue Email",
        description:
          "Queue an email for future delivery. This does not send email yet; delivery workers will be added later.",
        schema: sendEmailSchema,
        jsonSchema: builtInJsonSchemas.sendEmail,
        execute: async (input, context) => {
          const queued = await this.repository.createEmailQueue({
            organizationId: context.organizationId,
            conversationId: context.conversationId,
            to: input.to,
            subject: input.subject,
            body: input.body,
          });
          return {
            success: true,
            message: "Email queued.",
            data: { emailQueueId: queued.id, status: queued.status },
          };
        },
      } satisfies ToolDefinition<SendEmailInput>,
      {
        name: "create_lead",
        displayName: "Create Lead",
        description:
          "Create or update a contact, then create a lead linked to the active conversation or call.",
        schema: createLeadSchema,
        jsonSchema: builtInJsonSchemas.createLead,
        execute: async (input, context) => {
          const { contact, lead } = await this.leads.capture(context.tenant, {
            conversationId: context.conversationId,
            callId: context.callId,
            agentId: context.agentId,
            name: input.name,
            phone: input.phone,
            email: input.email,
            company: input.company,
            notes: input.notes,
            source: input.source,
          });
          let communicationMessageId: string | null = null;
          if (input.phone) {
            const acknowledgement = await this.communications.send(context.tenant, {
              phone: input.phone,
              message: `Thanks${input.name ? `, ${input.name}` : ""}. We received your request and will follow up shortly.`,
              metadata: { source: "LEAD_ACKNOWLEDGEMENT", leadId: lead.id },
            });
            communicationMessageId = acknowledgement.messageId;
          }
          return {
            success: true,
            message: "Lead created.",
            data: {
              contactId: contact.id,
              leadId: lead.id,
              status: lead.status,
              score: lead.score,
              communicationMessageId,
            },
          };
        },
      } satisfies ToolDefinition<CreateLeadInput>,
      {
        name: "send_sms",
        displayName: "Queue SMS",
        description: "Queue an SMS follow-up for background provider delivery.",
        schema: sendSmsSchema,
        jsonSchema: builtInJsonSchemas.sendSms,
        execute: async (input, context) => {
          const queued = await this.communications.send(context.tenant, {
            phone: input.phone,
            message: input.message,
            threadId: input.threadId,
            metadata: {
              source: "AI_TOOL",
              conversationId: context.conversationId ?? null,
              callId: context.callId ?? null,
            },
          });
          return {
            success: true,
            message: "SMS queued.",
            data: queued,
          };
        },
      } satisfies ToolDefinition<SendSmsInput>,
    ];
  }
}
