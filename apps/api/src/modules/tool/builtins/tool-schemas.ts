import { z } from "zod";
import type { ToolJsonSchema } from "../tool.types";

export const bookAppointmentSchema = z.object({
  customerName: z.string().min(1).max(120),
  phone: z.string().min(7).max(32),
  email: z.string().email(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().min(1).max(80),
  notes: z.string().max(2000).optional(),
});

export const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

export const createLeadSchema = z
  .object({
    name: z.string().min(1).max(120),
    phone: z.string().min(7).max(32).optional(),
    email: z.string().email().optional(),
    company: z.string().max(160).optional(),
    notes: z.string().max(2000).optional(),
    source: z.string().max(80).optional(),
  })
  .refine((value) => Boolean(value.phone || value.email), {
    message: "Either phone or email is required.",
    path: ["phone"],
  });

export const sendSmsSchema = z.object({
  phone: z.string().min(7).max(32),
  message: z.string().min(1).max(1000),
  threadId: z.string().uuid().optional(),
});

export function objectSchema(
  properties: ToolJsonSchema["properties"],
  required: string[],
): ToolJsonSchema {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

export const builtInJsonSchemas = {
  bookAppointment: objectSchema(
    {
      customerName: { type: "string", description: "Customer full name." },
      phone: { type: "string", description: "Customer phone number." },
      email: { type: "string", format: "email", description: "Customer email address." },
      preferredDate: {
        type: "string",
        description: "Requested appointment date as YYYY-MM-DD in the customer's timezone.",
      },
      preferredTime: {
        type: "string",
        description: "Requested appointment start time as HH:mm in 24-hour local time.",
      },
      timezone: {
        type: "string",
        description: "IANA timezone for the appointment, for example America/Toronto.",
      },
      notes: { type: "string", description: "Relevant appointment notes." },
    },
    ["customerName", "phone", "email", "preferredDate", "preferredTime", "timezone"],
  ),
  sendEmail: objectSchema(
    {
      to: { type: "string", format: "email" },
      subject: { type: "string" },
      body: { type: "string" },
    },
    ["to", "subject", "body"],
  ),
  createLead: objectSchema(
    {
      name: { type: "string" },
      phone: { type: "string" },
      email: { type: "string", format: "email" },
      company: { type: "string" },
      notes: { type: "string" },
      source: { type: "string" },
    },
    ["name"],
  ),
  sendSms: objectSchema(
    {
      phone: { type: "string" },
      message: { type: "string" },
      threadId: { type: "string", description: "Optional existing communication thread ID." },
    },
    ["phone", "message"],
  ),
} satisfies Record<string, ToolJsonSchema>;
