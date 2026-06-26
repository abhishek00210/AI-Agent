import { writeFile } from "node:fs/promises";

const api = process.env.E2E_API_URL ?? "https://agent-api.zodo.ca/api/v1";
const token = process.env.E2E_ADMIN_TOKEN;
if (!token) throw new Error("E2E_ADMIN_TOKEN is required.");
const response = await fetch(`${api}/admin/launch-readiness/report`, { headers: { authorization: `Bearer ${token}` } });
if (!response.ok) throw new Error(`Launch report request failed with ${response.status}.`);
const markdown = await response.text();
const output = new URL("../launch-readiness-report.md", import.meta.url);
await writeFile(output, markdown, "utf8");
process.stdout.write(`Wrote ${output.pathname}\n`);
