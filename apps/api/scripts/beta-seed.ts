import "dotenv/config";
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

const COUNTS = {
  organizations: 10,
  agents: 50,
  leads: 5_000,
  calls: 10_000,
  recordings: 10_000,
  transcripts: 10_000,
  toolExecutions: 50_000,
} as const;

const TOOL_NAMES = ["book_appointment", "create_lead", "send_email", "send_sms"] as const;
const BATCH_SIZE = Number(process.env.BETA_SEED_BATCH_SIZE ?? 1_000);
const BETA_PREFIX = "beta";

async function main() {
  const startedAt = Date.now();
  console.log("Starting beta seed...");
  console.table(COUNTS);

  await resetBetaData();

  const organizations = buildOrganizations();
  const users = buildUsers();
  const members = organizations.map((organization, index) => ({
    id: betaId("member", index),
    organizationId: organization.id,
    userId: users[index].id,
    role: "OWNER" as const,
  }));
  const agents = buildAgents(organizations);
  const phoneNumbers = buildPhoneNumbers(organizations, agents);
  const conversations = buildConversations(organizations, agents);
  const calls = buildCalls(organizations, agents, phoneNumbers, conversations);
  const callSessions = buildCallSessions(calls);
  const recordings = buildRecordings(calls, callSessions);
  const transcripts = buildTranscripts(calls, recordings, conversations);
  const contacts = buildContacts(organizations);
  const leads = buildLeads(contacts, agents, calls, conversations);
  const tools = buildTools(organizations);
  const toolExecutions = buildToolExecutions(organizations, agents, calls, conversations);

  await createInBatches("organizations", organizations, (data) => prisma.organization.createMany({ data }));
  await createInBatches("users", users, (data) => prisma.user.createMany({ data }));
  await createInBatches("members", members, (data) => prisma.organizationMember.createMany({ data }));
  await createInBatches("agents", agents, (data) => prisma.agent.createMany({ data }));
  await createInBatches("phone numbers", phoneNumbers, (data) => prisma.phoneNumber.createMany({ data }));
  await createInBatches("conversations", conversations, (data) => prisma.conversation.createMany({ data }));
  await createInBatches("calls", calls, (data) => prisma.call.createMany({ data }));
  await createInBatches("call sessions", callSessions, (data) => prisma.callSession.createMany({ data }));
  await createInBatches("recordings", recordings, (data) => prisma.callRecording.createMany({ data }));
  await createInBatches("transcripts", transcripts, (data) => prisma.callTranscript.createMany({ data }));
  await createTranscriptSegments(transcripts);
  await createInBatches("contacts", contacts, (data) => prisma.contact.createMany({ data }));
  await createInBatches("leads", leads, (data) => prisma.lead.createMany({ data }));
  await createInBatches("tools", tools, (data) => prisma.tool.createMany({ data }));
  await createInBatches("tool executions", toolExecutions, (data) =>
    prisma.toolExecution.createMany({ data }),
  );

  console.log(`Beta seed complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
}

async function resetBetaData() {
  console.log("Resetting previous beta seed data...");
  await prisma.organization.deleteMany({ where: { slug: { startsWith: `${BETA_PREFIX}-org-` } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@beta.local" } } });
}

function buildOrganizations() {
  return Array.from({ length: COUNTS.organizations }, (_, index) => ({
    id: betaId("org", index),
    name: `Beta Organization ${index + 1}`,
    slug: `${BETA_PREFIX}-org-${index + 1}`,
    plan: index % 3 === 0 ? ("AGENCY" as const) : ("PRO" as const),
    status: "ACTIVE" as const,
  }));
}

function buildUsers() {
  return Array.from({ length: COUNTS.organizations }, (_, index) => ({
    id: betaId("user", index),
    email: `owner-${index + 1}@beta.local`,
    passwordHash: "$2a$10$7EqJtq98hPqEX7fNZaFWoO.VBpnQJuY6nfMXWfWpvMvStynVv.CwS",
    firstName: "Beta",
    lastName: `Owner ${index + 1}`,
    status: "ACTIVE" as const,
  }));
}

function buildAgents(organizations: Array<{ id: string }>) {
  return Array.from({ length: COUNTS.agents }, (_, index) => {
    const organization = organizations[index % organizations.length];
    return {
      id: betaId("agent", index),
      organizationId: organization.id,
      name: `Beta Voice Agent ${index + 1}`,
      description: "Synthetic beta benchmark agent.",
      language: "en-US",
      voice: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"][index % 6],
      systemPrompt: "You are a concise, helpful AI receptionist. Capture leads and appointment requests when useful.",
      status: "ACTIVE" as const,
    };
  });
}

function buildPhoneNumbers(organizations: Array<{ id: string }>, agents: Array<{ id: string; organizationId: string }>) {
  return organizations.map((organization, index) => {
    const agent = agents.find((item) => item.organizationId === organization.id)!;
    return {
      id: betaId("phone", index),
      organizationId: organization.id,
      agentId: agent.id,
      phoneNumber: `+1415556${String(index).padStart(4, "0")}`,
      friendlyName: `Beta Number ${index + 1}`,
      country: "US",
      capabilities: { voice: true, sms: true },
      provider: "TWILIO" as const,
      status: "ACTIVE" as const,
      twilioSid: `PN${String(index + 1).padStart(32, "0")}`,
      voiceWebhookUrl: `https://beta.example.com/webhooks/twilio/voice`,
      smsWebhookUrl: `https://beta.example.com/webhooks/twilio/sms`,
    };
  });
}

