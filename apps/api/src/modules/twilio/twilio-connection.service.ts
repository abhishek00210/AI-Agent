import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import { TwilioConnectionRepository } from "./repositories/twilio-connection.repository";
import { TwilioService } from "./twilio.service";

@Injectable()
export class TwilioConnectionService {
  constructor(
    private readonly provider: TwilioService,
    private readonly connections: TwilioConnectionRepository,
  ) {}

  async verify(context: TenantContext) {
    const account = await this.provider.validateConnection();
    const connection = await this.connections.upsert({
      organizationId: context.organizationId,
      accountSid: account.accountSid,
      friendlyName: account.friendlyName,
      status: "CONNECTED",
    });
    await this.audit(context, "twilio.connected", connection.id, {
      accountSid: account.accountSid,
      accountStatus: account.status,
    });
    return toConnectionResponse(connection);
  }

  async status(context: TenantContext) {
    const connection = await this.connections.findCurrent(context.organizationId);
    if (!connection) {
      return {
        connected: false,
        configured: this.provider.isConfigured(),
        accountSid: null,
        friendlyName: null,
        status: "DISCONNECTED" as const,
        updatedAt: null,
      };
    }
    return {
      connected: connection.status === "CONNECTED",
      configured: this.provider.isConfigured(),
      accountSid: connection.accountSid,
      friendlyName: connection.friendlyName,
      status: connection.status,
      updatedAt: connection.updatedAt,
    };
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.connections.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action,
      entityType: "TwilioConnection",
      entityId,
      metadata,
    });
  }
}

function toConnectionResponse(connection: {
  id: string;
  organizationId: string;
  accountSid: string;
  friendlyName: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: connection.id,
    organizationId: connection.organizationId,
    connected: connection.status === "CONNECTED",
    configured: true,
    accountSid: connection.accountSid,
    friendlyName: connection.friendlyName,
    status: connection.status,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}
