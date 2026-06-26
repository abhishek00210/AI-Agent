import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RealtimeMetricsService } from "../../common/metrics/realtime-metrics.service";
import { normalizeE164 } from "./e164";
import { PhoneNumberRepository } from "./repositories/phone-number.repository";

@Injectable()
export class CallRoutingService {
  private readonly cache = new Map<
    string,
    {
      value: Awaited<ReturnType<PhoneNumberRepository["findRoutableByPhoneNumber"]>>;
      expiresAt: number;
    }
  >();

  constructor(
    private readonly phoneNumbers: PhoneNumberRepository,
    private readonly config: ConfigService,
    private readonly metrics: RealtimeMetricsService,
  ) {}

  async resolve(calledNumber: string) {
    const normalized = normalizeE164(calledNumber);
    const cached = this.cache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
      this.metrics.increment("routing_cache_hits");
      return cached.value;
    }
    this.metrics.increment("routing_cache_misses");
    const value = await this.phoneNumbers.findRoutableByPhoneNumber(normalized);
    this.cache.set(normalized, {
      value,
      expiresAt: Date.now() + (this.config.get<number>("voice.routingCacheTtlMs") ?? 30_000),
    });
    return value;
  }

  invalidate(phoneNumber: string) {
    this.cache.delete(normalizeE164(phoneNumber));
  }
}
