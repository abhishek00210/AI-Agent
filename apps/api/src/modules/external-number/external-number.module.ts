import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { TelephonyModule } from "../telephony/telephony.module";
import { ExternalNumberController } from "./external-number.controller";
import { ExternalNumberRepository } from "./external-number.repository";
import { ExternalNumberService } from "./external-number.service";
import { ForwardingTestService } from "./forwarding-test.service";
import { VerificationService } from "./verification.service";

@Module({
  imports: [AuthModule, TenantModule, TelephonyModule],
  controllers: [ExternalNumberController],
  providers: [
    ExternalNumberRepository,
    ExternalNumberService,
    VerificationService,
    ForwardingTestService,
  ],
  exports: [ExternalNumberService, ForwardingTestService],
})
export class ExternalNumberModule {}
