export type OrganizationPlan = "FREE" | "STARTER" | "PRO" | "AGENCY";
export type PlanType = OrganizationPlan;
export type SubscriptionStatus =
  | "TRIAL"
  | "TRIALING"
  | "ACTIVE"
  | "PAUSED"
  | "PAST_DUE"
  | "CANCELED"
  | "CANCELLED"
  | "EXPIRED"
  | "UNPAID"
  | "INCOMPLETE";
export type OrganizationStatus = "ACTIVE" | "TRIAL_EXPIRED" | "SUSPENDED" | "ARCHIVED";
export type Country = "CA" | "IN";
export type Currency = "CAD" | "INR";
export type Language = "en" | "fr" | "hi";
export type TelephonyProviderName = "TWILIO" | "EXOTEL";
export type PaymentProviderName = "STRIPE" | "RAZORPAY";
export type UserStatus = "ACTIVE" | "INVITED" | "SUSPENDED";
export type MemberRole = "OWNER" | "ADMIN" | "MEMBER";
export type AgentStatus = "ACTIVE" | "INACTIVE" | "DRAFT";
export type KnowledgeBaseStatus = "ACTIVE" | "INACTIVE" | "DRAFT";
export type UploadStatus = "PENDING" | "UPLOADED" | "FAILED";
export type ProcessingStatus = "PENDING" | "PROCESSING" | "EMBEDDING" | "COMPLETED" | "FAILED";
export type WebsiteSourceStatus = "PENDING" | "SCRAPING" | "COMPLETED" | "FAILED";
export type FaqStatus = "ACTIVE" | "INACTIVE";
export type ConversationChannel = "WEB_CHAT" | "VOICE" | "SMS" | "WHATSAPP";
export type ConversationStatus = "ACTIVE" | "CLOSED" | "ARCHIVED";
export type ConversationSource = "INTERNAL" | "WIDGET";
export type SenderType = "USER" | "ASSISTANT" | "SYSTEM";
export type MessageType = "TEXT" | "SYSTEM_EVENT" | "TOOL_CALL" | "TOOL_RESULT";
export type MemoryFactType =
  | "USER_INFO"
  | "BUSINESS_INFO"
  | "APPOINTMENT"
  | "CONTACT"
  | "PREFERENCE"
  | "CUSTOM";
export type WidgetStatus = "ACTIVE" | "INACTIVE";
export type WidgetPosition = "BOTTOM_RIGHT" | "BOTTOM_LEFT";
export type PhoneNumberStatus = "ACTIVE" | "INACTIVE" | "UNASSIGNED";
export type PhoneNumberProvider = "TWILIO" | "EXOTEL";
export type PurchaseSource = "TWILIO" | "PORTED" | "EXTERNAL";
export type CustomerLeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "BOOKED" | "CUSTOMER" | "LOST";
export type CallSummarySentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE";
export type CallSummaryOutcome =
  | "BOOKED_APPOINTMENT"
  | "QUALIFIED_LEAD"
  | "FOLLOW_UP_REQUIRED"
  | "INFORMATION_PROVIDED"
  | "TRANSFERRED"
  | "UNRESOLVED"
  | "OTHER";
export interface AiCallSummary {
  id: string;
  organizationId: string;
  customerProfileId: string;
  callId: string;
  conversationId: string | null;
  transcriptId: string | null;
  summary: string;
  intent: string;
  sentiment: CallSummarySentiment;
  outcome: CallSummaryOutcome;
  nextAction: string | null;
  followUpRequired: boolean;
  confidenceScore: number;
  summaryVersion: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostMicros: number;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
  customerProfile?: { id: string; name: string; phone: string | null; email: string | null };
  call?: {
    id: string;
    callerNumber: string;
    calledNumber: string;
    startedAt: string;
    agent: { id: string; name: string };
  };
}
export interface CallSummaryListResponse {
  total: number;
  page: number;
  limit: number;
  data: AiCallSummary[];
}
export type CustomerTimelineEventType =
  | "CUSTOMER_CREATED"
  | "CALL_RECEIVED"
  | "CALL_COMPLETED"
  | "CONVERSATION_STARTED"
  | "CONVERSATION_COMPLETED"
  | "LEAD_CREATED"
  | "LEAD_UPDATED"
  | "LEAD_DELETED"
  | "LEAD_RESTORED"
  | "LEAD_IMPORTED"
  | "IMPORT_COMPLETED"
  | "LEAD_STATUS_CHANGED"
  | "APPOINTMENT_BOOKED"
  | "APPOINTMENT_RESCHEDULED"
  | "APPOINTMENT_CANCELLED"
  | "SMS_SENT"
  | "SMS_RECEIVED"
  | "EMAIL_SENT"
  | "EMAIL_RECEIVED"
  | "FOLLOW_UP_SENT"
  | "FOLLOW_UP_SCHEDULED"
  | "FOLLOW_UP_CANCELLED"
  | "FOLLOW_UP_FAILED"
  | "WORKFLOW_CREATED"
  | "WORKFLOW_ENABLED"
  | "WORKFLOW_TRIGGERED"
  | "WORKFLOW_COMPLETED"
  | "WORKFLOW_CANCELLED"
  | "NOTE_ADDED"
  | "AI_SUMMARY_GENERATED"
  | "OUTBOUND_CALL_CREATED"
  | "OUTBOUND_CALL_STARTED"
  | "OUTBOUND_CALL_FAILED"
  | "LEAD_QUALIFIED"
  | "OUTBOUND_CALL_COMPLETED"
  | "CAMPAIGN_CREATED"
  | "CAMPAIGN_STARTED"
  | "CAMPAIGN_COMPLETED"
  | "CAMPAIGN_CANCELLED"
  | "CAMPAIGN_CALL_CREATED";
export type CustomerTimelineCategory =
  | "CUSTOMER"
  | "VOICE"
  | "SMS"
  | "EMAIL"
  | "LEAD"
  | "APPOINTMENT"
  | "AI"
  | "SYSTEM";
export interface CustomerTimelineEvent {
  id: string;
  organizationId: string;
  customerProfileId: string;
  eventType: CustomerTimelineEventType;
  eventCategory: CustomerTimelineCategory;
  title: string;
  description: string | null;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  metadata: unknown;
  occurredAt: string;
  createdAt: string;
}
export interface CustomerTimelineResponse {
  data: CustomerTimelineEvent[];
  nextCursor: string | null;
}
export interface CustomerProfile {
  id: string;
  organizationId: string;
  contactId: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  address: Record<string, string> | null;
  leadStatus: CustomerLeadStatus;
  notes: string | null;
  totalCalls: number;
  totalAppointments: number;
  totalConversations: number;
  totalMessages: number;
  totalAiInteractions: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
  contact?: {
    leads: unknown[];
    appointments: Array<{ id: string; title: string; status: string; startTime: string }>;
    communicationThreads: Array<{ id: string; channel: string; messages: unknown[] }>;
  };
}
export type AutomationTriggerType =
  | "NEW_LEAD"
  | "MISSED_APPOINTMENT"
  | "APPOINTMENT_COMPLETED"
  | "NO_RESPONSE"
  | "UPCOMING_APPOINTMENT"
  | "QUOTE_SENT";
