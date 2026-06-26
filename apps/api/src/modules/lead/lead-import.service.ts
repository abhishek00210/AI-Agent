import { BadRequestException, Injectable, NotFoundException, Optional, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parse } from "csv-parse/sync";
import type { Prisma } from "../../../generated/prisma";
import { AnalyticsService } from "../analytics/analytics.service";
import { CampaignService } from "../campaign/campaign.service";
import { CampaignScheduleTypeDto, CampaignTypeDto } from "../campaign/dto/campaign.dto";
import type { TenantContext } from "../tenant/tenant.service";
import { UsageService } from "../usage/usage.service";
import { OrganizationLocaleService } from "../organization-locale/organization-locale.service";
import { normalizeLeadEmail, normalizeLeadPhone } from "./lead-normalization";
import { LeadSourceDto, type CreateCampaignFromLeadImportDto } from "./dto/lead.dto";
import { LeadRepository } from "./repositories/lead.repository";
import { LeadService } from "./lead.service";

const MAX_IMPORT_SIZE_BYTES = Number(process.env.LEAD_IMPORT_MAX_BYTES ?? 5 * 1024 * 1024);
const MAX_PREVIEW_ROWS = 50;
const IMPORTABLE_FIELDS = ["name", "phone", "email", "company", "address", "notes", "source", "status", "tags"] as const;
type ImportableField = typeof IMPORTABLE_FIELDS[number];

export interface UploadedLeadCsv {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface ParsedRow {
  index: number;
  raw: Record<string, string>;
  normalized?: {
    name: string;
    phone: string | null;
    email: string | null;
    company: string | null;
    address: string | null;
    notes: string | null;
    tags: string[];
  };
  errors: string[];
  duplicate: boolean;
}

@Injectable()
export class LeadImportService {
  constructor(
    private readonly repository: LeadRepository,
    private readonly leads: LeadService,
    private readonly config: ConfigService,
    @Optional() private readonly usage?: UsageService,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() private readonly campaigns?: CampaignService,
    @Optional() private readonly locales?: OrganizationLocaleService,
  ) {}

  async uploadPreview(context: TenantContext, file?: UploadedLeadCsv) {
    this.validateCsv(file);
    const records = parse(file.buffer.toString("utf8"), {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
    }) as Record<string, string>[];
    if (!records.length) throw new BadRequestException("CSV must contain at least one data row.");
    const headers = Object.keys(records[0] ?? {});
    const mapping = await this.mapColumns(headers);
    const phoneRegion = await this.locales?.getPhoneRegion(context.organizationId);
    const rows = await this.validateRows(context.organizationId, records, mapping, phoneRegion);
    const failedRows = rows.filter((row) => row.errors.length > 0);
    const duplicateRows = rows.filter((row) => row.duplicate);
    const validRows = rows.filter((row) => !row.errors.length && !row.duplicate);
    const leadImport = await this.repository.createLeadImport({
      organizationId: context.organizationId,
      createdBy: context.userId,
      fileName: sanitizeFileName(file.originalname),
      fileSizeBytes: file.size,
      mapping: mapping as Prisma.InputJsonValue,
      previewRows: rows as unknown as Prisma.InputJsonValue,
      failedRows: failedRows.slice(0, MAX_PREVIEW_ROWS) as unknown as Prisma.InputJsonValue,
      duplicateRows: duplicateRows.slice(0, MAX_PREVIEW_ROWS) as unknown as Prisma.InputJsonValue,
      rowsFound: rows.length,
      rowsValid: validRows.length,
      rowsInvalid: failedRows.length,
      rowsDuplicate: duplicateRows.length,
    });
    await Promise.all([
      this.usage?.increment({ organizationId: context.organizationId, resourceType: "CSV_UPLOADS", idempotencyKey: `lead-import:csv:${leadImport.id}` }),
      this.repository.createAuditEvent({ organizationId: context.organizationId, actorUserId: context.userId, action: "lead_import.csv_uploaded", entityType: "LeadImport", entityId: leadImport.id, metadata: { rows: rows.length } }),
    ]);
    return summarizeImport(leadImport);
  }

  list(context: TenantContext, limit?: number) {
    return this.repository.listLeadImports(context.organizationId, limit);
  }

  async get(context: TenantContext, id: string) {
    const row = await this.repository.findLeadImport(context.organizationId, id);
    if (!row) throw new NotFoundException("Lead import not found.");
    return summarizeImport(row);
  }

