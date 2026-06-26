CREATE TABLE "analytics_events" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "agentId" TEXT, "metricDate" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}', "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "analytics_events_organizationId_idempotencyKey_key" ON "analytics_events"("organizationId", "idempotencyKey");
CREATE INDEX "analytics_events_organizationId_metricDate_idx" ON "analytics_events"("organizationId", "metricDate");
CREATE INDEX "analytics_events_organizationId_eventType_metricDate_idx" ON "analytics_events"("organizationId", "eventType", "metricDate");
CREATE INDEX "analytics_events_processedAt_idx" ON "analytics_events"("processedAt");

CREATE TABLE "analytics_daily_metrics" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL,
  "totalCalls" INTEGER NOT NULL DEFAULT 0, "incomingCalls" INTEGER NOT NULL DEFAULT 0,
  "outgoingCalls" INTEGER NOT NULL DEFAULT 0, "outboundAnsweredCalls" INTEGER NOT NULL DEFAULT 0,
  "outboundConversions" INTEGER NOT NULL DEFAULT 0, "appointments" INTEGER NOT NULL DEFAULT 0,
  "appointmentsBookedByAi" INTEGER NOT NULL DEFAULT 0, "leads" INTEGER NOT NULL DEFAULT 0,
  "leadsCreatedByAi" INTEGER NOT NULL DEFAULT 0, "qualifiedLeads" INTEGER NOT NULL DEFAULT 0,
  "customers" INTEGER NOT NULL DEFAULT 0, "newCustomers" INTEGER NOT NULL DEFAULT 0,
  "returningCustomers" INTEGER NOT NULL DEFAULT 0, "repeatCallers" INTEGER NOT NULL DEFAULT 0,
  "conversionRate" DECIMAL(8,4) NOT NULL DEFAULT 0, "customerRetentionRate" DECIMAL(8,4) NOT NULL DEFAULT 0,
  "outboundAnswerRate" DECIMAL(8,4) NOT NULL DEFAULT 0, "outboundConversionRate" DECIMAL(8,4) NOT NULL DEFAULT 0,
  "followupSuccessRate" DECIMAL(8,4) NOT NULL DEFAULT 0, "aiMinutes" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "aiResponses" INTEGER NOT NULL DEFAULT 0, "aiInputTokens" BIGINT NOT NULL DEFAULT 0,
  "aiOutputTokens" BIGINT NOT NULL DEFAULT 0, "toolExecutions" INTEGER NOT NULL DEFAULT 0,
  "smsSent" INTEGER NOT NULL DEFAULT 0, "messagesSent" INTEGER NOT NULL DEFAULT 0,
  "revenue" DECIMAL(20,2) NOT NULL DEFAULT 0, "callDurationSeconds" INTEGER NOT NULL DEFAULT 0,
  "avgCallDuration" DECIMAL(20,4) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analytics_daily_metrics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "analytics_daily_metrics_organizationId_date_key" ON "analytics_daily_metrics"("organizationId", "date");
CREATE INDEX "analytics_daily_metrics_organizationId_idx" ON "analytics_daily_metrics"("organizationId");
CREATE INDEX "analytics_daily_metrics_date_idx" ON "analytics_daily_metrics"("date");
CREATE INDEX "analytics_daily_metrics_organizationId_date_idx" ON "analytics_daily_metrics"("organizationId", "date");

CREATE TABLE "analytics_agent_daily_metrics" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "agentId" TEXT NOT NULL, "agentName" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL, "calls" INTEGER NOT NULL DEFAULT 0,
  "appointments" INTEGER NOT NULL DEFAULT 0, "leads" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analytics_agent_daily_metrics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "analytics_agent_daily_metrics_organizationId_agentId_date_key" ON "analytics_agent_daily_metrics"("organizationId", "agentId", "date");
CREATE INDEX "analytics_agent_daily_metrics_organizationId_date_idx" ON "analytics_agent_daily_metrics"("organizationId", "date");
CREATE INDEX "analytics_agent_daily_metrics_organizationId_agentId_date_idx" ON "analytics_agent_daily_metrics"("organizationId", "agentId", "date");

CREATE TABLE "analytics_metric_snapshots" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "metricKey" TEXT NOT NULL,
  "metricValue" DECIMAL(20,6) NOT NULL, "snapshotDate" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_metric_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "analytics_metric_snapshots_organizationId_metricKey_snapshotDate_key" ON "analytics_metric_snapshots"("organizationId", "metricKey", "snapshotDate");
CREATE INDEX "analytics_metric_snapshots_organizationId_idx" ON "analytics_metric_snapshots"("organizationId");
CREATE INDEX "analytics_metric_snapshots_metricKey_idx" ON "analytics_metric_snapshots"("metricKey");
CREATE INDEX "analytics_metric_snapshots_snapshotDate_idx" ON "analytics_metric_snapshots"("snapshotDate");
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_daily_metrics" ADD CONSTRAINT "analytics_daily_metrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_agent_daily_metrics" ADD CONSTRAINT "analytics_agent_daily_metrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_metric_snapshots" ADD CONSTRAINT "analytics_metric_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