function buildConversations(organizations: Array<{ id: string }>, agents: Array<{ id: string; organizationId: string }>) {
  return Array.from({ length: COUNTS.calls }, (_, index) => {
    const organization = organizations[index % organizations.length];
    const agent = agentsForOrg(agents, organization.id)[index % agentsForOrg(agents, organization.id).length];
    const startedAt = daysAgo(index % 45, index);
    return {
      id: betaId("conversation", index),
      organizationId: organization.id,
      agentId: agent.id,
      visitorId: `caller-${index}`,
      sessionId: `voice-session-${index}`,
      channel: "VOICE" as const,
      status: "CLOSED" as const,
      source: "INTERNAL" as const,
      startedAt,
      lastMessageAt: new Date(startedAt.getTime() + 180_000),
      endedAt: new Date(startedAt.getTime() + 240_000),
      createdAt: startedAt,
    };
  });
}

function buildCalls(
  organizations: Array<{ id: string }>,
  agents: Array<{ id: string; organizationId: string }>,
  phoneNumbers: Array<{ id: string; organizationId: string; phoneNumber: string }>,
  conversations: Array<{ id: string; organizationId: string; agentId: string; startedAt: Date }>,
) {
  return conversations.map((conversation, index) => {
    const organization = organizations.find((item) => item.id === conversation.organizationId)!;
    const phones = phoneNumbers.filter((item) => item.organizationId === organization.id);
    const phone = phones[index % phones.length];
    const agent = agents.find((item) => item.id === conversation.agentId)!;
    const durationSeconds = 60 + (index % 540);
    return {
      id: betaId("call", index),
      organizationId: organization.id,
      agentId: agent.id,
      phoneNumberId: phone.id,
      conversationId: conversation.id,
      twilioCallSid: `CA${String(index + 1).padStart(32, "0")}`,
      callerNumber: `+1647555${String(index % 10_000).padStart(4, "0")}`,
      calledNumber: phone.phoneNumber,
      direction: "INBOUND" as const,
      status: index % 20 === 0 ? ("FAILED" as const) : ("COMPLETED" as const),
      startedAt: conversation.startedAt,
      answeredAt: new Date(conversation.startedAt.getTime() + 2_000),
      endedAt: new Date(conversation.startedAt.getTime() + durationSeconds * 1000),
      durationSeconds,
      endReason: index % 20 === 0 ? ("ERROR" as const) : ("CALLER_HANGUP" as const),
      source: "VOICE" as const,
      metadata: { seed: "beta", responseTimeMs: 420 + (index % 250) },
      createdAt: conversation.startedAt,
    };
  });
}

