import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PassThrough, Readable } from "node:stream";
import type { TenantContext } from "../tenant/tenant.service";
import type { ExportCallsQueryDto } from "./dto/call.dto";
import { CallSearchService } from "./call-search.service";
import { CallRepository } from "./repositories/call.repository";

export interface CallExportResult {
  stream: NodeJS.ReadableStream;
  contentType: string;
  fileName: string;
}

type ExportRow = Awaited<ReturnType<CallRepository["exportRows"]>>["data"][number];

const EXPORT_BATCH_SIZE = 1000;
const MAX_EXPORT_ROWS = 50_000;

@Injectable()
export class CallExportService {
  constructor(
    private readonly calls: CallRepository,
    private readonly search: CallSearchService,
  ) {}

  async export(context: TenantContext, query: ExportCallsQueryDto): Promise<CallExportResult> {
    const format = query.format === "xlsx" ? "xlsx" : "csv";
    const options = {
      ...this.search.toRepositoryOptions(context.organizationId, query),
      page: 1,
      limit: Math.min(query.limit ?? MAX_EXPORT_ROWS, MAX_EXPORT_ROWS),
      sortBy: "startedAt" as const,
      sortOrder: "asc" as const,
    };

    void this.calls
      .createAuditEvent({
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "call.exported",
        entityType: "Call",
        metadata: { format, limit: options.limit },
      })
      .catch(() => undefined);

    if (format === "xlsx") {
      return {
        stream: this.createXlsxStream(options),
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileName: `call-logs-${dateStamp()}.xlsx`,
      };
    }

    return {
      stream: Readable.from(this.csvRows(options)),
      contentType: "text/csv; charset=utf-8",
      fileName: `call-logs-${dateStamp()}.csv`,
    };
  }

  private async *csvRows(options: Parameters<CallRepository["exportRows"]>[0]) {
    const headers = exportHeaders();
    yield `${headers.map(escapeCsv).join(",")}\n`;

    for await (const row of this.iterateRows(options)) {
      const formatted = formatExportRow(row);
      yield `${headers.map((header) => escapeCsv(formatted[header])).join(",")}\n`;
    }
  }

  private createXlsxStream(options: Parameters<CallRepository["exportRows"]>[0]) {
    const stream = new PassThrough();
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream,
      useSharedStrings: false,
      useStyles: false,
    });
    const worksheet = workbook.addWorksheet("Call Logs");
    worksheet.columns = exportHeaders().map((header) => ({
      header,
      key: header,
      width: Math.min(Math.max(header.length + 4, 14), 48),
    }));

    void (async () => {
      try {
        for await (const row of this.iterateRows(options)) {
          worksheet.addRow(formatExportRow(row)).commit();
        }
        worksheet.commit();
        await workbook.commit();
      } catch (error) {
        stream.destroy(error instanceof Error ? error : new Error("Call export failed."));
      }
    })();

    return stream;
  }

  private async *iterateRows(options: Parameters<CallRepository["exportRows"]>[0]) {
    let cursor: string | null = null;
    let exported = 0;
    do {
      const remaining = options.limit - exported;
      if (remaining <= 0) break;
      const batch = await this.calls.exportRows(options, cursor, Math.min(EXPORT_BATCH_SIZE, remaining));
      for (const row of batch.data) {
        exported += 1;
        yield row;
      }
      cursor = batch.nextCursor;
    } while (cursor);
  }
}

function exportHeaders() {
  return [
    "Call ID",
    "Call SID",
    "Caller",
    "Called Number",
    "Agent",
    "Phone Number",
    "Direction",
    "Status",
    "Source",
    "End Reason",
    "Started At",
    "Answered At",
    "Ended At",
    "Duration Seconds",
    "Transcript Status",
    "Transcript Summary",
  ];
}

function formatExportRow(row: ExportRow): Record<string, unknown> {
  return {
    "Call ID": row.id,
    "Call SID": row.twilioCallSid,
    Caller: row.callerNumber,
    "Called Number": row.calledNumber,
    Agent: row.agent.name,
    "Phone Number": row.phoneNumber.friendlyName ?? row.phoneNumber.phoneNumber,
    Direction: row.direction,
    Status: row.status,
    Source: row.source,
    "End Reason": row.endReason,
    "Started At": row.startedAt.toISOString(),
    "Answered At": row.answeredAt?.toISOString() ?? "",
    "Ended At": row.endedAt?.toISOString() ?? "",
    "Duration Seconds": row.durationSeconds ?? "",
    "Transcript Status": row.callTranscript?.status ?? "",
    "Transcript Summary": row.callTranscript?.summary ?? "",
  };
}

function escapeCsv(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  return `"${raw.replaceAll('"', '""')}"`;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
