CREATE TYPE "ToolExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'REJECTED');
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'CONTACTED', 'CLOSED');
CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "tools" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "schema" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tools_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tool_executions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "callId" TEXT,
  "conversationId" TEXT,
  "agentId" TEXT,
  "toolName" TEXT NOT NULL,
  "status" "ToolExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "input" JSONB NOT NULL,
  "output" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tool_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "appointment_requests" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "conversationId" TEXT,
  "callId" TEXT,
  "agentId" TEXT,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "preferredDate" TIMESTAMP(3),
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "appointment_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contacts" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "company" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leads" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "conversationId" TEXT,
  "callId" TEXT,
  "agentId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'AI_AGENT',
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_queue" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "conversationId" TEXT,
  "to" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sms_queue" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "conversationId" TEXT,
  "phone" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sms_queue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tools_organizationId_name_key" ON "tools"("organizationId", "name");
CREATE INDEX "tools_organizationId_idx" ON "tools"("organizationId");
CREATE INDEX "tools_name_idx" ON "tools"("name");
CREATE INDEX "tools_enabled_idx" ON "tools"("enabled");

CREATE INDEX "tool_executions_organizationId_idx" ON "tool_executions"("organizationId");
CREATE INDEX "tool_executions_conversationId_idx" ON "tool_executions"("conversationId");
CREATE INDEX "tool_executions_callId_idx" ON "tool_executions"("callId");
CREATE INDEX "tool_executions_agentId_idx" ON "tool_executions"("agentId");
CREATE INDEX "tool_executions_toolName_idx" ON "tool_executions"("toolName");
CREATE INDEX "tool_executions_status_idx" ON "tool_executions"("status");
CREATE INDEX "tool_executions_createdAt_idx" ON "tool_executions"("createdAt");

CREATE INDEX "appointment_requests_organizationId_idx" ON "appointment_requests"("organizationId");
CREATE INDEX "appointment_requests_conversationId_idx" ON "appointment_requests"("conversationId");
CREATE INDEX "appointment_requests_callId_idx" ON "appointment_requests"("callId");
CREATE INDEX "appointment_requests_agentId_idx" ON "appointment_requests"("agentId");
CREATE INDEX "appointment_requests_phone_idx" ON "appointment_requests"("phone");
CREATE INDEX "appointment_requests_email_idx" ON "appointment_requests"("email");
CREATE INDEX "appointment_requests_createdAt_idx" ON "appointment_requests"("createdAt");

CREATE INDEX "contacts_organizationId_idx" ON "contacts"("organizationId");
CREATE INDEX "contacts_phone_idx" ON "contacts"("phone");
CREATE INDEX "contacts_email_idx" ON "contacts"("email");
CREATE UNIQUE INDEX "contacts_organizationId_phone_key" ON "contacts"("organizationId", "phone");
CREATE UNIQUE INDEX "contacts_organizationId_email_key" ON "contacts"("organizationId", "email");

CREATE INDEX "leads_organizationId_idx" ON "leads"("organizationId");
CREATE INDEX "leads_contactId_idx" ON "leads"("contactId");
CREATE INDEX "leads_conversationId_idx" ON "leads"("conversationId");
CREATE INDEX "leads_callId_idx" ON "leads"("callId");
CREATE INDEX "leads_agentId_idx" ON "leads"("agentId");
CREATE INDEX "leads_status_idx" ON "leads"("status");
CREATE INDEX "leads_source_idx" ON "leads"("source");
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");

CREATE INDEX "email_queue_organizationId_idx" ON "email_queue"("organizationId");
CREATE INDEX "email_queue_conversationId_idx" ON "email_queue"("conversationId");
CREATE INDEX "email_queue_status_idx" ON "email_queue"("status");
CREATE INDEX "email_queue_createdAt_idx" ON "email_queue"("createdAt");

CREATE INDEX "sms_queue_organizationId_idx" ON "sms_queue"("organizationId");
CREATE INDEX "sms_queue_conversationId_idx" ON "sms_queue"("conversationId");
CREATE INDEX "sms_queue_phone_idx" ON "sms_queue"("phone");
CREATE INDEX "sms_queue_status_idx" ON "sms_queue"("status");
CREATE INDEX "sms_queue_createdAt_idx" ON "sms_queue"("createdAt");

ALTER TABLE "tools" ADD CONSTRAINT "tools_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leads" ADD CONSTRAINT "leads_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sms_queue" ADD CONSTRAINT "sms_queue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_queue" ADD CONSTRAINT "sms_queue_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