  async confirm(context: TenantContext, id: string, duplicateStrategy: "SKIP" | "UPDATE_EXISTING" | "CREATE_NEW") {
    const leadImport = await this.repository.findLeadImport(context.organizationId, id);
    if (!leadImport) throw new NotFoundException("Lead import not found.");
    if (!["PREVIEWED", "FAILED"].includes(leadImport.status)) {
      throw new BadRequestException("Only previewed imports can be confirmed.");
    }
    const previewRows = (leadImport.previewRows as unknown as ParsedRow[]);
    const rows = previewRows.filter((row) => row.normalized && row.errors.length === 0);
    let imported = 0;
    let failed = 0;
    const failures: Array<{ row: number; reason: string }> = [];
    await this.repository.updateLeadImport(context.organizationId, id, { status: "PROCESSING", importOptions: { duplicateStrategy } });
    for (const row of rows) {
      if (!row.normalized) continue;
      try {
        // Contacts are the stable customer identity, so a true duplicate cannot
        // safely become a second lead with the same phone/email. CREATE_NEW
        // therefore creates only non-duplicate rows and skips detected matches.
        if (row.duplicate && (duplicateStrategy === "SKIP" || duplicateStrategy === "CREATE_NEW")) continue;
        await this.leads.create(context, {
          name: row.normalized.name,
          phone: row.normalized.phone ?? undefined,
          email: row.normalized.email ?? undefined,
          company: row.normalized.company ?? undefined,
          address: row.normalized.address ?? undefined,
          notes: row.normalized.notes ?? undefined,
          source: LeadSourceDto.IMPORT,
          tags: row.normalized.tags,
          customFields: { importId: id, duplicateStrategy },
        });
        imported += 1;
      } catch (error) {
        failed += 1;
        failures.push({ row: row.index, reason: error instanceof Error ? error.message : "Import failed" });
      }
    }
    const completed = await this.repository.updateLeadImport(context.organizationId, id, {
      status: failed ? "FAILED" : "COMPLETED",
      rowsProcessed: rows.length,
      rowsImported: imported,
      rowsFailed: failed,
      duplicates: leadImport.rowsDuplicate,
      failedRows: failures as Prisma.InputJsonValue,
      completedAt: new Date(),
      failureReason: failed ? `${failed} rows failed during import.` : null,
    });
    await Promise.all([
      this.usage?.increment({ organizationId: context.organizationId, resourceType: "LEAD_IMPORTS", idempotencyKey: `lead-import:confirmed:${id}` }),
      imported ? this.usage?.increment({ organizationId: context.organizationId, resourceType: "IMPORTED_LEADS", quantity: imported, idempotencyKey: `lead-import:leads:${id}` }) : undefined,
      this.analytics?.record({ organizationId: context.organizationId, eventType: "LEAD_CREATED", idempotencyKey: `lead-import:analytics:${id}`, metadata: { imported, failed, source: "IMPORT" } }),
      this.repository.createAuditEvent({ organizationId: context.organizationId, actorUserId: context.userId, action: failed ? "lead_import.failed" : "lead_import.completed", entityType: "LeadImport", entityId: id, metadata: { imported, failed } }),
    ]);
    return summarizeImport(completed);
  }

  async createCampaign(context: TenantContext, id: string, input: CreateCampaignFromLeadImportDto) {
    if (!this.campaigns) throw new ServiceUnavailableException("Campaign service is unavailable.");
    const leadImport = await this.repository.findLeadImport(context.organizationId, id);
    if (!leadImport) throw new NotFoundException("Lead import not found.");
    if (leadImport.status !== "COMPLETED") throw new BadRequestException("Import must be completed before creating a campaign.");
    const leads = await this.repository.listLeads({ organizationId: context.organizationId, limit: 10_000, source: "IMPORT", search: undefined });
    const customerProfileIds = leads
      .filter((lead) => {
        const metadata = lead.metadata as Record<string, unknown> | null;
        const customFields = metadata?.customFields as Record<string, unknown> | undefined;
        return metadata?.importId === id || customFields?.importId === id;
      })
      .map((lead) => lead.contact.customerProfile?.id)
      .filter(Boolean) as string[];
    if (!customerProfileIds.length) throw new BadRequestException("No imported leads are available for campaign creation.");
    const estimatedMinutes = customerProfileIds.length * 3;
    const campaign = await this.campaigns.create(context, {
      name: input.name,
      description: input.description ?? `Campaign created from lead import ${leadImport.fileName}`,
      campaignType: (input.campaignType ?? CampaignTypeDto.FOLLOW_UP) as CampaignTypeDto,
      assignedAgentId: input.assignedAgentId,
      scheduleType: (input.scheduleType ?? CampaignScheduleTypeDto.IMMEDIATE) as CampaignScheduleTypeDto,
      scheduledAt: input.scheduledAt,
      maxAttempts: input.maxAttempts ?? 1,
      customerProfileIds,
    });
    const updated = await this.repository.updateLeadImport(context.organizationId, id, { campaign: { connect: { id: campaign.id } } });
    await this.repository.createAuditEvent({ organizationId: context.organizationId, actorUserId: context.userId, action: "lead_import.campaign_created", entityType: "LeadImport", entityId: id, metadata: { campaignId: campaign.id, targets: customerProfileIds.length, estimatedMinutes } });
    return { import: summarizeImport(updated), campaign, estimate: { leadCount: customerProfileIds.length, estimatedCalls: customerProfileIds.length, estimatedMinutes, estimatedCost: null, confirmationRequired: true } };
  }

