import type { MemoryFactType } from "../../../generated/prisma";

export interface Message {
  senderType: string;
  content: string;
  tokenCount: number;
  createdAt: Date;
}

export interface ExtractedMemoryFact {
  factType: MemoryFactType;
  factKey: string;
  factValue: string;
  confidence: number;
}

export interface MemoryJobContext {
  organizationId: string;
  conversationId: string;
  actorUserId?: string;
}
