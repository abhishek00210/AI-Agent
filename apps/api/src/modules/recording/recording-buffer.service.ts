import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import {
  RECORDING_MAX_BUFFER_BYTES,
  RECORDING_MAX_RAW_BYTES,
  type FinalizeRecordingJob,
  type RecordingSessionContext,
} from "./recording.types";
import { RecordingWriterService } from "./recording-writer.service";

interface ActiveRecordingBuffer extends RecordingSessionContext {
  chunks: Buffer[];
  bufferedBytes: number;
  receivedBytes: number;
  droppedBytes: number;
  draining: boolean;
  closing: boolean;
}

@Injectable()
export class RecordingBufferService implements OnModuleDestroy {
  private readonly logger = new Logger(RecordingBufferService.name);
  private readonly active = new Map<string, ActiveRecordingBuffer>();

  constructor(private readonly writer: RecordingWriterService) {}

  register(context: RecordingSessionContext) {
    this.active.set(context.streamSid, {
      ...context,
      chunks: [],
      bufferedBytes: 0,
      receivedBytes: 0,
      droppedBytes: 0,
      draining: false,
      closing: false,
    });
  }

  capture(streamSid: string, payload: string): void {
    const session = this.active.get(streamSid);
    if (!session || session.closing) {
      return;
    }

    const chunk = Buffer.from(payload, "base64");
    if (chunk.length === 0) {
      return;
    }

    if (session.receivedBytes + chunk.length > RECORDING_MAX_RAW_BYTES) {
      session.droppedBytes += chunk.length;
      return;
    }

    if (session.bufferedBytes + chunk.length > RECORDING_MAX_BUFFER_BYTES) {
      session.droppedBytes += chunk.length;
      return;
    }

    session.chunks.push(chunk);
    session.bufferedBytes += chunk.length;
    session.receivedBytes += chunk.length;
    this.scheduleDrain(session);
  }

  metrics() {
    const sessions = [...this.active.values()];
    return {
      activeCalls: sessions.length,
      totalBufferedBytes: sessions.reduce((total, session) => total + session.bufferedBytes, 0),
      maximumCallBufferedBytes: sessions.reduce(
        (maximum, session) => Math.max(maximum, session.bufferedBytes),
        0,
      ),
      droppedBytes: sessions.reduce((total, session) => total + session.droppedBytes, 0),
    };
  }

  async close(streamSid: string): Promise<FinalizeRecordingJob | null> {
    const session = this.active.get(streamSid);
    if (!session) {
      return null;
    }

    session.closing = true;
    this.active.delete(streamSid);
    await this.drain(session);
    await this.writer.waitForPending(session.rawPath);

    return {
      recordingId: session.recordingId,
      organizationId: session.organizationId,
      callId: session.callId,
      callSessionId: session.callSessionId,
      twilioCallSid: session.twilioCallSid,
      rawPath: session.rawPath,
      startedAt: session.startedAt,
      receivedBytes: session.receivedBytes,
      droppedBytes: session.droppedBytes,
    };
  }

  async onModuleDestroy() {
    const pending = [...this.active.keys()];
    await Promise.allSettled(pending.map((streamSid) => this.close(streamSid)));
    if (pending.length > 0) {
      this.logger.log(`Closed ${pending.length} active recording buffers.`);
    }
  }

  private scheduleDrain(session: ActiveRecordingBuffer) {
    if (session.draining) {
      return;
    }

    session.draining = true;
    setImmediate(() => {
      void this.drain(session);
    });
  }

  private async drain(session: ActiveRecordingBuffer): Promise<void> {
    try {
      while (session.chunks.length > 0) {
        const chunk = session.chunks.shift();
        if (!chunk) {
          continue;
        }
        session.bufferedBytes -= chunk.length;
        await this.writer.append(session.rawPath, chunk);
      }
    } finally {
      session.draining = false;
      if (session.chunks.length > 0 && !session.closing) {
        this.scheduleDrain(session);
      }
    }
  }
}
