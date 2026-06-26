import type {
  AuthResponse,
  AgentDetails,
  AgentListQuery,
  AgentListResponse,
  AppointmentDetails,
  AppointmentListQuery,
  AppointmentListResponse,
  AvailabilityRule,
  AvailabilitySlot,
  AvailabilitySlotsQuery,
  BillingPlanSummary,
  BillingSubscriptionSummary,
  UsageSummary,
  UsageEventSummary,
  AnalyticsDashboard,
  AiCallSummary,
  CallSummaryListResponse,
  CallSummaryOutcome,
  CallSummarySentiment,
  CallDetails,
  CallRecordingDetails,
  CallRecordingDownloadAccess,
  CallRecordingListQuery,
  CallRecordingListResponse,
  CallTranscriptDetails,
  CallTranscriptListQuery,
  CallTranscriptListResponse,
  CallTranscriptSegment,
  CallListQuery,
  CallListResponse,
  CallSessionSummary,
  CallTimelineResponse,
  CallExportFormat,
  RealtimeSessionSummary,
  CreateAgentInput,
  CreateAppointmentInput,
  CreateAvailabilityInput,
  CreateConversationInput,
  CreateDocumentInput,
  CreateFaqInput,
  CreateKnowledgeBaseInput,
  CreateWidgetInput,
  AssignPhoneNumberAgentInput,
  CreateWebsiteSourceInput,
  CurrentOrganization,
  GreetingDecision,
  GreetingSettings,
  ConversationAnalytics,
  ConversationDetails,
  ConversationListQuery,
  ConversationListResponse,
  ConversationMemoryResponse,
  CommunicationListResponse,
  CommunicationMessageSummary,
  CommunicationThreadSummary,
  CreateConversationResponse,
  DocumentDetails,
  DocumentDownloadAccess,
  DocumentListQuery,
  DocumentListResponse,
  EmbeddingSourceStatus,
  EmbeddingStats,
  FaqDetails,
  FaqListQuery,
  FaqListResponse,
  ForgotPasswordInput,
  InviteMemberInput,
  KnowledgeChunkListQuery,
  KnowledgeChunkListResponse,
  KnowledgeBaseDetails,
  KnowledgeBaseListQuery,
  KnowledgeBaseListResponse,
  LeadListQuery,
  LeadListResponse,
  LeadSummary,
  CreateLeadInput,
  UpdateLeadInput,
  LeadImportSummary,
  CreateCampaignFromLeadImportInput,
  LoginInput,
  MarketplaceSearchQuery,
  MarketplaceSearchResponse,
  MessageListQuery,
  MessageListResponse,
  PhoneNumberDetails,
  PhoneNumberListQuery,
  PhoneNumberListResponse,
  PhoneNumberSyncResponse,
  PurchaseMarketplaceNumberInput,
  CreateExternalPhoneNumberInput,
  ExternalPhoneNumber,
  ExternalPhoneNumberListResponse,
  ExternalNumberVerificationMethod,
  PortRequest,
  CreatePortRequestInput,
  CustomerProfile,
  CustomerMemoryContext,
  CustomerTimelineCategory,
  CustomerTimelineEventType,
  CustomerTimelineResponse,
  OrganizationInvitationSummary,
  OrganizationMemberSummary,
  RegisterInput,
  RagAnalytics,
  RagAskInput,
  RagAskResponse,
  RagSearchInput,
  RagSearchResponse,
  ResetPasswordInput,
  SendMessageInput,
  SendCommunicationInput,
  SendChatMessageInput,
  SendChatMessageResponse,
  UpdateAgentInput,
  UpdateAppointmentInput,
  UpdateAvailabilityInput,
  UpdateDocumentInput,
  UpdateFaqInput,
  UpdateKnowledgeBaseInput,
  UpdateMemberRoleInput,
  UpdateOrganizationInput,
  UpdateGreetingSettingsInput,
  UpdateWidgetInput,
  TwilioConnectionResponse,
  ToolExecutionListQuery,
  ToolExecutionListResponse,
  ToolStats,
  ToolSummary,
  UpdateToolStatusInput,
  VoiceDashboardStats,
  WidgetDetails,
  WidgetListQuery,
  WidgetListResponse,
  WebsiteSourceDetails,
  WebsiteSourceListQuery,
  WebsiteSourceListResponse,
  AutomationDashboard,
  AutomationExecution,
  AutomationWorkflow,
  OutboundCall,
  OutboundCallStatus,
  Campaign,
  CampaignScheduleType,
  CampaignStatus,
  CampaignType,
  WorkflowBuilderConfiguration,
  WorkflowTemplateSummary,
} from "@ai-agent-platform/types";
import { webEnv } from "@/config/env";
import { useAuthStore } from "@/store/auth-store";

const apiBaseUrl = `${webEnv.NEXT_PUBLIC_API_URL}/api/v1`;

interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipRefresh?: boolean;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await fetchWithAuth(path, options);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export const authApi = {
  register(input: RegisterInput) {
    return apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
      skipAuth: true,
    });
  },
  login(input: LoginInput) {
    return apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
      skipAuth: true,
    });
  },
  async refresh(refreshToken: string) {
    const response = await apiRequest<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
      skipRefresh: true,
    });
    useAuthStore.getState().setSession(response);
    return response;
  },
  forgotPassword(input: ForgotPasswordInput) {
    return apiRequest<{ success: true }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(input),
      skipAuth: true,
    });
  },
  resetPassword(input: ResetPasswordInput) {
    return apiRequest<{ success: true }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(input),
      skipAuth: true,
    });
  },
  async logout() {
    const refreshToken = useAuthStore.getState().refreshToken;

    if (refreshToken) {
      await apiRequest<{ success: true }>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
        skipRefresh: true,
      }).catch(() => undefined);
    }

    useAuthStore.getState().clearSession();
  },
  async currentOrganization() {
    const organization = await apiRequest<CurrentOrganization>("/organizations/current");
    useAuthStore.getState().setCurrentOrganization(organization);
    return organization;
  },
  updateCurrentOrganization(input: UpdateOrganizationInput) {
    return apiRequest<CurrentOrganization>("/organizations/current", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  greetingSettings() {
    return apiRequest<GreetingSettings>("/organizations/greeting-settings");
  },
  updateGreetingSettings(input: UpdateGreetingSettingsInput) {
    return apiRequest<GreetingSettings>("/organizations/greeting-settings", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  greetingPreview(id: string) {
    return apiRequest<GreetingDecision>(`/customers/${id}/memory-context/greeting-preview`);
  },
  organizationMembers() {
    return apiRequest<OrganizationMemberSummary[]>("/organizations/members");
  },
  inviteOrganizationMember(input: InviteMemberInput) {
    return apiRequest<OrganizationInvitationSummary>("/organizations/members", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateOrganizationMemberRole(memberId: string, input: UpdateMemberRoleInput) {
    return apiRequest<OrganizationMemberSummary>(`/organizations/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  removeOrganizationMember(memberId: string) {
    return apiRequest<{ success: true }>(`/organizations/members/${memberId}`, {
      method: "DELETE",
    });
  },
  agents(query: AgentListQuery = {}) {
    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        search.set(key, String(value));
      }
    }

    const suffix = search.toString() ? `?${search.toString()}` : "";
    return apiRequest<AgentListResponse>(`/agents${suffix}`);
  },
  createAgent(input: CreateAgentInput) {
    return apiRequest<AgentDetails>("/agents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  agent(agentId: string) {
    return apiRequest<AgentDetails>(`/agents/${agentId}`);
  },
  updateAgent(agentId: string, input: UpdateAgentInput) {
    return apiRequest<AgentDetails>(`/agents/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  deleteAgent(agentId: string) {
    return apiRequest<{ success: true }>(`/agents/${agentId}`, {
      method: "DELETE",
    });
  },
  duplicateAgent(agentId: string) {
    return apiRequest<AgentDetails>(`/agents/${agentId}/duplicate`, {
      method: "POST",
    });
  },
  appointments(query: AppointmentListQuery = {}) {
    return apiRequest<AppointmentListResponse>(`/appointments${toQuerySuffix(query)}`);
  },
  leads(query: LeadListQuery = {}) {
    return apiRequest<LeadListResponse>(`/leads${toQuerySuffix(query)}`);
  },
  lead(id: string) {
    return apiRequest<LeadSummary>(`/leads/${id}`);
  },
  createLead(input: CreateLeadInput) {
    return apiRequest<LeadSummary>("/leads", { method: "POST", body: JSON.stringify(input) });
  },
  updateLead(id: string, input: UpdateLeadInput) {
    return apiRequest<LeadSummary>(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  deleteLead(id: string) {
    return apiRequest<LeadSummary>(`/leads/${id}`, { method: "DELETE" });
  },
  restoreLead(id: string) {
    return apiRequest<LeadSummary>(`/leads/${id}/restore`, { method: "POST" });
  },
  leadImports(limit = 50) {
    return apiRequest<LeadImportSummary[]>(`/leads/imports?limit=${limit}`);
  },
  uploadLeadCsv(file: File) {
    const body = new FormData();
    body.set("file", file);
    return apiRequest<LeadImportSummary>("/leads/imports/upload", { method: "POST", body });
  },
  confirmLeadImport(id: string, duplicateStrategy: "SKIP" | "UPDATE_EXISTING" | "CREATE_NEW") {
    return apiRequest<LeadImportSummary>(`/leads/imports/${id}/confirm`, { method: "POST", body: JSON.stringify({ duplicateStrategy }) });
  },
  createCampaignFromLeadImport(id: string, input: CreateCampaignFromLeadImportInput) {
    return apiRequest<{ import: LeadImportSummary; campaign: Campaign; estimate: { leadCount: number; estimatedCalls: number; estimatedMinutes: number; estimatedCost: number | null; confirmationRequired: boolean } }>(`/leads/imports/${id}/create-campaign`, { method: "POST", body: JSON.stringify(input) });
  },
  communicationThreads(query: { page?: number; limit?: number } = {}) {
    return apiRequest<CommunicationListResponse<CommunicationThreadSummary>>(
      `/communications/threads${toQuerySuffix(query)}`,
    );
  },
  communicationThread(threadId: string) {
    return apiRequest<CommunicationThreadSummary>(`/communications/threads/${threadId}`);
  },
  communicationMessages(
    query: { page?: number; limit?: number; threadId?: string; status?: string } = {},
  ) {
    return apiRequest<CommunicationListResponse<CommunicationMessageSummary>>(
      `/communications/messages${toQuerySuffix(query)}`,
    );
  },
  sendCommunication(input: SendCommunicationInput) {
    return apiRequest<{ messageId: string; threadId: string; status: string; provider: string }>(
      "/communications/send",
      { method: "POST", body: JSON.stringify(input) },
    );
  },
  retryCommunication(messageId: string) {
    return apiRequest<{ messageId: string; status: string }>(
      `/communications/messages/${messageId}/retry`,
      { method: "POST" },
    );
  },
  communicationQueue() {
    return apiRequest<{ waiting: number; delayed: number; failed: number; available: boolean }>(
      "/communications/queue",
    );
  },
  automations() {
    return apiRequest<AutomationDashboard>("/automations");
  },
  workflowTemplates(category?: string) {
    return apiRequest<WorkflowTemplateSummary[]>(
      `/automation/templates${category ? `?category=${encodeURIComponent(category)}` : ""}`,
    );
  },
  workflowTemplate(id: string) {
    return apiRequest<WorkflowTemplateSummary>(`/automation/templates/${id}`);
  },
  activateWorkflowTemplate(
    id: string,
    input: Partial<WorkflowBuilderConfiguration> & {
      name?: string;
      description?: string;
      enabled?: boolean;
    },
  ) {
    return apiRequest<{ workflow: AutomationWorkflow; created: boolean }>(
      `/automation/templates/${id}/clone`,
      { method: "POST", body: JSON.stringify(input) },
    );
  },
  createAutomationWorkflow(input: {
    name: string;
    description?: string;
    configuration: WorkflowBuilderConfiguration;
    enabled?: boolean;
  }) {
    return apiRequest<AutomationWorkflow>("/automation/workflows", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  automationExecutions(customerProfileId?: string) {
    return apiRequest<AutomationExecution[]>(
      customerProfileId ? `/automations/customers/${customerProfileId}` : "/automations/executions",
    );
  },
  updateAutomationWorkflow(
    id: string,
    input: { name?: string; description?: string; enabled?: boolean },
  ) {
    return apiRequest(`/automations/workflows/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  updateAutomationRule(
    id: string,
    input: {
      delayMinutes?: number;
      enabled?: boolean;
      templateId?: string;
      conditions?: Record<string, unknown>;
    },
  ) {
    return apiRequest(`/automations/rules/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  updateAutomationTemplate(
    id: string,
    input: { name?: string; subject?: string; body?: string; enabled?: boolean },
  ) {
    return apiRequest(`/automations/templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  cancelAutomation(id: string, reason?: string) {
    return apiRequest<{ cancelled: boolean }>(`/automations/executions/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
  billingSubscription() {
    return apiRequest<BillingSubscriptionSummary>("/billing/subscription");
  },
  usageSummary() {
    return apiRequest<UsageSummary>("/usage");
  },
  usageHistory(page = 1, limit = 50) {
    return apiRequest<{ total: number; page: number; limit: number; data: UsageEventSummary[] }>(
      `/usage/history?page=${page}&limit=${limit}`,
    );
  },
  analytics(query = "range=30D") {
    return apiRequest<AnalyticsDashboard>(`/analytics?${query}`);
  },
  billingPlans() {
    return apiRequest<BillingPlanSummary[]>("/billing/plans");
  },
  createBillingCheckout(plan: "STARTER" | "PRO" | "AGENCY") {
    return apiRequest<{ checkoutUrl: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });
  },
  createBillingPortal() {
    return apiRequest<{ portalUrl: string }>("/billing/portal", { method: "POST" });
  },
  changeBillingPlan(plan: "STARTER" | "PRO" | "AGENCY") {
    return apiRequest<{ accepted: boolean; pendingWebhook: boolean; plan: string }>(
      "/billing/subscription/change-plan",
      { method: "POST", body: JSON.stringify({ plan }) },
    );
  },
  cancelBillingSubscription(mode: "IMMEDIATE" | "PERIOD_END" = "PERIOD_END") {
    return apiRequest<{ accepted: boolean; pendingWebhook: boolean }>(
      "/billing/subscription/cancel",
      { method: "POST", body: JSON.stringify({ mode }) },
    );
  },
  pauseBillingSubscription(days: number) {
    return apiRequest<{ accepted: boolean; pendingWebhook: boolean; resumesAt: string }>(
      "/billing/subscription/pause",
      { method: "POST", body: JSON.stringify({ days }) },
    );
  },
  resumeBillingSubscription() {
    return apiRequest<{ accepted: boolean; pendingWebhook: boolean }>(
      "/billing/subscription/resume",
      { method: "POST" },
    );
  },
  appointment(appointmentId: string) {
    return apiRequest<AppointmentDetails>(`/appointments/${appointmentId}`);
  },
  createAppointment(input: CreateAppointmentInput) {
    return apiRequest<AppointmentDetails>("/appointments", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateAppointment(appointmentId: string, input: UpdateAppointmentInput) {
    return apiRequest<AppointmentDetails>(`/appointments/${appointmentId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  cancelAppointment(appointmentId: string) {
    return apiRequest<AppointmentDetails>(`/appointments/${appointmentId}`, {
      method: "DELETE",
    });
  },
  availability() {
    return apiRequest<AvailabilityRule[]>("/availability");
  },
  createAvailability(input: CreateAvailabilityInput) {
    return apiRequest<AvailabilityRule>("/availability", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateAvailability(availabilityId: string, input: UpdateAvailabilityInput) {
    return apiRequest<AvailabilityRule>(`/availability/${availabilityId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  availabilitySlots(query: AvailabilitySlotsQuery) {
    return apiRequest<AvailabilitySlot[]>(`/availability/slots${toQuerySuffix(query)}`);
  },
  knowledgeBases(query: KnowledgeBaseListQuery = {}) {
    return apiRequest<KnowledgeBaseListResponse>(`/knowledge-bases${toQuerySuffix(query)}`);
  },
  createKnowledgeBase(input: CreateKnowledgeBaseInput) {
    return apiRequest<KnowledgeBaseDetails>("/knowledge-bases", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  knowledgeBase(knowledgeBaseId: string) {
    return apiRequest<KnowledgeBaseDetails>(`/knowledge-bases/${knowledgeBaseId}`);
  },
  updateKnowledgeBase(knowledgeBaseId: string, input: UpdateKnowledgeBaseInput) {
    return apiRequest<KnowledgeBaseDetails>(`/knowledge-bases/${knowledgeBaseId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  assignKnowledgeBaseAgent(knowledgeBaseId: string, agentId?: string | null) {
    return apiRequest<KnowledgeBaseDetails>(`/knowledge-bases/${knowledgeBaseId}/assign-agent`, {
      method: "PATCH",
      body: JSON.stringify({ agentId }),
    });
  },
  deleteKnowledgeBase(knowledgeBaseId: string) {
    return apiRequest<{ success: true }>(`/knowledge-bases/${knowledgeBaseId}`, {
      method: "DELETE",
    });
  },
  documents(query: DocumentListQuery = {}) {
    return apiRequest<DocumentListResponse>(`/documents${toQuerySuffix(query)}`);
  },
  createDocument(input: CreateDocumentInput) {
    return apiRequest<DocumentDetails>("/documents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  document(documentId: string) {
    return apiRequest<DocumentDetails>(`/documents/${documentId}`);
  },
  updateDocument(documentId: string, input: UpdateDocumentInput) {
    return apiRequest<DocumentDetails>(`/documents/${documentId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  deleteDocument(documentId: string) {
    return apiRequest<{ success: true }>(`/documents/${documentId}`, {
      method: "DELETE",
    });
  },
  documentDownloadAccess(documentId: string) {
    return apiRequest<DocumentDownloadAccess>(`/documents/${documentId}/download`);
  },
  uploadPdf(input: {
    knowledgeBaseId: string;
    file: File;
    description?: string;
    onProgress?: (progress: number) => void;
  }) {
    return uploadPdfWithProgress(input);
  },
  websiteSources(query: WebsiteSourceListQuery = {}) {
    return apiRequest<WebsiteSourceListResponse>(`/website-sources${toQuerySuffix(query)}`);
  },
  createWebsiteSource(input: CreateWebsiteSourceInput) {
    return apiRequest<WebsiteSourceDetails>("/website-sources", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  websiteSource(websiteSourceId: string) {
    return apiRequest<WebsiteSourceDetails>(`/website-sources/${websiteSourceId}`);
  },
  rescrapeWebsiteSource(websiteSourceId: string) {
    return apiRequest<WebsiteSourceDetails>(`/website-sources/${websiteSourceId}/rescrape`, {
      method: "POST",
    });
  },
  deleteWebsiteSource(websiteSourceId: string) {
    return apiRequest<{ success: true }>(`/website-sources/${websiteSourceId}`, {
      method: "DELETE",
    });
  },
  processDocumentEmbeddings(documentId: string) {
    return apiRequest<EmbeddingSourceStatus>(`/embeddings/process/document/${documentId}`, {
      method: "POST",
    });
  },
  processWebsiteEmbeddings(websiteSourceId: string) {
    return apiRequest<EmbeddingSourceStatus>(`/embeddings/process/website/${websiteSourceId}`, {
      method: "POST",
    });
  },
  embeddingStatus(sourceId: string) {
    return apiRequest<EmbeddingSourceStatus>(`/embeddings/status/${sourceId}`);
  },
  embeddingStats(knowledgeBaseId: string) {
    return apiRequest<EmbeddingStats>(`/embeddings/stats/${knowledgeBaseId}`);
  },
  knowledgeChunks(knowledgeBaseId: string, query: KnowledgeChunkListQuery = {}) {
    return apiRequest<KnowledgeChunkListResponse>(
      `/embeddings/chunks/${knowledgeBaseId}${toQuerySuffix(query)}`,
    );
  },
  conversations(query: ConversationListQuery = {}) {
    return apiRequest<ConversationListResponse>(`/conversations${toQuerySuffix(query)}`);
  },
  createConversation(input: CreateConversationInput) {
    return apiRequest<CreateConversationResponse>("/conversations", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  conversation(conversationId: string) {
    return apiRequest<ConversationDetails>(`/conversations/${conversationId}`);
  },
  closeConversation(conversationId: string) {
    return apiRequest<ConversationDetails>(`/conversations/${conversationId}/close`, {
      method: "POST",
    });
  },
  archiveConversation(conversationId: string) {
    return apiRequest<ConversationDetails>(`/conversations/${conversationId}/archive`, {
      method: "POST",
    });
  },
  deleteConversation(conversationId: string) {
    return apiRequest<{ success: true }>(`/conversations/${conversationId}`, {
      method: "DELETE",
    });
  },
  conversationMessages(conversationId: string, query: MessageListQuery = {}) {
    return apiRequest<MessageListResponse>(
      `/conversations/${conversationId}/messages${toQuerySuffix(query)}`,
    );
  },
  sendConversationMessage(conversationId: string, input: SendMessageInput) {
    return apiRequest<MessageListResponse["data"][number]>(
      `/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },
  conversationAnalytics() {
    return apiRequest<ConversationAnalytics>("/conversations/analytics");
  },
  conversationMemory(conversationId: string) {
    return apiRequest<ConversationMemoryResponse>(`/memory/conversation/${conversationId}`);
  },
  refreshConversationMemory(conversationId: string) {
    return apiRequest<ConversationMemoryResponse>(
      `/memory/conversation/${conversationId}/refresh`,
      {
        method: "POST",
      },
    );
  },
  conversationMemoryFacts(conversationId: string) {
    return apiRequest<ConversationMemoryResponse["facts"]>(
      `/memory/conversation/${conversationId}/facts`,
    );
  },
  deleteMemoryFact(factId: string) {
    return apiRequest<{ success: true }>(`/memory/facts/${factId}`, {
      method: "DELETE",
    });
  },
  sendChatMessage(input: SendChatMessageInput) {
    return apiRequest<SendChatMessageResponse>("/chat/send", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  faqs(query: FaqListQuery = {}) {
    return apiRequest<FaqListResponse>(`/faqs${toQuerySuffix(query)}`);
  },
  createFaq(input: CreateFaqInput) {
    return apiRequest<FaqDetails>("/faqs", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  faq(faqId: string) {
    return apiRequest<FaqDetails>(`/faqs/${faqId}`);
  },
  updateFaq(faqId: string, input: UpdateFaqInput) {
    return apiRequest<FaqDetails>(`/faqs/${faqId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  deleteFaq(faqId: string) {
    return apiRequest<{ success: true }>(`/faqs/${faqId}`, {
      method: "DELETE",
    });
  },
  askRag(input: RagAskInput) {
    return apiRequest<RagAskResponse>("/rag/ask", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  searchKnowledgeBase(input: RagSearchInput) {
    return apiRequest<RagSearchResponse>("/rag/search", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  ragAnalytics(knowledgeBaseId: string) {
    return apiRequest<RagAnalytics>(`/rag/analytics/${knowledgeBaseId}`);
  },
  voiceDashboard() {
    return apiRequest<VoiceDashboardStats>("/voice/dashboard");
  },
  twilioStatus() {
    return apiRequest<TwilioConnectionResponse>("/voice/twilio/status");
  },
  verifyTwilio() {
    return apiRequest<TwilioConnectionResponse>("/voice/twilio/verify", {
      method: "POST",
    });
  },
  phoneNumbers(query: PhoneNumberListQuery = {}) {
    return apiRequest<PhoneNumberListResponse>(`/voice/phone-numbers${toQuerySuffix(query)}`);
  },
  syncPhoneNumbers() {
    return apiRequest<PhoneNumberSyncResponse>("/voice/phone-numbers/sync", {
      method: "POST",
    });
  },
  phoneNumber(phoneNumberId: string) {
    return apiRequest<PhoneNumberDetails>(`/voice/phone-numbers/${phoneNumberId}`);
  },
  assignPhoneNumberAgent(phoneNumberId: string, input: AssignPhoneNumberAgentInput) {
    return apiRequest<PhoneNumberDetails>(`/voice/phone-numbers/${phoneNumberId}/assign-agent`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  unassignPhoneNumber(phoneNumberId: string) {
    return apiRequest<PhoneNumberDetails>(`/voice/phone-numbers/${phoneNumberId}/unassign`, {
      method: "POST",
    });
  },
  enablePhoneNumber(phoneNumberId: string) {
    return apiRequest<PhoneNumberDetails>(`/voice/phone-numbers/${phoneNumberId}/enable`, {
      method: "POST",
    });
  },
  disablePhoneNumber(phoneNumberId: string) {
    return apiRequest<PhoneNumberDetails>(`/voice/phone-numbers/${phoneNumberId}/disable`, {
      method: "POST",
    });
  },
  searchMarketplaceNumbers(query: MarketplaceSearchQuery) {
    return apiRequest<MarketplaceSearchResponse>(
      `/voice/marketplace/search${toQuerySuffix(query)}`,
    );
  },
  purchaseMarketplaceNumber(input: PurchaseMarketplaceNumberInput) {
    return apiRequest<PhoneNumberDetails>("/voice/marketplace/purchase", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  releaseMarketplaceNumber(phoneNumberId: string) {
    return apiRequest<PhoneNumberDetails>("/voice/marketplace/release", {
      method: "POST",
      body: JSON.stringify({ phoneNumberId }),
    });
  },
  assignMarketplaceNumberAgent(phoneNumberId: string, input: AssignPhoneNumberAgentInput) {
    return apiRequest<PhoneNumberDetails>("/voice/marketplace/assign-agent", {
      method: "POST",
      body: JSON.stringify({ phoneNumberId, ...input }),
    });
  },
  activateMarketplaceNumber(phoneNumberId: string) {
    return apiRequest<PhoneNumberDetails>("/voice/marketplace/activate", {
      method: "POST",
      body: JSON.stringify({ phoneNumberId }),
    });
  },
  externalNumbers() {
    return apiRequest<ExternalPhoneNumberListResponse>("/voice/external-numbers");
  },
  externalNumber(id: string) {
    return apiRequest<ExternalPhoneNumber>(`/voice/external-numbers/${id}`);
  },
  createExternalNumber(input: CreateExternalPhoneNumberInput) {
    return apiRequest<ExternalPhoneNumber>("/voice/external-numbers", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  verifyExternalNumber(id: string, code: string) {
    return apiRequest<ExternalPhoneNumber>("/voice/external-numbers/verify", {
      method: "POST",
      body: JSON.stringify({ id, code }),
    });
  },
  resendExternalNumberOtp(id: string, verificationMethod: ExternalNumberVerificationMethod) {
    return apiRequest<{
      sent: boolean;
      method: ExternalNumberVerificationMethod;
      expiresAt: string;
    }>(`/voice/external-numbers/${id}/resend`, {
      method: "POST",
      body: JSON.stringify({ verificationMethod }),
    });
  },
  assignExternalNumber(id: string, agentId?: string) {
    return apiRequest<ExternalPhoneNumber>(`/voice/external-numbers/${id}/assign-agent`, {
      method: "POST",
      body: JSON.stringify({ agentId: agentId || null }),
    });
  },
  startExternalNumberTest(id: string) {
    return apiRequest<{
      sessionId: string;
      expiresAt: string;
      status: "WAITING_FOR_CALL";
      instruction: string;
      externalNumber: ExternalPhoneNumber;
    }>(`/voice/external-numbers/${id}/test-call`, { method: "POST" });
  },
  disableExternalNumber(id: string) {
    return apiRequest<ExternalPhoneNumber>(`/voice/external-numbers/${id}/disable`, {
      method: "POST",
    });
  },
  portRequests() {
    return apiRequest<{ total: number; data: PortRequest[] }>("/voice/port-requests");
  },
  portRequest(id: string) {
    return apiRequest<PortRequest>(`/voice/port-requests/${id}`);
  },
  createPortRequest(input: CreatePortRequestInput) {
    return apiRequest<PortRequest>("/voice/port-requests", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  uploadPortLoa(id: string, file: File) {
    const body = new FormData();
    body.set("file", file);
    return apiRequest<PortRequest>(`/voice/port-requests/${id}/loa`, { method: "POST", body });
  },
  submitPortRequest(id: string) {
    return apiRequest<PortRequest>(`/voice/port-requests/${id}/submit`, { method: "POST" });
  },
  cancelPortRequest(id: string) {
    return apiRequest<PortRequest>(`/voice/port-requests/${id}/cancel`, { method: "POST" });
  },
  assignPortRequest(id: string, agentId?: string) {
    return apiRequest<PortRequest>(`/voice/port-requests/${id}/assign-agent`, {
      method: "POST",
      body: JSON.stringify({ agentId: agentId || null }),
    });
  },
  portLoaDownload(id: string) {
    return apiRequest<{ url: string; expiresInSeconds: number }>(
      `/voice/port-requests/${id}/loa/download`,
    );
  },
  customers(search?: string) {
    return apiRequest<CustomerProfile[]>(
      `/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    );
  },
  customer(id: string) {
    return apiRequest<CustomerProfile>(`/customers/${id}`);
  },
  customerMemory(id: string) {
    return apiRequest<CustomerMemoryContext>(`/customers/${id}/memory-context`);
  },
  customerTimeline(
    id: string,
    query: {
      cursor?: string;
      limit?: number;
      category?: CustomerTimelineCategory;
      eventType?: CustomerTimelineEventType;
    } = {},
  ) {
    return apiRequest<CustomerTimelineResponse>(`/customers/${id}/timeline${toQuerySuffix(query)}`);
  },
  createCustomer(input: Partial<CustomerProfile> & { name: string }) {
    return apiRequest<CustomerProfile>("/customers", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateCustomer(id: string, input: Partial<CustomerProfile>) {
    return apiRequest<CustomerProfile>(`/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  calls(query: CallListQuery = {}) {
    return apiRequest<CallListResponse>(`/voice/calls${toQuerySuffix(query)}`);
  },
  outboundCalls(query: { status?: OutboundCallStatus; limit?: number; cursor?: string } = {}) {
    return apiRequest<OutboundCall[]>(`/outbound-calls${toQuerySuffix(query)}`);
  },
  createOutboundCall(input: {
    customerProfileId: string;
    agentId: string;
    phoneNumberId?: string;
    reasonType?: OutboundCall["reasonType"];
    reasonDescription: string;
  }) {
    return apiRequest<OutboundCall>("/outbound-calls", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  cancelOutboundCall(id: string) {
    return apiRequest<OutboundCall>(`/outbound-calls/${id}/cancel`, { method: "POST" });
  },
  campaigns(query: { status?: CampaignStatus; limit?: number } = {}) {
    return apiRequest<Campaign[]>(`/campaigns${toQuerySuffix(query)}`);
  },
  campaign(id: string) {
    return apiRequest<Campaign>(`/campaigns/${id}`);
  },
  createCampaign(input: {
    name: string;
    description?: string;
    campaignType: CampaignType;
    assignedAgentId: string;
    scheduleType: CampaignScheduleType;
    scheduledAt?: string;
    maxAttempts?: number;
    customerProfileIds?: string[];
    targeting?: Record<string, unknown>;
  }) {
    return apiRequest<Campaign>("/campaigns", { method: "POST", body: JSON.stringify(input) });
  },
  startCampaign(id: string) {
    return apiRequest<Campaign>(`/campaigns/${id}/start`, { method: "POST" });
  },
  pauseCampaign(id: string) {
    return apiRequest<Campaign>(`/campaigns/${id}/pause`, { method: "POST" });
  },
  resumeCampaign(id: string) {
    return apiRequest<Campaign>(`/campaigns/${id}/resume`, { method: "POST" });
  },
  cancelCampaign(id: string) {
    return apiRequest<Campaign>(`/campaigns/${id}/cancel`, { method: "POST" });
  },
  call(callId: string) {
    return apiRequest<CallDetails>(`/voice/calls/${callId}`);
  },
  callTimeline(callId: string) {
    return apiRequest<CallTimelineResponse>(`/voice/calls/${callId}/timeline`);
  },
  callSummary(callId: string) {
    return apiRequest<AiCallSummary | null>(`/calls/${callId}/summary`);
  },
  callSummaries(
    query: {
      page?: number;
      limit?: number;
      search?: string;
      sentiment?: CallSummarySentiment;
      outcome?: CallSummaryOutcome;
    } = {},
  ) {
    return apiRequest<CallSummaryListResponse>(`/call-summaries${toQuerySuffix(query)}`);
  },
  customerSummaries(customerId: string, limit = 25) {
    return apiRequest<AiCallSummary[]>(`/customers/${customerId}/summaries?limit=${limit}`);
  },
  async exportCalls(query: CallListQuery = {}, format: CallExportFormat = "csv") {
    const response = await fetchWithAuth(
      `/voice/calls/export${toQuerySuffix({ ...query, format })}`,
      {},
    );

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    return response.blob();
  },
  callSessions(callId: string) {
    return apiRequest<CallSessionSummary[]>(`/voice/calls/${callId}/sessions`);
  },
  callRealtimeSessions(callId: string) {
    return apiRequest<RealtimeSessionSummary[]>(`/voice/calls/${callId}/realtime-sessions`);
  },
  callRecordings(query: CallRecordingListQuery = {}) {
    return apiRequest<CallRecordingListResponse>(`/voice/recordings${toQuerySuffix(query)}`);
  },
  callRecording(recordingId: string) {
    return apiRequest<CallRecordingDetails>(`/voice/recordings/${recordingId}`);
  },
  callRecordingDownload(recordingId: string) {
    return apiRequest<CallRecordingDownloadAccess>(`/voice/recordings/${recordingId}/download`);
  },
  deleteCallRecording(recordingId: string) {
    return apiRequest<{ success: true }>(`/voice/recordings/${recordingId}`, {
      method: "DELETE",
    });
  },
  callTranscripts(query: CallTranscriptListQuery = {}) {
    return apiRequest<CallTranscriptListResponse>(`/voice/transcripts${toQuerySuffix(query)}`);
  },
  callTranscript(transcriptId: string) {
    return apiRequest<CallTranscriptDetails>(`/voice/transcripts/${transcriptId}`);
  },
  callTranscriptByCall(callId: string) {
    return apiRequest<CallTranscriptDetails | null>(`/voice/transcripts/call/${callId}`);
  },
  callTranscriptSegments(transcriptId: string) {
    return apiRequest<CallTranscriptSegment[]>(`/voice/transcripts/${transcriptId}/segments`);
  },
  reprocessCallTranscript(transcriptId: string) {
    return apiRequest<{ success: true; status: "PENDING" }>(
      `/voice/transcripts/${transcriptId}/reprocess`,
      { method: "POST" },
    );
  },
  widgets(query: WidgetListQuery = {}) {
    return apiRequest<WidgetListResponse>(`/widgets${toQuerySuffix(query)}`);
  },
  createWidget(input: CreateWidgetInput) {
    return apiRequest<WidgetDetails>("/widgets", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  widget(widgetId: string) {
    return apiRequest<WidgetDetails>(`/widgets/${widgetId}`);
  },
  updateWidget(widgetId: string, input: UpdateWidgetInput) {
    return apiRequest<WidgetDetails>(`/widgets/${widgetId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  deleteWidget(widgetId: string) {
    return apiRequest<{ success: true }>(`/widgets/${widgetId}`, {
      method: "DELETE",
    });
  },
  tools() {
    return apiRequest<ToolSummary[]>("/tools");
  },
  updateTool(name: string, input: UpdateToolStatusInput) {
    return apiRequest<ToolSummary>(`/tools/${name}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  toolExecutions(query: ToolExecutionListQuery = {}) {
    return apiRequest<ToolExecutionListResponse>(`/tools/executions${toQuerySuffix(query)}`);
  },
  toolStats() {
    return apiRequest<ToolStats>("/tools/stats");
  },
};

async function fetchWithAuth(path: string, options: ApiRequestOptions): Promise<Response> {
  const response = await rawFetch(path, options);

  if (response.status !== 401 || options.skipRefresh) {
    return response;
  }

  const refreshToken = useAuthStore.getState().refreshToken;

  if (!refreshToken) {
    useAuthStore.getState().clearSession();
    return response;
  }

  try {
    await authApi.refresh(refreshToken);
  } catch {
    useAuthStore.getState().clearSession();
    return response;
  }

  return rawFetch(path, options);
}

function rawFetch(path: string, options: ApiRequestOptions): Promise<Response> {
  const headers = new Headers(options.headers);

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (!options.skipAuth) {
    const accessToken = useAuthStore.getState().accessToken;

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  return fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });
}

function uploadPdfWithProgress(input: {
  knowledgeBaseId: string;
  file: File;
  description?: string;
  onProgress?: (progress: number) => void;
}): Promise<DocumentDetails> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.set("knowledgeBaseId", input.knowledgeBaseId);
    formData.set("file", input.file);

    if (input.description) {
      formData.set("description", input.description);
    }

    const request = new XMLHttpRequest();
    request.open("POST", `${apiBaseUrl}/documents/upload`);

    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    }

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        input.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () => {
      const body = parseJson(request.responseText);

      if (request.status < 200 || request.status >= 300) {
        reject(new Error(readUploadError(body, request.status)));
        return;
      }

      input.onProgress?.(100);
      resolve(body as DocumentDetails);
    };

    request.onerror = () => reject(new Error("Upload failed. Please try again."));
    request.onabort = () => reject(new Error("Upload cancelled."));
    request.send(formData);
  });
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readUploadError(body: unknown, status: number): string {
  if (typeof body === "object" && body && "message" in body) {
    const message = (body as { message?: unknown }).message;
    return typeof message === "string" ? message : `Upload failed with ${status}`;
  }

  return `Upload failed with ${status}`;
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return typeof body?.message === "string"
    ? body.message
    : `Request failed with ${response.status}`;
}

function toQuerySuffix(query: object): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  return search.toString() ? `?${search.toString()}` : "";
}
