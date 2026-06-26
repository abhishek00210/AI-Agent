import { createHash } from "node:crypto";
import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service";

export interface WidgetRateLimitInput {
  widgetId: string;
  action: "init" | "conversation" | "chat";
  ip?: string;
  visitorId?: string;
}

@Injectable()
export class WidgetRateLimitService {
  private readonly ttlSeconds = 60;
  private readonly ipLimit = 60;
  private readonly visitorLimit = 30;
  private readonly widgetLimit = 300;

  constructor(private readonly redis: RedisService) {}

  async assertAllowed(input: WidgetRateLimitInput): Promise<void> {
    const checks: Array<Promise<void>> = [
      this.assertLimit(`widget:rate:widget:${input.action}:${input.widgetId}`, this.widgetLimit),
    ];

    if (input.ip) {
      checks.push(
        this.assertLimit(`widget:rate:ip:${input.action}:${hashValue(input.ip)}`, this.ipLimit),
      );
    }

    if (input.visitorId) {
      checks.push(
        this.assertLimit(
          `widget:rate:visitor:${input.action}:${input.widgetId}:${input.visitorId}`,
          this.visitorLimit,
        ),
      );
    }

    await Promise.all(checks);
  }

  private async assertLimit(key: string, limit: number): Promise<void> {
    const count = await this.redis.rateLimitStore.incr(key);
    if (count === 1) {
      await this.redis.rateLimitStore.expire(key, this.ttlSeconds);
    }

    if (count > limit) {
      throw new HttpException("Widget rate limit exceeded.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
