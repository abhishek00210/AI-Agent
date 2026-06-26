UPDATE "customer_profiles" cp SET
  "totalCalls" = (SELECT COUNT(*)::integer FROM "calls" c WHERE c."organizationId" = cp."organizationId" AND cp."phone" IS NOT NULL AND c."callerNumber" = cp."phone"),
  "totalAppointments" = (SELECT COUNT(*)::integer FROM "appointments" a WHERE a."organizationId" = cp."organizationId" AND a."contactId" = cp."contactId" AND a."status" <> 'CANCELLED'),
  "totalConversations" = (SELECT COUNT(*)::integer FROM "communication_threads" t WHERE t."organizationId" = cp."organizationId" AND t."contactId" = cp."contactId"),
  "totalMessages" = (SELECT COUNT(*)::integer FROM "communication_messages" m JOIN "communication_threads" t ON t."id" = m."threadId" WHERE t."organizationId" = cp."organizationId" AND t."contactId" = cp."contactId"),
  "lastContactAt" = GREATEST(
    cp."lastContactAt",
    (SELECT MAX(c."startedAt") FROM "calls" c WHERE c."organizationId" = cp."organizationId" AND cp."phone" IS NOT NULL AND c."callerNumber" = cp."phone"),
    (SELECT MAX(a."createdAt") FROM "appointments" a WHERE a."organizationId" = cp."organizationId" AND a."contactId" = cp."contactId"),
    (SELECT MAX(t."lastMessageAt") FROM "communication_threads" t WHERE t."organizationId" = cp."organizationId" AND t."contactId" = cp."contactId"),
    cp."lastSeenAt"
  ),
  "updatedAt" = CURRENT_TIMESTAMP;
