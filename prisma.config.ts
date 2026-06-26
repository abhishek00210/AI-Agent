import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

function readEnvValue(key: string): string | undefined {
  const envPaths = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];

  for (const envPath of envPaths) {
    if (!existsSync(envPath)) {
      continue;
    }

    const line = readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${key}=`));

    if (line) {
      return line.slice(key.length + 1).replace(/^['"]|['"]$/g, "");
    }
  }

  return undefined;
}

const databaseUrl =
  process.env.DATABASE_URL ??
  readEnvValue("DATABASE_URL") ??
  "postgresql://postgres:postgres@localhost:5432/ai_agent_platform?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
