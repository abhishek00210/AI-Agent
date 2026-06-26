import type {
  AutomationActionType,
  AutomationTriggerType,
  Prisma,
  WorkflowTemplateCategory,
} from "../../../generated/prisma";

export type WorkflowTiming = "AFTER_TRIGGER" | "BEFORE_EVENT";

export interface WorkflowConfiguration {
  triggerType: AutomationTriggerType;
  delayMinutes: number;
  timing: WorkflowTiming;
  actionType: AutomationActionType;
  messageTemplate: string;
  emailSubject?: string | null;
  conditions: Record<string, unknown>;
  assignedAgentId?: string | null;
}

export interface WorkflowCustomization {
  name?: string;
  description?: string;
  delayMinutes?: number;
  timing?: WorkflowTiming;
  actionType?: AutomationActionType;
  messageTemplate?: string;
  emailSubject?: string | null;
  conditions?: Record<string, unknown>;
  assignedAgentId?: string | null;
  enabled?: boolean;
}

export function parseWorkflowConfiguration(value: Prisma.JsonValue): WorkflowConfiguration {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    triggerType: input.triggerType as AutomationTriggerType,
    delayMinutes: Number(input.delayMinutes ?? 0),
    timing: input.timing === "BEFORE_EVENT" ? "BEFORE_EVENT" : "AFTER_TRIGGER",
    actionType: input.actionType as AutomationActionType,
    messageTemplate: String(input.messageTemplate ?? ""),
    emailSubject: typeof input.emailSubject === "string" ? input.emailSubject : null,
    conditions:
      input.conditions && typeof input.conditions === "object" && !Array.isArray(input.conditions)
        ? (input.conditions as Record<string, unknown>)
        : {},
    assignedAgentId: typeof input.assignedAgentId === "string" ? input.assignedAgentId : null,
  };
}

export interface SystemWorkflowTemplate {
  name: string;
  description: string;
  category: WorkflowTemplateCategory;
  triggerType: AutomationTriggerType;
  estimatedConversionImpact: number;
  configuration: WorkflowConfiguration;
}
