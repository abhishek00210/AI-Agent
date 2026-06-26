import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { Observable } from "rxjs";
import type { JwtPayload } from "../auth/auth.types";
import type { OrganizationLocale } from "./organization-locale.service";
import { OrganizationLocaleService } from "./organization-locale.service";

export interface LocaleAwareRequest extends FastifyRequest {
  user?: JwtPayload;
  locale?: OrganizationLocale;
  country?: OrganizationLocale["country"];
  currency?: OrganizationLocale["currency"];
  timezone?: string;
}

@Injectable()
export class RequestLocaleInterceptor implements NestInterceptor {
  constructor(private readonly locales: OrganizationLocaleService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<LocaleAwareRequest>();
    const organizationId = request.user?.organizationId;
    if (organizationId && !request.locale) {
      const locale = await this.locales.getOrganizationLocale(organizationId);
      request.locale = locale;
      request.country = locale.country;
      request.currency = locale.currency;
      request.timezone = locale.timezone;
    }
    return next.handle();
  }
}
