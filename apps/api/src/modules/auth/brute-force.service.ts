import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class BruteForceService {
  private readonly maxAttempts = 5;
  private readonly ttlSeconds = 15 * 60;

  constructor(private readonly redis: RedisService) {}

  async assertAllowed(identifier: string): Promise<void> {
    const attempts = await this.redis.rateLimitStore.get(this.key(identifier));

    if (attempts && Number(attempts) >= this.maxAttempts) {
      throw new HttpException(
        "Too many authentication attempts. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailure(identifier: string): Promise<void> {
    const key = this.key(identifier);
    const attempts = await this.redis.rateLimitStore.incr(key);

    if (attempts === 1) {
      await this.redis.rateLimitStore.expire(key, this.ttlSeconds);
    }
  }

  async clear(identifier: string): Promise<void> {
    await this.redis.rateLimitStore.del(this.key(identifier));
  }

  private key(identifier: string): string {
    return `auth:failures:${identifier.toLowerCase()}`;
  }
}