export type AutomationActionType = "CALL" | "SMS" | "EMAIL";
export type OutboundCallReason =
  | "LEAD_FOLLOW_UP"
  | "MISSED_APPOINTMENT"
  | "QUOTE_FOLLOW_UP"
  | "REVIEW_REQUEST"
  | "MANUAL_CALL"
  | "REACTIVATION"
  | "APPOINTMENT_REMINDER";
export type OutboundCallReasonType =
  | "LEAD_FOLLOW_UP"
  | "QUOTE_FOLLOW_UP"
  | "MISSED_APPOINTMENT"
  | "REVIEW_REQUEST"
  | "MANUAL_CALL"
  | "AUTOMATION_CALL"
  | "FOLLOW_UP"
  | "SYSTEM_TRIGGER"
  | "REACTIVATION";
export type OutboundCallStatus =
  | "PENDING"
  | "SCHEDULED"
  | "DIALING"
  | "RINGING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "BUSY"
  | "NO_ANSWER"
  | "VOICEMAIL"
  | "CANCELLED";
export type AutomationExecutionStatus =
  | "PENDING"
  | "SCHEDULED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";
export interface AutomationTemplate {
  id: string;
  name: string;
  actionType: AutomationActionType;
  subject: string | null;
  body: string;
  enabled: boolean;
}
export interface AutomationRule {
  id: string;
  delayMinutes: number;
  actionType: AutomationActionType;
  templateId: string | null;
  conditions: Record<string, unknown>;
  enabled: boolean;
  template: AutomationTemplate | null;
}
export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string | null;
  triggerType: AutomationTriggerType;
  enabled: boolean;
  isDefault: boolean;
  rules: AutomationRule[];
}
export interface AutomationExecution {
  id: string;
  organizationId: string;
  workflowId: string;
  ruleId: string;
  customerProfileId: string;
  triggerType: AutomationTriggerType;
  actionType: AutomationActionType;
  status: AutomationExecutionStatus;
  reasonType: OutboundCallReason;
  reasonDescription: string;
  followUpReason: string;
  triggerId: string;
  scheduledFor: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  failureReason: string | null;
  attemptCount: number;
  metadata: unknown;
  createdAt: string;
  workflow: { id: string; name: string; triggerType: AutomationTriggerType };
  rule: { id: string; actionType: AutomationActionType; delayMinutes: number };
  customerProfile: { id: string; name: string; phone: string | null; email: string | null };
}
export interface AutomationDashboard {
  workflows: AutomationWorkflow[];
  executions: AutomationExecution[];
  metrics: {
    pending: number;
    completed: number;
    failed: number;
    cancelled: number;
    successRate: number;
  };
  templatePerformance: Array<{
    templateId: string;
    workflowId: string;
    workflowName: string;
    executions: number;
    successRate: number;
  }>;
  mostEffectiveTemplate: {
    templateId: string;
    workflowId: string;
    workflowName: string;
    executions: number;
    successRate: number;
  } | null;
}

export interface OutboundCall {
  id: string;
  organizationId: string;
  customerProfileId: string;
  leadId: string | null;
  callId: string | null;
  agentId: string;
  reasonType: OutboundCallReasonType;
  reasonDescription: string;
  status: OutboundCallStatus;
  attemptNumber: number;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  appointmentBooked: boolean;
  qualified: boolean;
  summaryId: string | null;
  recordingId: string | null;
  transcriptId: string | null;
  provider: string;
  providerCallSid: string | null;
  lastError: string | null;
  customer: { id: string; name: string; phone: string | null; email: string | null };
  lead: { id: string; status: string; score: number; metadata: unknown } | null;
  agent: { id: string; name: string; status: string };
  call: { id: string; status: string; durationSeconds: number | null; callTranscriptId: string | null } | null;
  summary: { id: string; outcome: string; sentiment: string; summary: string } | null;
  recording: { id: string; status: string } | null;
  transcript: { id: string; status: string } | null;
  createdAt: string;
  updatedAt: string;
}

export type CampaignType = "FOLLOW_UP" | "RE_ENGAGEMENT" | "REMINDER" | "SALES_OUTREACH";
export type CampaignStatus = "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type CampaignScheduleType = "IMMEDIATE" | "SCHEDULED" | "RECURRING";
export interface CampaignTarget {
  id: string;
  customerProfileId: string;
  leadId: string | null;
  outboundCallId: string | null;
  status: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  completedAt: string | null;
  customerProfile: { id: string; name: string; phone: string | null; leadStatus: string };
  lead: { id: string; status: string } | null;
  outboundCall: Pick<OutboundCall, "id" | "status" | "durationSeconds" | "qualified" | "appointmentBooked" | "summaryId"> | null;
}
export interface Campaign {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  campaignType: CampaignType;
  status: CampaignStatus;
  scheduleType: CampaignScheduleType;
  scheduledAt: string | null;
  maxAttempts: number;
  assignedAgent: { id: string; name: string; status: string };
  metrics: {
    targets: number;
    callsCreated: number;
    callsCompleted: number;
    connectionRate: number;
    qualificationRate: number;
    appointmentRate: number;
    conversionRate: number;
  };
  targets?: CampaignTarget[];
  createdAt: string;
  updatedAt: string;
}
export type WorkflowTemplateCategory = "LEAD" | "APPOINTMENT" | "REVIEW" | "QUOTE" | "CUSTOM";
export interface WorkflowBuilderConfiguration {
  triggerType: AutomationTriggerType;
  delayMinutes: number;
  timing: "AFTER_TRIGGER" | "BEFORE_EVENT";
  actionType: AutomationActionType;
  messageTemplate: string;
  emailSubject?: string | null;
  conditions: Record<string, unknown>;
  assignedAgentId?: string | null;
}
export interface WorkflowTemplateSummary {
  id: string;
  organizationId: string | null;
  name: string;
  description: string | null;
  category: WorkflowTemplateCategory;
  systemTemplate: boolean;
  triggerType: AutomationTriggerType;
  defaultConfiguration: WorkflowBuilderConfiguration;
  estimatedConversionImpact: number;
  enabled: boolean;
  versions: Array<{ id: string; version: number; configuration: WorkflowBuilderConfiguration }>;
  configuration?: WorkflowBuilderConfiguration;
}
export interface CustomerMemoryContext {
  customer: {
    id: string;
    organizationId: string;
    contactId: string;
    name: string | null;
    company: string | null;
    leadStatus: CustomerLeadStatus;
    lastContactAt: string | null;
    totalCalls: number;
  };
  recognized: boolean;
  recognitionConfidence: "HIGH" | "MEDIUM";
  recentSummaries: Array<{
    id: string;
    summary: string;
    intent: string;
    sentiment: CallSummarySentiment;
    outcome: CallSummaryOutcome;
    nextAction: string | null;
    followUpRequired: boolean;
    confidenceScore: number;
    generatedAt: string;
  }>;
  recentTimeline: CustomerTimelineEvent[];
  appointments: Array<{
    id: string;
    title: string;
    status: string;
    startTime: string;
    endTime: string;
    timezone: string;
  }>;
  openFollowUps: Array<{ summaryId: string; action: string; generatedAt: string }>;
  promptContext: string;
  estimatedTokens: number;
}
export type PortRequestStatus =
  | "PENDING"
  | "DOCUMENT_REQUIRED"
  | "SUBMITTED"
  | "PROCESSING"
  | "REJECTED"
  | "APPROVED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface PortRequest {
  id: string;
  organizationId: string;
  phoneNumber: string;
  countryCode: string;
  currentCarrier: string;
  businessName: string;
  businessAddress: Record<string, string>;
  authorizedContactName: string;
  authorizedContactEmail: string;
  authorizedContactPhone: string;
  status: PortRequestStatus;
  statusMessage: string | null;
  twilioPortRequestId: string | null;
  estimatedPortDate: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  assignedAgent: { id: string; name: string; status: string } | null;
  loaDocument: {
    id: string;
    originalFileName: string;
    fileType: string;
    fileSize: number;
    createdAt: string;
  } | null;
  phoneRecord: { id: string; phoneNumber: string; status: string; twilioSid: string | null } | null;
  history: Array<{
    id: string;
    status: PortRequestStatus;
    message: string | null;
    actorType: string;
    createdAt: string;
  }>;
}

