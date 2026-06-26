import { BadRequestException, Injectable, Optional } from "@nestjs/common";
import { CustomerResolverService } from "../customer/customer-resolver.service";
import type { Prisma } from "../../../generated/prisma";
import { normalizeLeadEmail, normalizeLeadPhone, splitContactName } from "./lead-normalization";
import { LeadRepository } from "./repositories/lead.repository";

@Injectable()
export class ContactResolver {
  constructor(private readonly leads: LeadRepository, @Optional() private readonly customers?: CustomerResolverService) {}

  async resolve(input: {
    organizationId: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    company?: string | null;
    notes?: string | null;
    countryCode?: string | null;
    tags?: string[];
    metadata?: Prisma.InputJsonValue;
  }) {
    const phone = normalizeLeadPhone(input.phone, input.countryCode);
    const email = normalizeLeadEmail(input.email);
    if (!phone && !email) {
      throw new BadRequestException("Lead capture requires a phone number or email.");
    }

    const { firstName, lastName } = splitContactName(input.name);
    const payload = {
      organizationId: input.organizationId,
      name: input.name.trim(),
      firstName,
      lastName,
      phone,
      email,
      company: input.company?.trim() || null,
      notes: input.notes?.trim() || null,
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
    };

    const existing = await this.leads.findContactByPhoneOrEmail(input.organizationId, phone, email);
    if (existing) {
      const contact = await this.leads.updateContact(existing.id, payload);
      await this.profile(contact, payload);
      return contact;
    }

    try {
      const contact = await this.leads.createContact(payload);
      await this.profile(contact, payload);
      return contact;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const raced = await this.leads.findContactByPhoneOrEmail(input.organizationId, phone, email);
      if (!raced) throw error;
      const contact = await this.leads.updateContact(raced.id, payload);
      await this.profile(contact, payload);
      return contact;
    }
  }

  private profile(contact: { id: string }, input: { organizationId: string; name: string; phone: string | null; email: string | null; company: string | null; notes: string | null }) {
    return this.customers?.resolveCustomer({ ...input, contactId: contact.id, interaction: "PROFILE" }) ?? Promise.resolve();
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code?: unknown }).code) === "P2002"
  );
}
