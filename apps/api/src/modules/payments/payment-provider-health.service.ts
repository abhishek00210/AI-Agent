import { Injectable } from "@nestjs/common";
import { RealtimeMetricsService } from "../../common/metrics/realtime-metrics.service";
import { PaymentProviderFactory } from "./payment-provider.factory";

@Injectable()
export class PaymentProviderHealthService {
  constructor(
    private readonly factory: PaymentProviderFactory,
    private readonly metrics: RealtimeMetricsService,
  ) {}

  async providers() {
    const results = await Promise.all(
      this.factory.all().map(async (provider) => {
        const startedAt = this.metrics.now();
        try {
          const health = await provider.health();
          this.metrics.observeValue("payment_provider_health_ms", this.metrics.now() - startedAt);
          this.metrics.increment(
            `payment_${provider.name.toLowerCase()}_${health.healthy ? "health_ok" : "health_failed"}`,
          );
          return health;
        } catch (error) {
          this.metrics.increment(`payment_${provider.name.toLowerCase()}_health_failed`);
          return {
            provider: provider.name,
            configured: provider.isConfigured(),
            healthy: false,
            latencyMs: Math.round(this.metrics.now() - startedAt),
            error: error instanceof Error ? error.message : "Payment provider health check failed.",
          };
        }
      }),
    );
    return {
      generatedAt: new Date().toISOString(),
      data: results,
    };
  }
}
