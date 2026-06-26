import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { OrganizationLocaleService } from "./organization-locale.service";
import { OrganizationProvisioningService } from "./organization-provisioning.service";
import { RequestLocaleInterceptor } from "./request-locale.interceptor";

@Global()
@Module({
  providers: [
    OrganizationLocaleService,
    OrganizationProvisioningService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLocaleInterceptor,
    },
  ],
  exports: [OrganizationLocaleService, OrganizationProvisioningService],
})
export class OrganizationLocaleModule {}