function buildCallSessions(calls: Array<{ id: string; organizationId: string; twilioCallSid: string; startedAt: Date; endedAt: Date | null; durationSeconds: number | null }>) {
  return calls.map((call, index) => ({
    id: betaId("call-session", index),
    callId: call.id,
    organizationId: call.organizationId,
    twilioCallSid: call.twilioCallSid,
    streamSid: `MZ${String(index + 1).padStart(32, "0")}`,
    status: "DISCONNECTED" as const,
    connectedAt: new Date(call.startedAt.getTime() + 1_000),
    disconnectedAt: call.endedAt,
    packetCount: Math.max(1, Math.round((call.durationSeconds ?? 1) * 50)),
    createdAt: call.startedAt,
  }));
}

function buildRecordings(
  calls: Array<{ id: string; organizationId: string; twilioCallSid: string; durationSeconds: number | null; startedAt: Date; endedAt: Date | null }>,
  sessions: Array<{ id: string }>,
) {
  return calls.map((call, index) => ({
    id: betaId("recording", index),
    organizationId: call.organizationId,
    callId: call.id,
    callSessionId: sessions[index].id,
    twilioCallSid: call.twilioCallSid,
    storageProvider: "s3",
    storagePath: `organizations/${call.organizationId}/calls/${call.id}/recordings/recording.wav`,
    fileName: `call-${index + 1}.wav`,
    mimeType: "audio/wav",
    durationSeconds: call.durationSeconds,
    fileSizeBytes: Math.max(16_000, (call.durationSeconds ?? 60) * 16_000),
    status: index % 25 === 0 ? ("FAILED" as const) : ("AVAILABLE" as const),
    recordingStartedAt: call.startedAt,
    recordingCompletedAt: call.endedAt,
    createdAt: call.startedAt,
  }));
}

function buildTranscripts(
  calls: Array<{ id: string; organizationId: string; conversationId: string; durationSeconds: number | null; startedAt: Date; endedAt: Date | null }>,
  recordings: Array<{ id: string }>,
  conversations: Array<{ id: string }>,
) {
  return calls.map((call, index) => ({
    id: betaId("transcript", index),
    organizationId: call.organizationId,
    callId: call.id,
    callRecordingId: recordings[index].id,
    conversationId: conversations[index].id,
    status: index % 30 === 0 ? ("FAILED" as const) : ("COMPLETED" as const),
    language: "en",
    provider: "openai",
    durationSeconds: call.durationSeconds,
    wordCount: 80 + (index % 700),
    confidence: 0.82 + (index % 15) / 100,
    fullText: `Customer asked about services and pricing. Agent captured lead details for benchmark call ${index + 1}.`,
    summary: `Benchmark summary for call ${index + 1}: customer requested follow-up and service information.`,
    failureReason: index % 30 === 0 ? "Synthetic failed transcript for dashboard testing." : null,
    processingTimeMs: 1_200 + (index % 2_000),
    startedAt: call.endedAt,
    completedAt: call.endedAt ? new Date(call.endedAt.getTime() + 90_000) : null,
    createdAt: call.startedAt,
  }));
}

async function createTranscriptSegments(transcripts: Array<{ id: string; status: string; createdAt: Date }>) {
  const rows = transcripts
    .filter((transcript) => transcript.status === "COMPLETED")
    .flatMap((transcript, index) => [
      {
        id: betaId("segment-user", index),
        transcriptId: transcript.id,
        speaker: "USER" as const,
        startMs: 0,
        endMs: 8_000,
        text: "Hi, I would like information about your services.",
        confidence: 0.9,
        sequence: 1,
        createdAt: transcript.createdAt,
      },
      {
        id: betaId("segment-assistant", index),
        transcriptId: transcript.id,
        speaker: "ASSISTANT" as const,
        startMs: 8_000,
        endMs: 18_000,
        text: "I can help with that. May I capture your contact details for follow-up?",
        confidence: 0.92,
        sequence: 2,
        createdAt: transcript.createdAt,
      },
    ]);
  await createInBatches("transcript segments", rows, (data) =>
    prisma.callTranscriptSegment.createMany({ data }),
  );
}