export interface CreatePortRequestInput {
  phoneNumber: string;
  countryCode: "CA" | "US" | "GB" | "AU";
  currentCarrier: string;
  accountNumber: string;
  accountPin?: string;
  businessName: string;
  businessAddress: Record<string, string>;
  authorizedContactName: string;
  authorizedContactEmail: string;
  authorizedContactPhone: string;
  assignedAgentId?: string;
}
export type TwilioConnectionStatus = "CONNECTED" | "DISCONNECTED";
export type CallDirection = "INBOUND" | "OUTBOUND";
export type CallStatus = "RINGING" | "ROUTING" | "CONNECTED" | "COMPLETED" | "FAILED" | "MISSED";
export type CallSource = "VOICE" | "WIDGET" | "INTERNAL";
export type CallEndReason =
  | "CALLER_HANGUP"
  | "AI_HANGUP"
  | "TIMEOUT"
  | "ERROR"
  | "TRANSFER"
  | "UNKNOWN";
export type CallSessionStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "FAILED";
export type RecordingStatus =
  | "PENDING"
  | "RECORDING"
  | "PROCESSING"
  | "AVAILABLE"
  | "FAILED"
  | "DELETED";
export type TranscriptStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type SpeakerType = "USER" | "ASSISTANT" | "SYSTEM" | "UNKNOWN";
export type ToolExecutionStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "REJECTED";
export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type AppointmentSource = "VOICE" | "CHAT" | "WIDGET" | "MANUAL";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  plan: OrganizationPlan;
  status: OrganizationStatus;
}

export interface CurrentOrganization extends OrganizationSummary {
  industry: string | null;
  companySize: string | null;
  provisionStatus: string;
  country: Country;
  countryCode: Country;
  currency: Currency;
  timezone: string;
  language: Language;
  telephonyProvider: TelephonyProviderName;
  paymentProvider: PaymentProviderName;
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
  businessHoursTimezone: string;
  taxRegion: string | null;
  gstNumber: string | null;
  billingCompanyName: string | null;
  billingAddress: Record<string, unknown> | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  greetingSettings: GreetingSettings;
}

export type GreetingConfidenceThreshold = "LOW" | "MEDIUM" | "HIGH";
export interface GreetingSettings {
  enabled: boolean;
  recencyWindowDays: number;
  confidenceThreshold: GreetingConfidenceThreshold;
}
export interface GreetingDecision {
  level: 0 | 1 | 2 | 3;
  instructions: string;
  preview: string;
  personalized: boolean;
  fallbackReason?: string;
  settings: GreetingSettings;
}

export type BillableFeature =
  | "agents"
  | "voiceMinutes"
  | "sms"
  | "chatMessages"
  | "knowledgeBases"
  | "phoneNumbers"
  | "widgets"
  | "campaignTargets";
export type BillingCapability =
  | "googleCalendar"
  | "appointments"
  | "crm"
  | "websiteWidget"
  | "apiAccess"
  | "prioritySupport"
  | "advancedAnalytics"
  | "realtimeVoice";
export interface BillingUsageItem {
  used: number;
  limit: number | null;
}
export interface BillingSubscriptionSummary {
  provider: PaymentProviderName;
  plan: PlanType;
  status: SubscriptionStatus | null;
  source: "SUBSCRIPTION" | "TRIAL" | "LEGACY_FREE" | "BLOCKED";
  allowed: boolean;
  reason: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  pausedAt: string | null;
  pauseResumesAt: string | null;
  pendingPlan: Exclude<PlanType, "FREE"> | null;
  trialEndsAt: string | null;
  usage: Record<BillableFeature, BillingUsageItem>;
  capabilities: Record<BillingCapability, boolean>;
  addons: {
    phoneNumbers: {
      status: "PENDING" | "ACTIVE" | "FAILED" | "INACTIVE";
      quantity: number;
      unitAmountCents: number;
      currency: string;
      lastSyncedAt: string | null;
    } | null;
  };
}
export interface BillingPlanSummary {
  plan: PlanType;
  displayName: string;
  monthlyPriceCents: number;
  currency: string;
  limits: Record<BillableFeature, number | null>;
  capabilities: Record<BillingCapability, boolean>;
  checkoutAvailable: boolean;
}

