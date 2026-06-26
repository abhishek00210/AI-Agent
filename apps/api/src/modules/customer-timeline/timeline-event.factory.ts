import { Injectable } from "@nestjs/common";
import type { CustomerTimelineCategory, CustomerTimelineEventType } from "../../../generated/prisma";

@Injectable()
export class TimelineEventFactory {
  create(eventType: CustomerTimelineEventType, description?: string | null) {
    const category = categoryFor(eventType);
    return { eventType, eventCategory: category, title: titleFor(eventType), description: description?.trim() || null };
  }
}
function categoryFor(type: CustomerTimelineEventType): CustomerTimelineCategory {
  if (type.startsWith("CALL") || type.startsWith("OUTBOUND_CALL")) return "VOICE";
  if (type.startsWith("SMS") || type === "FOLLOW_UP_SENT") return "SMS";
  if (type.startsWith("EMAIL")) return "EMAIL";
  if (type.startsWith("LEAD")) return "LEAD";
  if (type.startsWith("APPOINTMENT")) return "APPOINTMENT";
  if (type === "AI_SUMMARY_GENERATED") return "AI";
  return type === "CUSTOMER_CREATED" || type === "NOTE_ADDED" ? "CUSTOMER" : "SYSTEM";
}
function titleFor(type: CustomerTimelineEventType) { return type.toLowerCase().split("_").map((word) => word[0]!.toUpperCase() + word.slice(1)).join(" "); }
