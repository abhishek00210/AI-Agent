ALTER TABLE "automation_executions" ADD COLUMN "triggerId" TEXT;

UPDATE "automation_executions"
SET "triggerId" = CONCAT(
  "triggerType"::text,
  ':',
  COALESCE("metadata"->>'sourceEntityType', 'Unknown'),
  ':',
  COALESCE("metadata"->>'sourceEntityId', "id")
);

ALTER TABLE "automation_executions" ALTER COLUMN "triggerId" SET NOT NULL;

DELETE FROM "automation_executions" duplicate
USING "automation_executions" canonical
WHERE duplicate."organizationId" = canonical."organizationId"
  AND duplicate."triggerId" = canonical."triggerId"
  AND duplicate."workflowId" = canonical."workflowId"
  AND duplicate."customerProfileId" = canonical."customerProfileId"
  AND (
    duplicate."createdAt" > canonical."createdAt"
    OR (duplicate."createdAt" = canonical."createdAt" AND duplicate."id" > canonical."id")
  );

CREATE UNIQUE INDEX "automation_executions_organizationId_triggerId_workflowId_customerProfileId_key"
ON "automation_executions"("organizationId", "triggerId", "workflowId", "customerProfileId");
