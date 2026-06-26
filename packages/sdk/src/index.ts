import type {
  AuthResponse,
  AgentDetails,
  AgentListQuery,
  AgentListResponse,
  AssignPhoneNumberAgentInput,
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
  CreateConversationInput,
  CreateDocumentInput,
  CreateFaqInput,
  CreateKnowledgeBaseInput,
  CreateWidgetInput,
  CreateWebsiteSourceInput,
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
  HealthResponse,
  CurrentOrganization,
  ConversationAnalytics,
  ConversationDetails,
  ConversationListQuery,
  ConversationListResponse,
  ConversationMemoryResponse,
  CreateConversationResponse,
  InviteMemberInput,
  KnowledgeChunkListQuery,
  KnowledgeChunkListResponse,
  KnowledgeBaseDetails,
  KnowledgeBaseListQuery,
  KnowledgeBaseListResponse,
  LoginInput,
  MessageListQuery,
  MessageListResponse,
  MarketplaceSearchQuery,
  MarketplaceSearchResponse,
  PhoneNumberDetails,
  PhoneNumberListQuery,
  PhoneNumberListResponse,
  PhoneNumberSyncResponse,
  PurchaseMarketplaceNumberInput,
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
  SendChatMessageInput,
  SendChatMessageResponse,
  UpdateAgentInput,
  UpdateDocumentInput,
  UpdateFaqInput,
  UpdateKnowledgeBaseInput,
  UpdateMemberRoleInput,
  UpdateOrganizationInput,
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
} from "@ai-agent-platform/types";

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: ApiClientOptions["getAccessToken"];

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.getAccessToken = options.getAccessToken;
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health");
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    return this.request<{ success: true }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ success: true }> {
    return this.request<{ success: true }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ success: true }> {
    return this.request<{ success: true }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async currentOrganization(): Promise<CurrentOrganization> {
    return this.request<CurrentOrganization>("/organizations/current");
  }

  async updateCurrentOrganization(input: UpdateOrganizationInput): Promise<CurrentOrganization> {
    return this.request<CurrentOrganization>("/organizations/current", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async organizationMembers(): Promise<OrganizationMemberSummary[]> {
    return this.request<OrganizationMemberSummary[]>("/organizations/members");
  }

  async inviteOrganizationMember(input: InviteMemberInput): Promise<OrganizationInvitationSummary> {
    return this.request<OrganizationInvitationSummary>("/organizations/members", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateOrganizationMemberRole(
    memberId: string,
    input: UpdateMemberRoleInput,
  ): Promise<OrganizationMemberSummary> {
    return this.request<OrganizationMemberSummary>(`/organizations/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async removeOrganizationMember(memberId: string): Promise<{ success: true }> {
    return this.request<{ success: true }>(`/organizations/members/${memberId}`, {
      method: "DELETE",
    });
  }

  async agents(query: AgentListQuery = {}): Promise<AgentListResponse> {
    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        search.set(key, String(value));
      }
    }

    const suffix = search.toString() ? `?${search.toString()}` : "";
    return this.request<AgentListResponse>(`/agents${suffix}`);
  }

  async createAgent(input: CreateAgentInput): Promise<AgentDetails> {
    return this.request<AgentDetails>("/agents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async agent(agentId: string): Promise<AgentDetails> {
    return this.request<AgentDetails>(`/agents/${agentId}`);
  }

  async updateAgent(agentId: string, input: UpdateAgentInput): Promise<AgentDetails> {
    return this.request<AgentDetails>(`/agents/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteAgent(agentId: string): Promise<{ success: true }> {
    return this.request<{ success: true }>(`/agents/${agentId}`, {
      method: "DELETE",
    });
  }

  async duplicateAgent(agentId: string): Promise<AgentDetails> {
    return this.request<AgentDetails>(`/agents/${agentId}/duplicate`, {
      method: "POST",
    });
  }

  async knowledgeBases(query: KnowledgeBaseListQuery = {}): Promise<KnowledgeBaseListResponse> {
    const suffix = toQuerySuffix(query);
    return this.request<KnowledgeBaseListResponse>(`/knowledge-bases${suffix}`);
  }

  async createKnowledgeBase(input: CreateKnowledgeBaseInput): Promise<KnowledgeBaseDetails> {
    return this.request<KnowledgeBaseDetails>("/knowledge-bases", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async knowledgeBase(knowledgeBaseId: string): Promise<KnowledgeBaseDetails> {
    return this.request<KnowledgeBaseDetails>(`/knowledge-bases/${knowledgeBaseId}`);
  }

  async updateKnowledgeBase(
    knowledgeBaseId: string,
    input: UpdateKnowledgeBaseInput,
  ): Promise<KnowledgeBaseDetails> {
    return this.request<KnowledgeBaseDetails>(`/knowledge-bases/${knowledgeBaseId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async assignKnowledgeBaseAgent(
    knowledgeBaseId: string,
    agentId?: string | null,
  ): Promise<KnowledgeBaseDetails> {
    return this.request<KnowledgeBaseDetails>(`/knowledge-bases/${knowledgeBaseId}/assign-agent`, {
      method: "PATCH",
      body: JSON.stringify({ agentId }),
    });
  }

  async deleteKnowledgeBase(knowledgeBaseId: string): Promise<{ success: true }> {
    return this.request<{ success: true }>(`/knowledge-bases/${knowledgeBaseId}`, {
      method: "DELETE",
    });
  }

  async documents(query: DocumentListQuery = {}): Promise<DocumentListResponse> {
    const suffix = toQuerySuffix(query);
    return this.request<DocumentListResponse>(`/documents${suffix}`);
  }

  async createDocument(input: CreateDocumentInput): Promise<DocumentDetails> {
    return this.request<DocumentDetails>("/documents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async document(documentId: string): Promise<DocumentDetails> {
    return this.request<DocumentDetails>(`/documents/${documentId}`);
  }

  async updateDocument(documentId: string, input: UpdateDocumentInput): Promise<DocumentDetails> {
    return this.request<DocumentDetails>(`/documents/${documentId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteDocument(documentId: string): Promise<{ success: true }> {
    return this.request<{ success: true }>(`/documents/${documentId}`, {
      method: "DELETE",
    });
  }

  async documentDownloadAccess(documentId: string): Promise<DocumentDownloadAccess> {
    return this.request<DocumentDownloadAccess>(`/documents/${documentId}/download`);
  }

  async uploadPdf(input: {
    knowledgeBaseId: string;
    file: File;
    description?: string;
  }): Promise<DocumentDetails> {
    const formData = new FormData();
    formData.set("knowledgeBaseId", input.knowledgeBaseId);
    formData.set("file", input.file);

    if (input.description) {
      formData.set("description", input.description);
    }

    return this.request<DocumentDetails>("/documents/upload", {
      method: "POST",
      body: formData,
    });
  }

  async websiteSources(query: WebsiteSourceListQuery = {}): Promise<WebsiteSourceListResponse> {
    const suffix = toQuerySuffix(query);
    return this.request<WebsiteSourceListResponse>(`/website-sources${suffix}`);
  }

  async createWebsiteSource(input: CreateWebsiteSourceInput): Promise<WebsiteSourceDetails> {
    return this.request<WebsiteSourceDetails>("/website-sources", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async websiteSource(websiteSourceId: string): Promise<WebsiteSourceDetails> {
    return this.request<WebsiteSourceDetails>(`/website-sources/${websiteSourceId}`);
  }

  async rescrapeWebsiteSource(websiteSourceId: string): Promise<WebsiteSourceDetails> {
    return this.request<WebsiteSourceDetails>(`/website-sources/${websiteSourceId}/rescrape`, {
      method: "POST",
    });
  }

  async deleteWebsiteSource(websiteSourceId: string): Promise<{ success: true }> {
    return this.request<{ success: true }>(`/website-sources/${websiteSourceId}`, {
      method: "DELETE",
    });
  }

  async processDocumentEmbeddings(documentId: string): Promise<EmbeddingSourceStatus> {
    return this.request<EmbeddingSourceStatus>(`/embeddings/process/document/${documentId}`, {
      method: "POST",
    });
  }

  async processWebsiteEmbeddings(websiteSourceId: string): Promise<EmbeddingSourceStatus> {
    return this.request<EmbeddingSourceStatus>(`/embeddings/process/website/${websiteSourceId}`, {
      method: "POST",
    });
  }

  async embeddingStatus(sourceId: string): Promise<EmbeddingSourceStatus> {
    return this.request<EmbeddingSourceStatus>(`/embeddings/status/${sourceId}`);
  }

  async embeddingStats(knowledgeBaseId: string): Promise<EmbeddingStats> {
    return this.request<EmbeddingStats>(`/embeddings/stats/${knowledgeBaseId}`);
  }

  async knowledgeChunks(
    knowledgeBaseId: string,
    query: KnowledgeChunkListQuery = {},
  ): Promise<KnowledgeChunkListResponse> {
    return this.request<KnowledgeChunkListResponse>(
      `/embeddings/chunks/${knowledgeBaseId}${toQuerySuffix(query)}`,
    );
  }

  async conversations(query: ConversationListQuery = {}): Promise<ConversationListResponse> {
    return this.request<ConversationListResponse>(`/conversations${toQuerySuffix(query)}`);
  }

  async createConversation(input: CreateConversationInput): Promise<CreateConversationResponse> {
    return this.request<CreateConversationResponse>("/conversations", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async conversation(conversationId: string): Promise<ConversationDetails> {
    return this.request<ConversationDetails>(`/conversations/${conversationId}`);
  }

  async closeConversation(conversationId: string): Promise<ConversationDetails> {
    return this.request<ConversationDetails>(`/conversations/${conversationId}/close`, {
      method: "POST",
    });
  }

  async archiveConversation(conversationId: string): Promise<ConversationDetails> {
    return this.request<ConversationDetails>(`/conversations/${conversationId}/archive`, {
      method: "POST",
    });
  }

  async deleteConversation(conversationId: string): Promise<{ success: true }> {
    return this.request<{ success: true }>(`/conversations/${conversationId}`, {
      method: "DELETE",
    });
  }

  async conversationMessages(
    conversationId: string,
    query: MessageListQuery = {},
  ): Promise<MessageListResponse> {
    return this.request<MessageListResponse>(
      `/conversations/${conversationId}/messages${toQuerySuffix(query)}`,
    );
  }

  async sendConversationMessage(
    conversationId: string,
    input: SendMessageInput,
  ): Promise<MessageListResponse["data"][number]> {
    return this.request<MessageListResponse["data"][number]>(
      `/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  }

  async conversationAnalytics(): Promise<ConversationAnalytics> {
    return this.request<ConversationAnalytics>("/conversations/analytics");
  }

  async conversationMemory(conversationId: string): Promise<ConversationMemoryResponse> {
    return this.request<ConversationMemoryResponse>(`/memory/conversation/${conversationId}`);
  }

  async refreshConversationMemory(conversationId: string): Promise<ConversationMemoryResponse> {
    return this.request<ConversationMemoryResponse>(
      `/memory/conversation/${conversationId}/refresh`,
      {
        method: "POST",
      },
    );
  }

  async conversationMemoryFacts(
    conversationId: string,
  ): Promise<ConversationMemoryResponse["facts"]> {
    return this.request<ConversationMemoryResponse["facts"]>(
      `/memory/conversation/${conversationId}/facts`,
    );
  }

  async deleteMemoryFact(factId: string): Promise<{ success: true }> {
    return this.request<{ success: true }>(`/memory/facts/${factId}`, {
      method: "DELETE",
    });
  }

  async sendChatMessage(input: SendChatMessageInput): Promise<SendChatMessageResponse> {
    return this.request<SendChatMessageResponse>("/chat/send", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async faqs(query: FaqListQuery = {}): Promise<FaqListResponse> {
    return this.request<FaqListResponse>(`/faqs${toQuerySuffix(query)}`);
  }

  async createFaq(input: CreateFaqInput): Promise<FaqDetails> {
    return this.request<FaqDetails>("/faqs", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async faq(faqId: string): Promise<FaqDetails> {
    return this.request<FaqDetails>(`/faqs/${faqId}`);
  }

  async updateFaq(faqId: string, input: UpdateFaqInput): Promise<FaqDetails> {
    return this.request<FaqDetails>(`/faqs/${faqId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteFaq(faqId: string): Promise<{ success: true }> {
    return this.request<{ success: true }>(`/faqs/${faqId}`, {
      method: "DELETE",
    });
  }

  async askRag(input: RagAskInput): Promise<RagAskResponse> {
    return this.request<RagAskResponse>("/rag/ask", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async searchKnowledgeBase(input: RagSearchInput): Promise<RagSearchResponse> {
    return this.request<RagSearchResponse>("/rag/search", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async ragAnalytics(knowledgeBaseId: string): Promise<RagAnalytics> {
    return this.request<RagAnalytics>(`/rag/analytics/${knowledgeBaseId}`);
  }

  async voiceDashboard(): Promise<VoiceDashboardStats> {
    return this.request<VoiceDashboardStats>("/voice/dashboard");
  }

  async twilioStatus(): Promise<TwilioConnectionResponse> {
    return this.request<TwilioConnectionResponse>("/voice/twilio/status");
  }

  async verifyTwilio(): Promise<TwilioConnectionResponse> {
    return this.request<TwilioConnectionResponse>("/voice/twilio/verify", {
      method: "POST",
    });
  }

  async phoneNumbers(query: PhoneNumberListQuery = {}): Promise<PhoneNumberListResponse> {
    return this.request<PhoneNumberListResponse>(`/voice/phone-numbers${toQuerySuffix(query)}`);
  }

  async syncPhoneNumbers(): Promise<PhoneNumberSyncResponse> {
    return this.request<PhoneNumberSyncResponse>("/voice/phone-numbers/sync", {
      method: "POST",
    });
  }

  async phoneNumber(phoneNumberId: string): Promise<PhoneNumberDetails> {
    return this.request<PhoneNumberDetails>(`/voice/phone-numbers/${phoneNumberId}`);
  }

  async assignPhoneNumberAgent(
    phoneNumberId: string,
    input: AssignPhoneNumberAgentInput,
  ): Promise<PhoneNumberDetails> {
    return this.request<PhoneNumberDetails>(`/voice/phone-numbers/${phoneNumberId}/assign-agent`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async unassignPhoneNumber(phoneNumberId: string): Promise<PhoneNumberDetails> {
    return this.request<PhoneNumberDetails>(`/voice/phone-numbers/${phoneNumberId}/unassign`, {
      method: "POST",
    });
  }

  async enablePhoneNumber(phoneNumberId: string): Promise<PhoneNumberDetails> {
    return this.request<PhoneNumberDetails>(`/voice/phone-numbers/${phoneNumberId}/enable`, {
      method: "POST",
    });
  }

  async disablePhoneNumber(phoneNumberId: string): Promise<PhoneNumberDetails> {
    return this.request<PhoneNumberDetails>(`/voice/phone-numbers/${phoneNumberId}/disable`, {
      method: "POST",
    });
  }

  async searchMarketplaceNumbers(
    query: MarketplaceSearchQuery,
  ): Promise<MarketplaceSearchResponse> {
    return this.request<MarketplaceSearchResponse>(
      `/voice/marketplace/search${toQuerySuffix(query)}`,
    );
  }

  async purchaseMarketplaceNumber(
    input: PurchaseMarketplaceNumberInput,
  ): Promise<PhoneNumberDetails> {
    return this.request<PhoneNumberDetails>("/voice/marketplace/purchase", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async releaseMarketplaceNumber(phoneNumberId: string): Promise<PhoneNumberDetails> {
    return this.request<PhoneNumberDetails>("/voice/marketplace/release", {
      method: "POST",
      body: JSON.stringify({ phoneNumberId }),
    });
  }

  async assignMarketplaceNumberAgent(
    phoneNumberId: string,
    input: AssignPhoneNumberAgentInput,
  ): Promise<PhoneNumberDetails> {
    return this.request<PhoneNumberDetails>("/voice/marketplace/assign-agent", {
      method: "POST",
      body: JSON.stringify({ phoneNumberId, ...input }),
    });
  }

  async activateMarketplaceNumber(phoneNumberId: string): Promise<PhoneNumberDetails> {
    return this.request<PhoneNumberDetails>("/voice/marketplace/activate", {
      method: "POST",
      body: JSON.stringify({ phoneNumberId }),
    });
  }

  async calls(query: CallListQuery = {}): Promise<CallListResponse> {
    return this.request<CallListResponse>(`/voice/calls${toQuerySuffix(query)}`);
  }

  async call(callId: string): Promise<CallDetails> {
    return this.request<CallDetails>(`/voice/calls/${callId}`);
  }

  async callTimeline(callId: string): Promise<CallTimelineResponse> {
    return this.request<CallTimelineResponse>(`/voice/calls/${callId}/timeline`);
  }

  async exportCalls(query: CallListQuery = {}, format: CallExportFormat = "csv"): Promise<Blob> {
    return this.requestBlob(`/voice/calls/export${toQuerySuffix({ ...query, format })}`);
  }

  async callSessions(callId: string): Promise<CallSessionSummary[]> {
    return this.request<CallSessionSummary[]>(`/voice/calls/${callId}/sessions`);
  }

  async callRealtimeSessions(callId: string): Promise<RealtimeSessionSummary[]> {
    return this.request<RealtimeSessionSummary[]>(`/voice/calls/${callId}/realtime-sessions`);
  }

  async callRecordings(query: CallRecordingListQuery = {}): Promise<CallRecordingListResponse> {
    return this.request<CallRecordingListResponse>(`/voice/recordings${toQuerySuffix(query)}`);
  }

  async callRecording(recordingId: string): Promise<CallRecordingDetails> {
    return this.request<CallRecordingDetails>(`/voice/recordings/${recordingId}`);
  }

  async callRecordingDownload(recordingId: string): Promise<CallRecordingDownloadAccess> {
    return this.request<CallRecordingDownloadAccess>(`/voice/recordings/${recordingId}/download`);
  }

  async deleteCallRecording(recordingId: string): Promise<{ success: true }> {
    return this.request<{ success: true }>(`/voice/recordings/${recordingId}`, {
      method: "DELETE",
    });
  }

  async callTranscripts(query: CallTranscriptListQuery = {}): Promise<CallTranscriptListResponse> {
    return this.request<CallTranscriptListResponse>(`/voice/transcripts${toQuerySuffix(query)}`);
  }

  async callTranscript(transcriptId: string): Promise<CallTranscriptDetails> {
    return this.request<CallTranscriptDetails>(`/voice/transcripts/${transcriptId}`);
  }

  async callTranscriptByCall(callId: string): Promise<CallTranscriptDetails | null> {
    return this.request<CallTranscriptDetails | null>(`/voice/transcripts/call/${callId}`);
  }

  async callTranscriptSegments(transcriptId: string): Promise<CallTranscriptSegment[]> {
    return this.request<CallTranscriptSegment[]>(`/voice/transcripts/${transcriptId}/segments`);
  }

  async reprocessCallTranscript(
    transcriptId: string,
  ): Promise<{ success: true; status: "PENDING" }> {
    return this.request<{ success: true; status: "PENDING" }>(
      `/voice/transcripts/${transcriptId}/reprocess`,
      { method: "POST" },
    );
  }

  async widgets(query: WidgetListQuery = {}): Promise<WidgetListResponse> {
    return this.request<WidgetListResponse>(`/widgets${toQuerySuffix(query)}`);
  }

  async createWidget(input: CreateWidgetInput): Promise<WidgetDetails> {
    return this.request<WidgetDetails>("/widgets", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async widget(widgetId: string): Promise<WidgetDetails> {
    return this.request<WidgetDetails>(`/widgets/${widgetId}`);
  }

  async updateWidget(widgetId: string, input: UpdateWidgetInput): Promise<WidgetDetails> {
    return this.request<WidgetDetails>(`/widgets/${widgetId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteWidget(widgetId: string): Promise<{ success: true }> {
    return this.request<{ success: true }>(`/widgets/${widgetId}`, {
      method: "DELETE",
    });
  }

  async tools(): Promise<ToolSummary[]> {
    return this.request<ToolSummary[]>("/tools");
  }

  async updateTool(name: string, input: UpdateToolStatusInput): Promise<ToolSummary> {
    return this.request<ToolSummary>(`/tools/${name}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async toolExecutions(query: ToolExecutionListQuery = {}): Promise<ToolExecutionListResponse> {
    return this.request<ToolExecutionListResponse>(`/tools/executions${toQuerySuffix(query)}`);
  }

  async toolStats(): Promise<ToolStats> {
    return this.request<ToolStats>("/tools/stats");
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const message =
        typeof errorBody?.message === "string"
          ? errorBody.message
          : `API request failed with status ${response.status}`;
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }

  async requestBlob(path: string, init: RequestInit = {}): Promise<Blob> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers = new Headers(init.headers);

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const message =
        typeof errorBody?.message === "string"
          ? errorBody.message
          : `API request failed with status ${response.status}`;
      throw new Error(message);
    }

    return response.blob();
  }
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