export type UsageResource =
  | "AI_MINUTES"
  | "REALTIME_VOICE_MINUTES"
  | "INCOMING_CALLS"
  | "OUTGOING_CALLS"
  | "MESSAGES"
  | "SMS_MESSAGES"
  | "AI_INPUT_TOKENS"
  | "AI_OUTPUT_TOKENS"
  | "KNOWLEDGE_STORAGE_MB"
  | "KNOWLEDGE_BASES"
  | "AGENTS"
  | "APPOINTMENTS"
  | "PHONE_NUMBERS"
  | "WIDGETS"
  | "CALENDAR_CONNECTIONS"
  | "TOOL_EXECUTIONS"
  | "EXTERNAL_PHONE_NUMBERS"
  | "PHONE_VERIFICATION_ATTEMPTS"
  | "PHONE_FORWARDING_TESTS"
  | "PHONE_FORWARDING_ACTIVATIONS"
  | "PORT_REQUESTS"
  | "COMPLETED_PORTS"
  | "FAILED_PORTS"
  | "CUSTOMER_PROFILES_CREATED"
  | "CUSTOMER_PROFILES_UPDATED"
  | "TIMELINE_WRITES"
  | "TIMELINE_READS"
  | "AI_SUMMARY_GENERATIONS"
  | "AI_SUMMARY_INPUT_TOKENS"
  | "AI_SUMMARY_OUTPUT_TOKENS"
  | "AI_SUMMARY_COST_MICROS"
  | "MEMORY_RETRIEVALS"
  | "MEMORY_CONTEXT_TOKENS"
  | "GREETING_GENERATIONS"
  | "GREETING_CONTEXT_LOADS"
  | "AUTOMATION_EXECUTIONS"
  | "AUTOMATION_SMS_SENT"
  | "AUTOMATION_EMAILS_SENT"
  | "AUTOMATION_CALLS_SCHEDULED"
  | "WORKFLOW_TEMPLATE_ACTIVATIONS"
  | "OUTBOUND_CALLS"
  | "OUTBOUND_MINUTES"
  | "OUTBOUND_RECORDINGS"
  | "OUTBOUND_TRANSCRIPTS"
  | "QUALIFICATION_ATTEMPTS"
  | "CAMPAIGN_TARGETS"
  | "CAMPAIGN_CALLS"
  | "CAMPAIGN_MINUTES"
  | "LEAD_IMPORTS"
  | "IMPORTED_LEADS"
  | "CSV_UPLOADS";

export interface UsageResourceSummary {
  used: number;
  limit: number | null;
  remaining: number | null;
  overage: number;
}

export interface UsageSummary {
  plan: PlanType;
  state: string;
  allowed: boolean;
  periodStart: string;
  periodEnd: string;
  periodSource: "SUBSCRIPTION" | "TRIAL" | "CALENDAR";
  updatedAt: string | null;
  values: Record<UsageResource, number>;
  resources: Record<UsageResource, UsageResourceSummary>;
  projection: Record<
    UsageResource,
    {
      projected: number;
      included: number | null;
      overage: number;
      estimatedNextInvoiceCents: number;
    }
  >;
}

export interface UsageEventSummary {
  id: string;
  organizationId: string;
  resourceType: UsageResource;
  quantity: number;
  metadata: unknown;
  createdAt: string;
}

export interface AnalyticsDashboard {
  range: { from: string; to: string };
  definitions: {
    conversionRate: string;
    revenue: string;
    mrr: string;
  };
  overview: {
    totalCalls: number;
    incomingCalls: number;
    outgoingCalls: number;
    appointments: number;
    leads: number;
    qualifiedLeads: number;
    conversionRate: number;
    aiMinutes: number;
    revenue: number;
    averageCallDuration: number;
    smsSent: number;
    messagesSent: number;
    aiResponses: number;
    aiTokens: number;
    toolExecutions: number;
    appointmentsBookedByAi: number;
    leadsCreatedByAi: number;
    newCustomers: number;
    returningCustomers: number;
    recognizedCallers: number;
    memoryContextLoads: number;
    personalizedGreetings: number;
    greetingLevel0: number;
    greetingLevel1: number;
    greetingLevel2: number;
    greetingLevel3: number;
    repeatCallers: number;
    customerRetentionRate: number;
  };
  series: Array<{
    date: string;
    calls: number;
    leads: number;
    appointments: number;
    revenue: number;
    aiMinutes: number;
  }>;
  topAgents: Array<{
    agentId: string;
    agentName: string;
    calls: number;
    appointments: number;
    leads: number;
    conversionRate: number;
  }>;
  recentActivity: Array<{
    id: string;
    eventType: string;
    title: string;
    agentId: string | null;
    metricDate: string;
    createdAt: string;
    metadata: { source?: string; status?: string; agentName?: string; plan?: string };
  }>;
  revenue: { total: number; mrr: number; planDistribution: Record<string, number> };
}

export interface OrganizationMemberSummary {
  id: string;
  role: MemberRole;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: UserStatus;
  };
}

export interface OrganizationInvitationSummary {
  id: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
  createdAt: string;
}

export interface InviteMemberInput {
  email: string;
  role: MemberRole;
}

export interface UpdateOrganizationInput {
  name?: string;
  country?: Country;
  countryCode?: Country;
  currency?: Currency;
  timezone?: string;
  language?: Language;
  telephonyProvider?: TelephonyProviderName;
  paymentProvider?: PaymentProviderName;
  dateFormat?: string;
  timeFormat?: string;
  numberFormat?: string;
  businessHoursTimezone?: string;
  taxRegion?: string;
  gstNumber?: string;
  billingCompanyName?: string;
  billingAddress?: Record<string, unknown>;
}

export type UpdateGreetingSettingsInput = Partial<GreetingSettings>;

export interface UpdateMemberRoleInput {
  role: MemberRole;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  role: MemberRole;
  status: UserStatus;
}

export interface AgentSummary {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  language: string;
  voice: string;
  systemPrompt: string;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
}

export type AgentDetails = AgentSummary;

export interface AgentListResponse {
  total: number;
  page: number;
  limit: number;
  data: AgentSummary[];
}

export interface AgentListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: AgentStatus;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  language: string;
  voice: string;
  systemPrompt: string;
  status: AgentStatus;
}

export type UpdateAgentInput = Partial<CreateAgentInput>;

export interface AgentOption {
  label: string;
  value: string;
}

export interface AppointmentSummary {
  id: string;
  organizationId: string;
  agentId: string;
  contactId: string | null;
  conversationId: string | null;
  callId: string | null;
  title: string;
  description: string | null;
  status: AppointmentStatus;
  timezone: string;
  startTime: string;
  endTime: string;
  source: AppointmentSource;
  confirmationNumber: string;
  idempotencyKey: string | null;
  notes: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  agent?: { id: string; name: string; status: AgentStatus };
  contact?: { id: string; name: string; phone: string | null; email: string | null } | null;
  conversation?: {
    id: string;
    status: ConversationStatus;
    channel: ConversationChannel;
    source: ConversationSource;
  } | null;
  call?: {
    id: string;
    twilioCallSid: string;
    callerNumber: string;
    calledNumber: string;
  } | null;
}

export type AppointmentDetails = AppointmentSummary;

export interface AppointmentListResponse {
  total: number;
  page: number;
  limit: number;
  data: AppointmentSummary[];
}

export interface AppointmentListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: AppointmentStatus;
  agentId?: string;
  contactId?: string;
  callId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateAppointmentInput {
  agentId: string;
  contactId?: string;
  conversationId?: string;
  callId?: string;
  title: string;
  description?: string;
  status?: AppointmentStatus;
  timezone: string;
  preferredDate: string;
  preferredTime: string;
  durationMinutes?: number;
  source?: AppointmentSource;
  notes?: string;
}

