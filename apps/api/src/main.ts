import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import compress from "@fastify/compress";
import fastifyHelmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { RequestIdInterceptor } from "./common/interceptors/request-id.interceptor";
import type { ApiConfig } from "./config/env.schema";

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    keepAliveTimeout: 72_000,
    requestTimeout: 30_000,
    connectionTimeout: 10_000,
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    abortOnError: false,
    bufferLogs: true,
    rawBody: true,
  });
  const config = app.get(ConfigService);
  const apiConfig = config.getOrThrow<ApiConfig>("api");

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  await app.register(fastifyHelmet);
  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  });
  await app.register(compress, {
    global: true,
    threshold: 1024,
    customTypes: /^(application\/json|text\/plain|text\/html)/,
  });
  app.enableCors({
    origin: apiConfig.corsOrigins.includes("*") ? true : apiConfig.corsOrigins,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With"],
    credentials: true,
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor());

  await app.listen(apiConfig.port, apiConfig.host);
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
