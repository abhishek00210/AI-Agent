-- CreateEnum
CREATE TYPE "WidgetStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "WidgetPosition" AS ENUM ('BOTTOM_RIGHT', 'BOTTOM_LEFT');

-- CreateTable
CREATE TABLE "widgets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "WidgetStatus" NOT NULL DEFAULT 'ACTIVE',
    "publicKey" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f766e',
    "position" "WidgetPosition" NOT NULL DEFAULT 'BOTTOM_RIGHT',
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Hi, how can I help?',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_visitors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widget_visitors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "widgets_publicKey_key" ON "widgets"("publicKey");

-- CreateIndex
CREATE INDEX "widgets_organizationId_idx" ON "widgets"("organizationId");

-- CreateIndex
CREATE INDEX "widgets_agentId_idx" ON "widgets"("agentId");

-- CreateIndex
CREATE INDEX "widgets_status_idx" ON "widgets"("status");

-- CreateIndex
CREATE INDEX "widgets_deletedAt_idx" ON "widgets"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "widget_visitors_widgetId_visitorId_key" ON "widget_visitors"("widgetId", "visitorId");

-- CreateIndex
CREATE INDEX "widget_visitors_organizationId_idx" ON "widget_visitors"("organizationId");

-- CreateIndex
CREATE INDEX "widget_visitors_widgetId_idx" ON "widget_visitors"("widgetId");

-- CreateIndex
CREATE INDEX "widget_visitors_visitorId_idx" ON "widget_visitors"("visitorId");

-- CreateIndex
CREATE INDEX "widget_visitors_createdAt_idx" ON "widget_visitors"("createdAt");

-- AddForeignKey
ALTER TABLE "widgets" ADD CONSTRAINT "widgets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widgets" ADD CONSTRAINT "widgets_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_visitors" ADD CONSTRAINT "widget_visitors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_visitors" ADD CONSTRAINT "widget_visitors_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "widgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