export type UpdateAppointmentInput = Partial<
  Pick<
    CreateAppointmentInput,
    | "title"
    | "description"
    | "status"
    | "timezone"
    | "preferredDate"
    | "preferredTime"
    | "durationMinutes"
    | "notes"
  >
>;

export interface AvailabilityRule {
  id: string;
  organizationId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isEnabled: boolean;
  timezone: string;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAvailabilityInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isEnabled?: boolean;
  timezone: string;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
}

export type UpdateAvailabilityInput = Partial<CreateAvailabilityInput>;

export interface AvailabilitySlot {
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface AvailabilitySlotsQuery {
  date: string;
  agentId?: string;
  durationMinutes?: number;
}

export interface WidgetSummary {
  id: string;
  organizationId: string;
  agentId: string;
  agent: {
    id: string;
    name: string;
    status: AgentStatus;
  };
  name: string;
  status: WidgetStatus;
  publicKey: string;
  primaryColor: string;
  position: WidgetPosition;
  welcomeMessage: string;
  createdAt: string;
  updatedAt: string;
}

export type WidgetDetails = WidgetSummary;

export interface WidgetListResponse {
  total: number;
  data: WidgetSummary[];
}

export interface WidgetListQuery {
  search?: string;
}

export interface CreateWidgetInput {
  name: string;
  agentId: string;
  status: WidgetStatus;
  primaryColor: string;
  position: WidgetPosition;
  welcomeMessage: string;
}

export type UpdateWidgetInput = Partial<CreateWidgetInput>;

export interface PhoneNumberCapabilities {
  voice?: boolean;
  sms?: boolean;
  mms?: boolean;
}

export interface PhoneNumberSummary {
  id: string;
  organizationId: string;
  agentId: string | null;
  agent: {
    id: string;
    name: string;
    status: AgentStatus;
    language: string;
  } | null;
  phoneNumber: string;
  friendlyName: string | null;
  country: string | null;
  countryCode: string | null;
  areaCode: string | null;
  capabilities: PhoneNumberCapabilities;
  provider: PhoneNumberProvider;
  purchaseSource: PurchaseSource | null;
  status: PhoneNumberStatus;
  twilioSid: string | null;
  voiceWebhookUrl: string | null;
  smsWebhookUrl: string | null;
  monthlyCost: number | null;
  providerCost: number | null;
  customerPrice: number | null;
  profitMargin: number | null;
  isPurchased: boolean;
  purchasedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PhoneNumberDetails = PhoneNumberSummary;

export interface PhoneNumberListResponse {
  total: number;
  page: number;
  limit: number;
  data: PhoneNumberSummary[];
}

export interface PhoneNumberListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: PhoneNumberStatus;
  agentId?: string;
}

export interface AssignPhoneNumberAgentInput {
  agentId: string;
}

export interface PhoneNumberSyncResponse {
  total: number;
  data: PhoneNumberSummary[];
}

export interface MarketplacePhoneNumber {
  provider: PhoneNumberProvider;
  phoneNumber: string;
  country: string;
  region: string | null;
  locality: string | null;
  postalCode: string | null;
  capabilities: PhoneNumberCapabilities;
  monthlyCost: number;
  setupCost: number;
  providerCost: number;
  customerPrice: number;
  profitMargin: number;
}

export interface MarketplaceSearchQuery {
  country: Country;
  areaCode?: string;
  contains?: string;
  type?: "local" | "toll-free" | "mobile";
  voice?: boolean;
  sms?: boolean;
  limit?: number;
}

export interface MarketplaceSearchResponse {
  countryCode: string;
  provider: PhoneNumberProvider;
  type: string;
  data: MarketplacePhoneNumber[];
}

export interface PurchaseMarketplaceNumberInput {
  phoneNumber: string;
  country: Country;
  areaCode?: string;
  agentId?: string;
}

export type ExternalPhoneNumberStatus = "PENDING" | "VERIFIED" | "ACTIVE" | "FAILED" | "DISABLED";
export type ExternalNumberVerificationMethod = "SMS" | "VOICE";
export type ExternalNumberTestStatus = "NOT_STARTED" | "WAITING_FOR_CALL" | "EXPIRED" | "PASSED";

export interface ExternalPhoneNumber {
  id: string;
  organizationId: string;
  phoneNumber: string;
  countryCode: "CA" | "US" | "GB" | "AU";
  status: ExternalPhoneNumberStatus;
  assignedAgentId: string | null;
  assignedAgent: { id: string; name: string; status: AgentStatus } | null;
  forwardingTargetPhoneNumberId: string | null;
  forwardingTargetNumber: string | null;
  verificationMethod: ExternalNumberVerificationMethod;
  verificationExpiresAt: string | null;
  verifiedAt: string | null;
  activatedAt: string | null;
  lastTestCallAt: string | null;
  forwardingConfirmedAt: string | null;
  testStartedAt: string | null;
  testExpiresAt: string | null;
  testStatus: ExternalNumberTestStatus;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
  forwardingInstructions: {
    target: string;
    enableCode: string;
    disableCode: string;
    notes: string[];
    steps: string[];
  } | null;
  verificationDelivery?: {
    sent: boolean;
    method?: ExternalNumberVerificationMethod;
    expiresAt?: string;
    error?: string;
  };
}

export interface ExternalPhoneNumberListResponse {
  total: number;
  data: ExternalPhoneNumber[];
}

export interface CreateExternalPhoneNumberInput {
  phoneNumber: string;
  countryCode: "CA" | "US" | "GB" | "AU";
  assignedAgentId?: string;
  forwardingTargetPhoneNumberId?: string;
  verificationMethod?: ExternalNumberVerificationMethod;
}

export interface TwilioConnectionResponse {
  id?: string;
  organizationId?: string;
  connected: boolean;
  configured: boolean;
  accountSid: string | null;
  friendlyName: string | null;
  status: TwilioConnectionStatus;
  createdAt?: string;
  updatedAt: string | null;
}

export interface CallSummary {
  id: string;
  organizationId: string;
  agentId: string;
  phoneNumberId: string;
  conversationId: string | null;
  callRecordingId: string | null;
  callTranscriptId: string | null;
  agent: {
    id: string;
    name: string;
    status: AgentStatus;
  };
  phoneNumber: {
    id: string;
    phoneNumber: string;
    friendlyName: string | null;
  };
  conversation: {
    id: string;
    status: ConversationStatus;
    channel: ConversationChannel;
    source: ConversationSource;
    startedAt: string;
    lastMessageAt: string | null;
    endedAt: string | null;
    messageCount: number;
  } | null;
  recording: {
    id: string;
    status: RecordingStatus;
    fileName: string;
    durationSeconds: number | null;
    fileSizeBytes: number | null;
  } | null;
  transcript: {
    id: string;
    status: TranscriptStatus;
    language: string | null;
    wordCount: number;
    confidence: number | null;
    summary: string | null;
  } | null;
  counts: {
    sessions: number;
    realtimeSessions: number;
    recordings: number;
    transcripts: number;
  };
  twilioCallSid: string;
  callerNumber: string;
  calledNumber: string;
  direction: CallDirection;
  status: CallStatus;
  source: CallSource;
  endReason: CallEndReason;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export type CallDetails = CallSummary;

export interface CallRecordingSummary {
  id: string;
  organizationId: string;
  callId: string;
  callSessionId: string;
  twilioCallSid: string;
  storageProvider: string | null;
  fileName: string;
  mimeType: string;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  status: RecordingStatus;
  recordingStartedAt: string | null;
  recordingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  call?: {
    id: string;
    callerNumber: string;
    calledNumber: string;
    startedAt: string;
    agent: {
      id: string;
      name: string;
      status: AgentStatus;
    };
  };
}

export type CallRecordingDetails = CallRecordingSummary;

export interface CallRecordingListResponse {
  total: number;
  page: number;
  limit: number;
  data: CallRecordingSummary[];
}

export interface CallRecordingListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: RecordingStatus;
  callId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CallRecordingDownloadAccess {
  url: string;
  expiresInSeconds: number;
}

export interface CallTranscriptSegment {
  id: string;
  transcriptId: string;
  speaker: SpeakerType;
  startMs: number;
  endMs: number;
  text: string;
  confidence: number | null;
  sequence: number;
  createdAt: string;
}

export interface CallTranscriptSummary {
  id: string;
  organizationId: string;
  callId: string;
  callRecordingId: string;
  conversationId: string | null;
  status: TranscriptStatus;
  language: string | null;
  provider: string | null;
  durationSeconds: number | null;
  wordCount: number;
  confidence: number | null;
  fullText: string;
  summary: string | null;
  failureReason: string | null;
  processingTimeMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  segmentCount: number;
  call?: {
    id: string;
    callerNumber: string;
    calledNumber: string;
    startedAt: string;
    agent: { id: string; name: string; status: AgentStatus };
  };
  callRecording?: {
    id: string;
    fileName: string;
    status: RecordingStatus;
    durationSeconds: number | null;
  };
}

export type CallTranscriptDetails = CallTranscriptSummary;

export interface CallTranscriptListResponse {
  total: number;
  page: number;
  limit: number;
  data: CallTranscriptSummary[];
}

export interface CallTranscriptListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: TranscriptStatus;
  callId?: string;
  agentId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CallSessionSummary {
  id: string;
  callId: string;
  organizationId: string;
  twilioCallSid: string;
  streamSid: string | null;
  status: CallSessionStatus;
  connectedAt: string | null;
  disconnectedAt: string | null;
  packetCount: number;
  createdAt: string;
  updatedAt: string;
}

export type RealtimeSessionStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "FAILED";

export interface RealtimeSessionSummary {
  id: string;
  organizationId: string;
  callId: string;
  callSessionId: string;
  agentId: string;
  conversationId: string | null;
  openAiSessionId: string | null;
  status: RealtimeSessionStatus;
  audioPacketsSent: number;
  audioPacketsReceived: number;
  lastLatencyMs: number | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  agent: {
    id: string;
    name: string;
  };
}

export interface CallListResponse {
  total: number;
  page: number;
  limit: number;
  nextCursor: string | null;
  data: CallSummary[];
}

export interface CallListQuery {
  page?: number;
  limit?: number;
  cursor?: string;
  search?: string;
  status?: CallStatus;
  direction?: CallDirection;
  source?: CallSource;
  endReason?: CallEndReason;
  agentId?: string;
  phoneNumberId?: string;
  dateFrom?: string;
  dateTo?: string;
  durationMin?: number;
  durationMax?: number;
  sortBy?: "startedAt" | "durationSeconds" | "status";
  sortOrder?: "asc" | "desc";
}

export type CallExportFormat = "csv" | "xlsx";

export interface CallTimelineEvent {
  id: string;
  type:
    | "CALL_CREATED"
    | "CALL_ANSWERED"
    | "REALTIME_CONNECTED"
    | "RECORDING_STARTED"
    | "RECORDING_COMPLETED"
    | "TRANSCRIPT_COMPLETED"
    | "CONVERSATION_COMPLETED"
    | "CALL_ENDED";
  title: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface CallTimelineResponse {
  callId: string;
  events: CallTimelineEvent[];
}

export interface VoiceDashboardStats {
  totalNumbers: number;
  assignedNumbers: number;
  unassignedNumbers: number;
  activeNumbers: number;
  totalCalls: number;
  todayCalls: number;
  completedCalls: number;
  failedCalls: number;
  missedCalls: number;
  averageDurationSeconds: number;
  averageResponseTimeMs: number;
  recordingRate: number;
  transcriptionRate: number;
  statusDistribution: Array<{ status: CallStatus; count: number }>;
  callsPerDay: Array<{ date: string; count: number }>;
  recentCalls: CallSummary[];
  totalStreams: number;
  connectedStreams: number;
  disconnectedStreams: number;
  failedStreams: number;
  packetsProcessed: number;
  realtimeSessions: number;
  activeRealtimeSessions: number;
  failedRealtimeSessions: number;
  realtimeConnectionSuccessRate: number;
  realtimeAudioPacketsSent: number;
  realtimeAudioPacketsReceived: number;
  averageRealtimeLatencyMs: number;
  totalRecordings: number;
  availableRecordings: number;
  failedRecordings: number;
  recordingStorageBytes: number;
  totalTranscripts: number;
  completedTranscripts: number;
  processingTranscripts: number;
  failedTranscripts: number;
  averageTranscriptConfidence: number | null;
  callDurationSeconds: number;
  bookings: number;
  leads: number;
}

export interface PublicWidgetInitInput {
  widgetId: string;
  publicKey: string;
}

export interface PublicWidgetInitResponse {
  widget: {
    id: string;
    name: string;
    primaryColor: string;
    position: WidgetPosition;
    welcomeMessage: string;
  };
  agent: {
    id: string;
    name: string;
    status: AgentStatus;
  };
}

export interface PublicWidgetConversationInput extends PublicWidgetInitInput {
  visitorId?: string;
}

export interface PublicWidgetConversationResponse {
  conversationId: string;
  visitorId: string;
  conversation: ConversationSummary;
}

export interface PublicWidgetChatInput extends PublicWidgetInitInput {
  conversationId: string;
  visitorId: string;
  message: string;
}

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "BOOKED"
  | "CUSTOMER"
  | "LOST"
  | "CLOSED";
export type LeadSource = "VOICE" | "CHAT" | "WIDGET" | "MANUAL" | "IMPORT" | "AI_AGENT";

export interface LeadSummary {
  id: string;
  organizationId: string;
  source: LeadSource;
  status: LeadStatus;
  score: number;
  notes: string | null;
  metadata?: unknown;
  lastInteractionAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    company: string | null;
  };
  agent: { id: string; name: string } | null;
}

export interface LeadListResponse {
  data: LeadSummary[];
  nextCursor: string | null;
}

export interface LeadListQuery {
  limit?: number;
  cursor?: string;
  status?: LeadStatus;
  source?: LeadSource;
  search?: string;
  includeDeleted?: boolean;
}

export interface CreateLeadInput {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  address?: string;
  notes?: string;
  source?: LeadSource;
  status?: LeadStatus;
  assignedAgentId?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  countryCode?: string;
}

export type UpdateLeadInput = Partial<CreateLeadInput>;

export type LeadImportStatus = "PENDING" | "MAPPING" | "PREVIEWED" | "PROCESSING" | "COMPLETED" | "FAILED";
export interface LeadImportSummary {
  id: string;
  organizationId: string;
  fileName: string;
  status: LeadImportStatus;
  mapping: Record<string, string>;
  previewRows: unknown[];
  failedRows: unknown[];
  duplicateRows: unknown[];
  rowsFound: number;
  rowsValid: number;
  rowsInvalid: number;
  rowsDuplicate: number;
  rowsProcessed: number;
  rowsImported: number;
  rowsFailed: number;
  duplicates: number;
  campaignId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CreateCampaignFromLeadImportInput {
  assignedAgentId: string;
  name: string;
  description?: string;
  campaignType?: CampaignType;
  scheduleType?: "IMMEDIATE" | "SCHEDULED";
  scheduledAt?: string;
  maxAttempts?: number;
}

export type CommunicationProvider = "TWILIO";
export type CommunicationStatus = "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";

export interface CommunicationMessageSummary {
  id: string;
  organizationId: string;
  threadId: string;
  provider: CommunicationProvider;
  providerMessageId: string | null;
  direction: "INBOUND" | "OUTBOUND";
  status: CommunicationStatus;
  body: string;
  phone: string;
  queuedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationThreadSummary {
  id: string;
  organizationId: string;
  contactId: string;
  channel: string;
  lastMessageAt: string | null;
  lastDirection: "INBOUND" | "OUTBOUND" | null;
  unreadCount: number;
  contact: { id: string; name: string; phone: string | null; email: string | null };
  messages: CommunicationMessageSummary[];
}

export interface CommunicationListResponse<T> {
  total: number;
  page: number;
  limit: number;
  data: T[];
}

export interface SendCommunicationInput {
  phone: string;
  message: string;
  threadId?: string;
}

export interface KnowledgeBaseSummary {
  id: string;
  organizationId: string;
  agentId: string | null;
  name: string;
  description: string | null;
  status: KnowledgeBaseStatus;
  assignedAgent: {
    id: string;
    name: string;
  } | null;
  documentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export type KnowledgeBaseDetails = KnowledgeBaseSummary;

export interface KnowledgeBaseListResponse {
  total: number;
  page: number;
  limit: number;
  data: KnowledgeBaseSummary[];
}

export interface KnowledgeBaseListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: KnowledgeBaseStatus;
}

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
  agentId?: string | null;
  status: KnowledgeBaseStatus;
}

export type UpdateKnowledgeBaseInput = Partial<CreateKnowledgeBaseInput>;

export interface AssignAgentInput {
  agentId?: string | null;
}

export interface DocumentSummary {
  id: string;
  organizationId: string;
  knowledgeBaseId: string;
  knowledgeBase: {
    id: string;
    name: string;
  };
  name: string;
  description: string | null;
  fileName: string | null;
  originalFileName: string | null;
  fileType: string | null;
  fileExtension: string | null;
  fileSize: number | null;
  storageProvider: string | null;
  uploadStatus: UploadStatus;
  processingStatus: ProcessingStatus;
  uploadedBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export type DocumentDetails = DocumentSummary;

export interface DocumentListResponse {
  total: number;
  page: number;
  limit: number;
  data: DocumentSummary[];
}

export interface DocumentListQuery {
  page?: number;
  limit?: number;
  knowledgeBaseId?: string;
  search?: string;
  uploadStatus?: UploadStatus;
  processingStatus?: ProcessingStatus;
}

export interface CreateDocumentInput {
  knowledgeBaseId: string;
  name: string;
  description?: string;
}

export interface UpdateDocumentInput {
  name?: string;
  description?: string;
  uploadStatus?: UploadStatus;
  processingStatus?: ProcessingStatus;
}

export interface UploadPdfInput {
  knowledgeBaseId: string;
  description?: string;
  file: File;
}

export interface DocumentDownloadAccess {
  url: string;
  expiresInSeconds: number;
}

export interface EmbeddingSourceStatus {
  sourceId: string;
  sourceType: "document" | "website";
  status: ProcessingStatus | WebsiteSourceStatus;
  queued: boolean;
  chunkCount: number;
  embeddingCount: number;
}

export interface EmbeddingModelStats {
  embeddingModel: string;
  dimensions: number;
  totalEmbeddings: number;
}

export interface EmbeddingStats {
  totalDocuments: number;
  totalWebsites: number;
  totalChunks: number;
  totalEmbeddings: number;
  processedSources: number;
  failedSources: number;
  processingStatus: "PENDING" | "COMPLETED" | "FAILED";
  models: EmbeddingModelStats[];
}

export interface KnowledgeChunkSummary {
  id: string;
  organizationId: string;
  knowledgeBaseId: string;
  documentId: string | null;
  websiteSourceId: string | null;
  chunkIndex: number;
  chunkText: string;
  tokenCount: number;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  embedding: {
    id: string;
    embeddingModel: string;
    dimensions: number;
    createdAt: string;
  } | null;
}

export interface KnowledgeChunkListResponse {
  total: number;
  page: number;
  limit: number;
  data: KnowledgeChunkSummary[];
}

export interface KnowledgeChunkListQuery {
  page?: number;
  limit?: number;
  documentId?: string;
  websiteSourceId?: string;
  search?: string;
}

export interface WebsiteContentDetails {
  id: string;
  content: string;
  htmlContent: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebsiteSourceSummary {
  id: string;
  organizationId: string;
  knowledgeBaseId: string;
  knowledgeBase: {
    id: string;
    name: string;
  };
  url: string;
  title: string | null;
  description: string | null;
  status: WebsiteSourceStatus;
  contentLength: number;
  lastScrapedAt: string | null;
  createdAt: string;
  updatedAt: string;
  content: WebsiteContentDetails | null;
}

export type WebsiteSourceDetails = WebsiteSourceSummary;

export interface WebsiteSourceListResponse {
  total: number;
  page: number;
  limit: number;
  data: WebsiteSourceSummary[];
}

export interface WebsiteSourceListQuery {
  page?: number;
  limit?: number;
  knowledgeBaseId?: string;
  search?: string;
  status?: WebsiteSourceStatus;
}

export interface CreateWebsiteSourceInput {
  knowledgeBaseId: string;
  url: string;
}

export interface FaqSummary {
  id: string;
  organizationId: string;
  knowledgeBaseId: string;
  knowledgeBase?: {
    id: string;
    name: string;
  };
  question: string;
  answer: string;
  status: FaqStatus;
  createdAt: string;
  updatedAt: string;
}

export type FaqDetails = FaqSummary;

export interface FaqListResponse {
  total: number;
  page: number;
  limit: number;
  data: FaqSummary[];
}

export interface FaqListQuery {
  page?: number;
  limit?: number;
  knowledgeBaseId?: string;
  search?: string;
  status?: FaqStatus;
}

export interface CreateFaqInput {
  knowledgeBaseId: string;
  question: string;
  answer: string;
  status?: FaqStatus;
}

export interface UpdateFaqInput {
  question?: string;
  answer?: string;
  status?: FaqStatus;
}

export type RagSourceType = "document" | "website" | "faq";

export interface RagSourceCitation {
  sourceId: string;
  sourceType: RagSourceType;
  sourceName: string;
  relevanceScore: number;
  chunkReference: number;
  knowledgeBaseId: string;
  documentId: string | null;
  websiteSourceId: string | null;
  faqEntryId: string | null;
}

export interface RagRetrievedChunk {
  chunkId: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  sourceId: string;
  sourceType: RagSourceType;
  sourceName: string;
  chunkIndex: number;
  chunkText: string;
  tokenCount: number;
  relevanceScore: number;
}

export interface RagAskInput {
  agentId: string;
  question: string;
  topK?: number;
}

export interface RagSearchInput {
  knowledgeBaseId: string;
  query: string;
  topK?: number;
}

export interface RagAskResponse {
  answer: string;
  sources: RagSourceCitation[];
  retrievedChunks: RagRetrievedChunk[];
  confidence: number;
  metadata: {
    retrievalTimeMs: number;
    resultCount: number;
    knowledgeBaseIds: string[];
  };
}

export interface RagSearchResponse {
  query: string;
  answer: string;
  results: RagRetrievedChunk[];
  sources: RagSourceCitation[];
  confidence: number;
  retrievalTimeMs: number;
}

export interface RagAnalytics {
  totalSearches: number;
  averageRetrievalTime: number;
  averageSimilarityScore: number;
  failedRetrievals: number;
  topQueries: Array<{
    query: string;
    count: number;
  }>;
  knowledgeUsage: {
    documentChunks: number;
    websiteChunks: number;
    faqChunks: number;
  };
}

export interface MessageSummary {
  id: string;
  organizationId: string;
  conversationId: string;
  senderType: SenderType;
  content: string;
  messageType: MessageType;
  tokenCount: number;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummary {
  id: string;
  organizationId: string;
  agentId: string;
  agent: {
    id: string;
    name: string;
    status: AgentStatus;
  };
  visitorId: string | null;
  sessionId: string | null;
  channel: ConversationChannel;
  status: ConversationStatus;
  source: ConversationSource;
  messageCount: number;
  startedAt: string;
  lastMessageAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetails extends ConversationSummary {
  messages: MessageSummary[];
  statistics: {
    messageCount: number;
    tokenCount: number;
    durationSeconds: number;
  };
}

export interface ConversationListResponse {
  total: number;
  page: number;
  limit: number;
  data: ConversationSummary[];
}

export interface ConversationListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ConversationStatus;
  agentId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateConversationInput {
  agentId: string;
  channel: ConversationChannel;
}

export interface CreateConversationResponse {
  conversationId: string;
  conversation: ConversationSummary;
}

export interface MessageListResponse {
  total: number;
  page: number;
  limit: number;
  data: MessageSummary[];
}

export interface MessageListQuery {
  page?: number;
  limit?: number;
}

export interface SendMessageInput {
  content: string;
}

export interface ConversationAnalytics {
  totalConversations: number;
  activeConversations: number;
  closedConversations: number;
  averageMessages: number;
  averageDurationSeconds: number;
  totalTokens: number;
}

export interface ConversationMemorySummary {
  id: string;
  organizationId: string;
  conversationId: string;
  summary: string;
  messageCount: number;
  tokenEstimate: number;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryFact {
  id: string;
  organizationId: string;
  conversationId: string;
  factType: MemoryFactType;
  factKey: string;
  factValue: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMemoryResponse {
  summary: ConversationMemorySummary | null;
  facts: MemoryFact[];
  history: ConversationMemorySummary[];
  statistics: {
    messagesProcessed: number;
    currentMessageCount: number;
    memoryUpdates: number;
    tokenSavingsEstimate: number;
    factCount: number;
  };
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface SendChatMessageInput {
  agentId: string;
  conversationId: string;
  message: string;
}

export interface SendChatMessageResponse {
  userMessage: MessageSummary;
  assistantMessage: MessageSummary;
  sources: RagSourceCitation[];
  retrievedChunks: RagRetrievedChunk[];
  tokenUsage: TokenUsage;
  responseTime: number;
  model: string;
  metadata: {
    retrievalCount: number;
    knowledgeBaseIds: string[];
    memoryUsed: boolean;
    memoryFactCount: number;
    toolCalls: Array<{
      callId: string;
      name: string;
      executionId?: string;
      success: boolean;
    }>;
  };
}

export interface ToolSummary {
  id: string;
  organizationId: string;
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
  schema: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface ToolExecutionSummary {
  id: string;
  organizationId: string;
  callId: string | null;
  conversationId: string | null;
  agentId: string | null;
  toolName: string;
  status: ToolExecutionStatus;
  input: unknown;
  output: unknown | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ToolExecutionListQuery {
  page?: number;
  limit?: number;
  status?: ToolExecutionStatus;
  toolName?: string;
  conversationId?: string;
  callId?: string;
  agentId?: string;
}

export interface ToolExecutionListResponse {
  total: number;
  page: number;
  limit: number;
  data: ToolExecutionSummary[];
}

export interface ToolStats {
  total: number;
  success: number;
  failed: number;
  rejected: number;
  successRate: number;
  failureRate: number;
  byTool: Array<{ toolName: string; count: number }>;
}

export interface UpdateToolStatusInput {
  enabled: boolean;
}

export interface ApiEnvelope<T> {
  data: T;
  requestId: string;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  timestamp: string;
  dependencies: {
    database: "configured" | "unavailable";
    redis: "configured" | "unavailable";
  };
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  role: MemberRole;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  organizationName: string;
  industry: string;
  companySize?: string;
  password: string;
  country: Country;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}
