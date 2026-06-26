import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  status() {
    return this.healthService.status();
  }

  @Get("live")
  live() {
    return {
      status: "ok",
      service: "ai-agent-platform-api",
      timestamp: new Date().toISOString(),
    };
  }
}