function buildContacts(organizations: Array<{ id: string }>) {
  return Array.from({ length: COUNTS.leads }, (_, index) => {
    const organization = organizations[index % organizations.length];
    return {
      id: betaId("contact", index),
      organizationId: organization.id,
      name: `Beta Lead ${index + 1}`,
      phone: `+1780555${String(index).padStart(4, "0")}`,
      email: `lead-${index + 1}@beta.local`,
      company: `Beta Company ${(index % 500) + 1}`,
      notes: "Synthetic benchmark contact.",
    };
  });
}

function buildLeads(
  contacts: Array<{ id: string; organizationId: string }>,
  agents: Array<{ id: string; organizationId: string }>,
  calls: Array<{ id: string; organizationId: string; conversationId: string }>,
  conversations: Array<{ id: string }>,
) {
  return contacts.map((contact, index) => {
    const orgAgents = agentsForOrg(agents, contact.organizationId);
    const orgCalls = calls.filter((call) => call.organizationId === contact.organizationId);
    const call = orgCalls[index % orgCalls.length];
    return {
      id: betaId("lead", index),
      organizationId: contact.organizationId,
      contactId: contact.id,
      conversationId: call?.conversationId ?? conversations[index % conversations.length].id,
      callId: call?.id,
      agentId: orgAgents[index % orgAgents.length].id,
      source: "AI_AGENT",
      status: ["NEW", "QUALIFIED", "CONTACTED"][index % 3] as "NEW" | "QUALIFIED" | "CONTACTED",
      notes: "Synthetic benchmark lead.",
    };
  });
}

function buildTools(organizations: Array<{ id: string }>) {
  return organizations.flatMap((organization) =>
    TOOL_NAMES.map((name) => ({
      id: betaId(`tool-${name}`, Number(organization.id.split("-").at(-1) ?? 0)),
      organizationId: organization.id,
      name,
      displayName: name
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
      description: `Synthetic beta ${name} tool.`,
      enabled: true,
      schema: { type: "object", properties: {}, additionalProperties: false },
    })),
  );
}

function buildToolExecutions(
  organizations: Array<{ id: string }>,
  agents: Array<{ id: string; organizationId: string }>,
  calls: Array<{ id: string; organizationId: string; conversationId: string; startedAt: Date }>,
  conversations: Array<{ id: string }>,
) {
  return Array.from({ length: COUNTS.toolExecutions }, (_, index) => {
    const organization = organizations[index % organizations.length];
    const orgAgents = agentsForOrg(agents, organization.id);
    const orgCalls = calls.filter((call) => call.organizationId === organization.id);
    const call = orgCalls[index % orgCalls.length];
    const status = index % 20 === 0 ? ("FAILED" as const) : index % 33 === 0 ? ("REJECTED" as const) : ("SUCCESS" as const);
    const startedAt = new Date(call.startedAt.getTime() + (index % 120) * 1000);
    const completedAt = status === "SUCCESS" ? new Date(startedAt.getTime() + 400 + (index % 1200)) : new Date(startedAt.getTime() + 100);
    return {
      id: betaId("tool-execution", index),
      organizationId: organization.id,
      callId: call.id,
      conversationId: call.conversationId ?? conversations[index % conversations.length].id,
      agentId: orgAgents[index % orgAgents.length].id,
      toolName: TOOL_NAMES[index % TOOL_NAMES.length],
      status,
      input: {
        name: `Customer ${index + 1}`,
        phone: `+1780555${String(index % 10_000).padStart(4, "0")}`,
      },
      output: status === "SUCCESS" ? { success: true, message: "Synthetic execution completed." } : null,
      error: status === "SUCCESS" ? null : "Synthetic execution failure for benchmark testing.",
      startedAt,
      completedAt,
      createdAt: startedAt,
    };
  });
}

async function createInBatches<T>(label: string, rows: T[], write: (rows: T[]) => Promise<unknown>) {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    await write(batch);
    console.log(`Seeded ${label}: ${Math.min(index + batch.length, rows.length)}/${rows.length}`);
  }
}

function agentsForOrg<T extends { organizationId: string }>(agents: T[], organizationId: string) {
  return agents.filter((agent) => agent.organizationId === organizationId);
}

function betaId(kind: string, index: number) {
  return `${BETA_PREFIX}-${kind}-${String(index + 1).padStart(6, "0")}`;
}

function daysAgo(days: number, salt: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(salt % 24, salt % 60, 0, 0);
  return date;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
