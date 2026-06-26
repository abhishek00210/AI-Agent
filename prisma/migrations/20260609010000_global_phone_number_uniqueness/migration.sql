DROP INDEX IF EXISTS "phone_numbers_organizationId_phoneNumber_key";

CREATE UNIQUE INDEX "phone_numbers_phoneNumber_key" ON "phone_numbers"("phoneNumber");
