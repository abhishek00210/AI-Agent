import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Observable } from "rxjs";

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { requestId?: string }>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    const header = request.headers["x-request-id"];
    const requestId = (Array.isArray(header) ? header[0] : header) ?? randomUUID();

    request.requestId = requestId;
    response.header("x-request-id", requestId);

    return next.handle();
  }
}