  private validateCsv(file?: UploadedLeadCsv): asserts file is UploadedLeadCsv {
    if (!file) throw new BadRequestException("CSV file is required.");
    if (file.size <= 0 || file.buffer.length <= 0) throw new BadRequestException("Uploaded CSV is empty.");
    if (file.size > MAX_IMPORT_SIZE_BYTES) throw new BadRequestException(`CSV must be ${Math.round(MAX_IMPORT_SIZE_BYTES / 1_048_576)} MB or smaller.`);
    if (!file.originalname.toLowerCase().endsWith(".csv")) throw new BadRequestException("Uploaded file must use a .csv extension.");
  }

  private async validateRows(
    organizationId: string,
    records: Record<string, string>[],
    mapping: Record<string, ImportableField>,
    phoneRegion?: string,
  ) {
    const rows: ParsedRow[] = [];
    for (let index = 0; index < records.length; index += 1) {
      const raw = records[index] ?? {};
      const mapped = mapRow(raw, mapping);
      const errors: string[] = [];
      let phone: string | null = null;
      let email: string | null = null;
      try { phone = normalizeLeadPhone(mapped.phone, phoneRegion); } catch { errors.push("Invalid phone number."); }
      try { email = normalizeLeadEmail(mapped.email); } catch { errors.push("Invalid email address."); }
      if (!mapped.name?.trim()) errors.push("Name is required.");
      if (!phone && !email) errors.push("Phone or email is required.");
      const existing = !errors.length ? await this.repository.findContactByPhoneOrEmail(organizationId, phone, email) : null;
      rows.push({
        index: index + 2,
        raw,
        normalized: errors.length ? undefined : {
          name: mapped.name!.trim(),
          phone,
          email,
          company: mapped.company?.trim() || null,
          address: mapped.address?.trim() || null,
          notes: mapped.notes?.trim() || null,
          tags: mapped.tags ? mapped.tags.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean) : [],
        },
        errors,
        duplicate: Boolean(existing),
      });
    }
    return rows;
  }

  private async mapColumns(headers: string[]) {
    const fallback = fallbackMapping(headers);
    const apiKey = this.config.get<string>("openai.apiKey");
    if (!apiKey) return fallback;
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.get<string>("openai.ragModel") ?? "gpt-5.2",
          instructions: `Map CSV headers to CRM lead fields. Return strict JSON where keys are original headers and values are one of: ${IMPORTABLE_FIELDS.join(", ")}. Omit unknown columns.`,
          input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify(headers) }] }],
        }),
      });
      if (!response.ok) return fallback;
      const body = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
      const text = body.output_text ?? body.output?.flatMap((item) => item.content ?? []).map((item) => item.text).filter(Boolean).join("\n");
      const parsed = text ? JSON.parse(text) as Record<string, string> : {};
      return sanitizeMapping(headers, { ...fallback, ...parsed });
    } catch {
      return fallback;
    }
  }
}

function sanitizeMapping(headers: string[], input: Record<string, string>) {
  return Object.fromEntries(Object.entries(input).filter(([header, field]) => headers.includes(header) && IMPORTABLE_FIELDS.includes(field as ImportableField))) as Record<string, ImportableField>;
}
function fallbackMapping(headers: string[]) {
  const entries = headers.flatMap((header) => {
    const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, "");
    const field = normalized.includes("name") ? "name"
      : normalized.includes("mobile") || normalized.includes("phone") || normalized.includes("number") ? "phone"
      : normalized.includes("mail") ? "email"
      : normalized.includes("company") || normalized.includes("business") ? "company"
      : normalized.includes("address") ? "address"
      : normalized.includes("note") ? "notes"
      : normalized.includes("tag") ? "tags"
      : null;
    return field ? [[header, field as ImportableField]] : [];
  });
  return Object.fromEntries(entries) as Record<string, ImportableField>;
}
function mapRow(row: Record<string, string>, mapping: Record<string, ImportableField>) {
  const result: Partial<Record<ImportableField, string>> = {};
  for (const [header, field] of Object.entries(mapping)) result[field] ??= row[header];
  return result;
}
function sanitizeFileName(fileName: string) { return fileName.trim().replace(/[/\\]/g, "_") || "leads.csv"; }
function summarizeImport(row: { id: string; organizationId: string; fileName: string; status: string; mapping: unknown; previewRows: unknown; failedRows: unknown; duplicateRows: unknown; rowsFound: number; rowsValid: number; rowsInvalid: number; rowsDuplicate: number; rowsProcessed: number; rowsImported: number; rowsFailed: number; duplicates: number; campaignId?: string | null; campaign?: unknown; failureReason?: string | null; createdAt: Date; updatedAt: Date; completedAt?: Date | null }) {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null };
}
