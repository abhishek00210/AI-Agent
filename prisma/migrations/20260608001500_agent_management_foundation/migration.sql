-- Replace AgentStatus enum with the product-facing lifecycle values.
CREATE TYPE "AgentStatus_new" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT');
ALTER TABLE "Agent" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Agent" ALTER COLUMN "status" TYPE "AgentStatus_new" USING (
    CASE
        WHEN "status"::text IN ('PAUSED', 'ARCHIVED') THEN 'INACTIVE'
        ELSE "status"::text
    END
)::"AgentStatus_new";
DROP TYPE "AgentStatus";
ALTER TYPE "AgentStatus_new" RENAME TO "AgentStatus";
ALTER TABLE "Agent" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- Align the physical table name with the SaaS domain table naming convention.
ALTER TABLE "Agent" RENAME TO "agents";
