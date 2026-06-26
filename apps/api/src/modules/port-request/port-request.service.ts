import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PortRequestStatus, Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { TenantContext } from "../tenant/tenant.service";
import { TelephonyProviderFactory } from "../telephony/telephony-provider.factory";
import { UsageService } from "../usage/usage.service";
import { normalizeE164 } from "../voice/e164";
import { VoiceWebhookUrlService } from "../voice/voice-webhook-url.service";
import type {
  AdminUpdatePortRequestDto,
  AssignPortRequestAgentDto,
  CreatePortRequestDto,
} from "./dto/port-request.dto";
import { PortEncryptionService } from "./port-encryption.service";
import { TwilioPortingService } from "./twilio-porting.service";

const TERMINAL = new Set<PortRequestStatus>(["COMPLETED", "CANCELLED"]);
const ALLOWED_MIME = new Map([
  ["application/pdf", ["pdf"]],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ["docx"]],
  ["image/png", ["png"]],
  ["image/jpeg", ["jpg", "jpeg"]],
]);
const MAX_LOA_BYTES = 15 * 1024 * 1024;

export interface PortLoaUpload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class PortRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: PortEncryptionService,
    private readonly storage: StorageService,
    private readonly telephony: TelephonyProviderFactory,
    private readonly porting: TwilioPortingService,
    private readonly webhookUrls: VoiceWebhookUrlService,
    private readonly usage: UsageService,
  ) {}

  async create(context: TenantContext, input: CreatePortRequestDto) {
    const phoneNumber = normalizeE164(input.phoneNumber);
    await this.assertAgent(context.organizationId, input.assignedAgentId);
    const platformNumber = await this.prisma.phoneNumber.findUnique({ where: { phoneNumber } });
    if (platformNumber && !platformNumber.deletedAt) {
      throw new ConflictException("This number is already managed by the platform.");
    }
    const existing = await this.prisma.portRequest.findUnique({
      where: {
        organizationId_phoneNumber: { organizationId: context.organizationId, phoneNumber },
      },
    });
    if (existing && !["FAILED", "REJECTED", "CANCELLED"].includes(existing.status)) {
      throw new ConflictException("An active port request already exists for this number.");
    }
    const record = await this.prisma.$transaction(async (tx) => {
      const row = existing
        ? await tx.portRequest.update({
            where: { id: existing.id },
            data: this.createData(context.organizationId, phoneNumber, input),
          })
        : await tx.portRequest.create({
            data: this.createData(context.organizationId, phoneNumber, input),
          });
      await tx.portRequestHistory.create({
        data: {
          portRequestId: row.id,
          status: "PENDING",
          actorType: "USER",
          actorId: context.userId,
          message: "Port request created.",
        },
      });
      return row;
    });
    await Promise.all([
      this.usage.increment({
        organizationId: context.organizationId,
        resourceType: "PORT_REQUESTS",
        idempotencyKey: `port-request:created:${record.id}`,
        metadata: { portRequestId: record.id, countryCode: record.countryCode },
      }),
      this.audit(context.organizationId, context.userId, "port_request.created", record.id),
    ]);
    return this.get(context, record.id);
  }

  async list(context: TenantContext) {
    const rows = await this.prisma.portRequest.findMany({
      where: { organizationId: context.organizationId },
      include: this.include(),
      orderBy: { createdAt: "desc" },
    });
    return { total: rows.length, data: rows.map((row) => serializePortRequest(row)) };
  }

  async get(context: TenantContext, id: string) {
    return serializePortRequest(await this.getOrThrow(context.organizationId, id));
  }

  async uploadLoa(context: TenantContext, id: string, file?: PortLoaUpload) {
    const request = await this.getOrThrow(context.organizationId, id);
    if (TERMINAL.has(request.status))
      throw new ConflictException("This port request cannot be changed.");
    this.validateFile(file);
    const extension = file.originalname.split(".").pop()?.toLowerCase() ?? "bin";
    const documentId = randomUUID();
    const storagePath = `organizations/${context.organizationId}/port-requests/${id}/loa/${documentId}.${extension}`;
    const upload = await this.storage.upload({
      key: storagePath,
      body: file.buffer,
      contentType: file.mimetype,
      contentLength: file.size,
      metadata: {
        organizationId: context.organizationId,
        portRequestId: id,
        documentType: "PORT_LOA",
      },
    });
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const document = await tx.portDocument.create({
          data: {
            id: documentId,
            organizationId: context.organizationId,
            type: "PORT_LOA",
            originalFileName: sanitizeFileName(file.originalname),
            fileType: file.mimetype,
            fileSize: file.size,
            storagePath: upload.key,
            storageProvider: upload.provider,
            storageBucket: upload.bucket,
            uploadedBy: context.userId,
          },
        });
        const row = await tx.portRequest.update({
          where: { id },
          data: {
            loaDocumentId: document.id,
            status: "PENDING",
            statusMessage: "LOA uploaded. Ready for submission.",
          },
        });
        await tx.portRequestHistory.create({
          data: {
            portRequestId: id,
            status: row.status,
            actorType: "USER",
            actorId: context.userId,
            message: "Letter of Authorization uploaded.",
          },
        });
        return row;
      });
      await this.audit(context.organizationId, context.userId, "port_request.loa_uploaded", id, {
        fileSize: file.size,
        fileType: file.mimetype,
      });
      return this.get(context, updated.id);
    } catch (error) {
      await this.storage.delete(storagePath).catch(() => undefined);
      throw error;
    }
  }

  async submit(context: TenantContext, id: string) {
    const request = await this.getOrThrow(context.organizationId, id);
    if (!request.loaDocumentId)
      throw new BadRequestException("Upload a Letter of Authorization before submission.");
    if (TERMINAL.has(request.status))
      throw new ConflictException("This port request cannot be submitted.");
    const provider = await this.porting.submit();
    const estimatedPortDate = addBusinessDays(new Date(), 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.portRequest.update({
        where: { id },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          estimatedPortDate,
          twilioPortRequestId: provider.providerRequestId,
          statusMessage: provider.automated
            ? "Submitted to Twilio."
            : "Submitted for porting review.",
        },
      });
      await tx.portRequestHistory.create({
        data: {
          portRequestId: id,
          status: "SUBMITTED",
          actorType: "USER",
          actorId: context.userId,
          message: "Port request submitted.",
        },
      });
    });
    await Promise.all([
      this.queueNotification(
        request,
        "Port request submitted",
        `Your port request for ${maskPhone(request.phoneNumber)} was submitted.`,
      ),
      this.audit(context.organizationId, context.userId, "port_request.submitted", id),
    ]);
    return this.get(context, id);
  }

  async cancel(context: TenantContext, id: string) {
    const request = await this.getOrThrow(context.organizationId, id);
    if (["COMPLETED", "CANCELLED"].includes(request.status)) {
      throw new ConflictException("This port request cannot be cancelled.");
    }
    await this.changeStatus(request, "CANCELLED", "Cancelled by customer.", "USER", context.userId);
    await this.audit(context.organizationId, context.userId, "port_request.cancelled", id);
    return this.get(context, id);
  }

  async assign(context: TenantContext, id: string, input: AssignPortRequestAgentDto) {
    const request = await this.getOrThrow(context.organizationId, id);
    if (request.status === "CANCELLED")
      throw new ConflictException("Cancelled requests cannot be assigned.");
    await this.assertAgent(context.organizationId, input.agentId ?? undefined);
    await this.prisma.$transaction(async (tx) => {
      await tx.portRequest.update({
        where: { id },
        data: { assignedAgentId: input.agentId ?? null },
      });
      if (request.phoneNumberId) {
        await tx.phoneNumber.updateMany({
          where: { id: request.phoneNumberId, organizationId: context.organizationId },
          data: { agentId: input.agentId ?? null, status: input.agentId ? "ACTIVE" : "UNASSIGNED" },
        });
      }
    });
    await this.audit(context.organizationId, context.userId, "port_request.agent_assigned", id, {
      agentId: input.agentId ?? null,
    });
    return this.get(context, id);
  }

  async loaDownload(organizationId: string, id: string) {
    const request = await this.getOrThrow(organizationId, id);
    if (!request.loaDocument) throw new NotFoundException("LOA document not found.");
    return this.storage.createDownloadUrl(
      request.loaDocument.storagePath,
      request.loaDocument.originalFileName,
      request.loaDocument.fileType,
    );
  }

  async adminList() {
    const rows = await this.prisma.portRequest.findMany({
      include: this.include(),
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    return rows.map((row) => serializePortRequest(row));
  }

  async adminGet(id: string) {
    const row = await this.prisma.portRequest.findUnique({
      where: { id },
      include: this.include(),
    });
    if (!row) throw new NotFoundException("Port request not found.");
    return serializePortRequest(row, true, this.encryption);
  }

  async adminUpdate(id: string, input: AdminUpdatePortRequestDto, adminId: string) {
    const request = await this.prisma.portRequest.findUnique({
      where: { id },
      include: this.include(),
    });
    if (!request) throw new NotFoundException("Port request not found.");
    const status = input.status as PortRequestStatus;
    if (request.status === "CANCELLED" && status !== "CANCELLED")
      throw new ConflictException("Cancelled requests cannot be reopened.");
    if (status === "COMPLETED") await this.complete(request, input, adminId);
    else await this.changeStatus(request, status, input.statusMessage, "ADMIN", adminId, input);
    if (status === "FAILED") {
      await this.usage.increment({
        organizationId: request.organizationId,
        resourceType: "FAILED_PORTS",
        idempotencyKey: `port-request:failed:${id}`,
      });
    }
    await this.audit(request.organizationId, undefined, "port_request.status_changed", id, {
      status,
      adminId,
    });
    return this.adminGet(id);
  }

  private async complete(
    request: PortRequestRecord,
    input: AdminUpdatePortRequestDto,
    adminId: string,
  ) {
    const provider = this.telephony.resolve({ organizationCountry: request.countryCode });
    const inventory = await provider.listNumbers();
    const providerNumber = inventory.find(
      (number) => normalizeE164(number.phoneNumber) === request.phoneNumber,
    );
    if (!providerNumber) {
      throw new ConflictException(
        "The ported number is not yet present in the connected Twilio inventory.",
      );
    }
    await provider.assignNumber(providerNumber.providerSid, {
      voiceWebhookUrl: this.webhookUrls.voiceUrl(),
      smsWebhookUrl: this.webhookUrls.smsUrl(),
    });
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`port-complete:${request.id}`}))`;
      const current = await tx.portRequest.findUnique({ where: { id: request.id } });
      if (!current || current.status === "CANCELLED")
        throw new ConflictException("Port request cannot be completed.");
      const phone = await tx.phoneNumber.upsert({
        where: { phoneNumber: request.phoneNumber },
        create: {
          organizationId: request.organizationId,
          agentId: request.assignedAgentId,
          phoneNumber: request.phoneNumber,
          friendlyName: `Ported ${request.phoneNumber}`,
          country: request.countryCode,
          countryCode: request.countryCode,
          capabilities: providerNumber.capabilities as Prisma.InputJsonValue,
          provider: "TWILIO",
          purchaseSource: "PORTED",
          status: request.assignedAgentId ? "ACTIVE" : "UNASSIGNED",
          twilioSid: providerNumber.providerSid,
          voiceWebhookUrl: this.webhookUrls.voiceUrl(),
          smsWebhookUrl: this.webhookUrls.smsUrl(),
          isPurchased: true,
          purchasedAt: now,
        },
        update: {
          organizationId: request.organizationId,
          agentId: request.assignedAgentId,
          country: request.countryCode,
          countryCode: request.countryCode,
          capabilities: providerNumber.capabilities as Prisma.InputJsonValue,
          purchaseSource: "PORTED",
          status: request.assignedAgentId ? "ACTIVE" : "UNASSIGNED",
          twilioSid: providerNumber.providerSid,
          voiceWebhookUrl: this.webhookUrls.voiceUrl(),
          smsWebhookUrl: this.webhookUrls.smsUrl(),
          isPurchased: true,
          purchasedAt: now,
          releasedAt: null,
          deletedAt: null,
        },
      });
      await tx.portRequest.update({
        where: { id: request.id },
        data: {
          status: "COMPLETED",
          statusMessage: input.statusMessage ?? "Port completed.",
          twilioPortRequestId: input.twilioPortRequestId ?? request.twilioPortRequestId,
          estimatedPortDate: parseDate(input.estimatedPortDate) ?? request.estimatedPortDate,
          completedAt: now,
          activatedAt: request.assignedAgentId ? now : null,
          phoneNumberId: phone.id,
        },
      });
      await tx.portRequestHistory.create({
        data: {
          portRequestId: request.id,
          status: "COMPLETED",
          actorType: "ADMIN",
          actorId: adminId,
          message: input.statusMessage ?? "Port completed and number activated.",
        },
      });
    });
    await Promise.all([
      this.usage.increment({
        organizationId: request.organizationId,
        resourceType: "COMPLETED_PORTS",
        idempotencyKey: `port-request:completed:${request.id}`,
      }),
      this.usage.increment({
        organizationId: request.organizationId,
        resourceType: "PHONE_NUMBERS",
        idempotencyKey: `phone-number:ported:${request.id}`,
      }),
      this.queueNotification(
        request,
        "Phone number port completed",
        `Your port for ${maskPhone(request.phoneNumber)} is complete and ready to use.`,
      ),
    ]);
  }

  private async changeStatus(
    request: PortRequestRecord,
    status: PortRequestStatus,
    message: string | undefined,
    actorType: string,
    actorId: string,
    input?: AdminUpdatePortRequestDto,
  ) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.portRequest.update({
        where: { id: request.id },
        data: {
          status,
          statusMessage: message,
          twilioPortRequestId: input?.twilioPortRequestId ?? request.twilioPortRequestId,
          estimatedPortDate: parseDate(input?.estimatedPortDate) ?? request.estimatedPortDate,
          submittedAt: status === "SUBMITTED" ? (request.submittedAt ?? now) : request.submittedAt,
          rejectedAt: status === "REJECTED" ? now : request.rejectedAt,
          cancelledAt: status === "CANCELLED" ? now : request.cancelledAt,
        },
      }),
      this.prisma.portRequestHistory.create({
        data: { portRequestId: request.id, status, message, actorType, actorId },
      }),
    ]);
    await this.queueNotification(
      request,
      `Port request ${status.toLowerCase().replaceAll("_", " ")}`,
      message || `Your port request status changed to ${status}.`,
    );
  }

  private createData(organizationId: string, phoneNumber: string, input: CreatePortRequestDto) {
    return {
      organizationId,
      phoneNumber,
      countryCode: input.countryCode,
      currentCarrier: input.currentCarrier.trim(),
      encryptedAccountNumber: this.encryption.encrypt(input.accountNumber),
      encryptedAccountPin: input.accountPin ? this.encryption.encrypt(input.accountPin) : null,
      businessName: input.businessName.trim(),
      businessAddress: input.businessAddress as Prisma.InputJsonValue,
      authorizedContactName: input.authorizedContactName.trim(),
      authorizedContactEmail: input.authorizedContactEmail.trim().toLowerCase(),
      authorizedContactPhone: normalizeE164(input.authorizedContactPhone),
      assignedAgentId: input.assignedAgentId ?? null,
      status: "PENDING" as const,
      statusMessage: "Upload a Letter of Authorization to continue.",
      loaDocumentId: null,
      submittedAt: null,
      completedAt: null,
      rejectedAt: null,
      cancelledAt: null,
      activatedAt: null,
      phoneNumberId: null,
    };
  }

  private validateFile(file?: PortLoaUpload): asserts file is PortLoaUpload {
    if (!file?.buffer.length) throw new BadRequestException("LOA document is required.");
    if (file.size > MAX_LOA_BYTES)
      throw new BadRequestException("LOA document must be 15 MB or smaller.");
    const allowed = ALLOWED_MIME.get(file.mimetype);
    const extension = file.originalname.split(".").pop()?.toLowerCase();
    if (!allowed?.includes(extension ?? ""))
      throw new BadRequestException("LOA must be PDF, DOCX, PNG, or JPG.");
    if (
      file.mimetype === "application/pdf" &&
      !file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))
    )
      throw new BadRequestException("Invalid PDF document.");
    if (
      file.mimetype === "image/png" &&
      file.buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
    )
      throw new BadRequestException("Invalid PNG document.");
    if (file.mimetype === "image/jpeg" && file.buffer.subarray(0, 2).toString("hex") !== "ffd8")
      throw new BadRequestException("Invalid JPEG document.");
    if (
      file.mimetype.includes("wordprocessingml") &&
      file.buffer.subarray(0, 2).toString("utf8") !== "PK"
    )
      throw new BadRequestException("Invalid DOCX document.");
  }

  private async assertAgent(organizationId: string, agentId?: string) {
    if (!agentId) return;
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, organizationId, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    if (!agent) throw new NotFoundException("Active agent not found.");
  }

  private async getOrThrow(organizationId: string, id: string) {
    const row = await this.prisma.portRequest.findFirst({
      where: { id, organizationId },
      include: this.include(),
    });
    if (!row) throw new NotFoundException("Port request not found.");
    return row;
  }

  private include() {
    return {
      assignedAgent: { select: { id: true, name: true, status: true } },
      loaDocument: {
        select: {
          id: true,
          originalFileName: true,
          fileType: true,
          fileSize: true,
          storagePath: true,
          createdAt: true,
        },
      },
      phoneRecord: { select: { id: true, phoneNumber: true, status: true, twilioSid: true } },
      history: { orderBy: { createdAt: "desc" as const }, take: 50 },
      organization: { select: { id: true, name: true } },
    } satisfies Prisma.PortRequestInclude;
  }

  private queueNotification(request: PortRequestRecord, subject: string, body: string) {
    return this.prisma.emailQueue.create({
      data: {
        organizationId: request.organizationId,
        to: request.authorizedContactEmail,
        subject,
        body,
        status: "PENDING",
      },
    });
  }

  private audit(
    organizationId: string,
    actorUserId: string | undefined,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.prisma.auditEvent.create({
      data: { organizationId, actorUserId, action, entityType: "PortRequest", entityId, metadata },
    });
  }
}

type PortRequestRecord = Prisma.PortRequestGetPayload<{
  include: {
    assignedAgent: { select: { id: true; name: true; status: true } };
    loaDocument: {
      select: {
        id: true;
        originalFileName: true;
        fileType: true;
        fileSize: true;
        storagePath: true;
        createdAt: true;
      };
    };
    phoneRecord: { select: { id: true; phoneNumber: true; status: true; twilioSid: true } };
    history: true;
    organization: { select: { id: true; name: true } };
  };
}>;

function serializePortRequest(
  record: PortRequestRecord,
  revealSensitive = false,
  encryption?: PortEncryptionService,
) {
  return {
    id: record.id,
    organizationId: record.organizationId,
    organization: record.organization,
    phoneNumber: record.phoneNumber,
    countryCode: record.countryCode,
    currentCarrier: record.currentCarrier,
    accountNumber:
      revealSensitive && encryption
        ? encryption.decrypt(record.encryptedAccountNumber)
        : maskSecret(),
    accountPin:
      revealSensitive && encryption && record.encryptedAccountPin
        ? encryption.decrypt(record.encryptedAccountPin)
        : record.encryptedAccountPin
          ? "••••"
          : null,
    businessName: record.businessName,
    businessAddress: record.businessAddress,
    authorizedContactName: record.authorizedContactName,
    authorizedContactEmail: record.authorizedContactEmail,
    authorizedContactPhone: record.authorizedContactPhone,
    status: record.status,
    statusMessage: record.statusMessage,
    twilioPortRequestId: record.twilioPortRequestId,
    estimatedPortDate: record.estimatedPortDate,
    submittedAt: record.submittedAt,
    completedAt: record.completedAt,
    rejectedAt: record.rejectedAt,
    cancelledAt: record.cancelledAt,
    activatedAt: record.activatedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    assignedAgent: record.assignedAgent,
    loaDocument: record.loaDocument
      ? {
          id: record.loaDocument.id,
          originalFileName: record.loaDocument.originalFileName,
          fileType: record.loaDocument.fileType,
          fileSize: record.loaDocument.fileSize,
          createdAt: record.loaDocument.createdAt,
        }
      : null,
    phoneRecord: record.phoneRecord,
    history: record.history,
  };
}

function sanitizeFileName(value: string) {
  return value.trim().replace(/[/\\]/g, "_").slice(0, 180) || "loa";
}
function maskPhone(value: string) {
  return value.length > 4
    ? `${"•".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`
    : value;
}
function maskSecret() {
  return "••••••••";
}
function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new BadRequestException("estimatedPortDate must be a valid date.");
  return date;
}
function addBusinessDays(start: Date, days: number) {
  const date = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return date;
}
