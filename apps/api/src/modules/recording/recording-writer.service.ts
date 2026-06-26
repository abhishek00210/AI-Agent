import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import {
  RECORDING_CHANNELS,
  RECORDING_SAMPLE_RATE,
  RECORDING_SEGMENT_BYTES,
} from "./recording.types";

interface SegmentState {
  index: number;
  bytes: number;
}

@Injectable()
export class RecordingWriterService implements OnModuleDestroy {
  private readonly logger = new Logger(RecordingWriterService.name);
  private readonly baseDir = join(tmpdir(), "ai-agent-platform-recordings");
  private readonly writes = new Map<string, Promise<void>>();
  private readonly writeErrors = new Map<string, Error>();
  private readonly segments = new Map<string, SegmentState>();

  async createRawPath(recordingId: string): Promise<string> {
    await fs.mkdir(this.baseDir, { recursive: true });
    return join(this.baseDir, `${recordingId}-${randomUUID()}.ulaw`);
  }

  append(rawPath: string, chunk: Buffer): Promise<void> {
    const segmentPath = this.nextSegmentPath(rawPath, chunk.length);
    const previous = this.writes.get(rawPath) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => fs.appendFile(segmentPath, chunk))
      .catch((error) => {
        this.logger.warn(`Recording chunk write failed: ${readError(error)}`);
        this.writeErrors.set(
          rawPath,
          error instanceof Error ? error : new Error("Recording chunk write failed."),
        );
        throw error;
      });
    this.writes.set(rawPath, next);
    return next;
  }

  async waitForPending(rawPath: string): Promise<void> {
    try {
      await (this.writes.get(rawPath) ?? Promise.resolve());
    } catch {
      // The original write error is rethrown below after internal state is released.
    } finally {
      this.writes.delete(rawPath);
      this.segments.delete(rawPath);
    }

    const writeError = this.writeErrors.get(rawPath);
    this.writeErrors.delete(rawPath);
    if (writeError) {
      throw writeError;
    }
  }

  async finalizeMulawToWav(rawPath: string, wavPath: string) {
    await this.waitForPending(rawPath);
    await fs.mkdir(dirname(wavPath), { recursive: true });
    const segmentPaths = await this.listSegments(rawPath);
    const rawBytes = (
      await Promise.all(segmentPaths.map((path) => fs.stat(path).then((stat) => stat.size)))
    ).reduce((total, size) => total + size, 0);
    await fs.writeFile(wavPath, createPcmWavHeader(rawBytes * 2));

    for (const segmentPath of segmentPaths) {
      await pipeline(
        createReadStream(segmentPath),
        createMulawDecodeTransform(),
        createWriteStream(wavPath, { flags: "a" }),
      );
    }

    return {
      wavPath,
      segmentPaths,
      durationSeconds: Math.max(0, Math.round(rawBytes / RECORDING_SAMPLE_RATE)),
      fileSizeBytes: 44 + rawBytes * 2,
      rawBytes,
    };
  }

  createReadStream(path: string) {
    return createReadStream(path);
  }

  async cleanup(paths: string[]) {
    await Promise.allSettled(paths.map((path) => fs.rm(path, { force: true })));
  }

  async onModuleDestroy() {
    await Promise.allSettled([...this.writes.values()]);
    this.writes.clear();
    this.writeErrors.clear();
    this.segments.clear();
  }

  private nextSegmentPath(rawPath: string, chunkBytes: number): string {
    const current = this.segments.get(rawPath) ?? { index: 0, bytes: 0 };
    if (current.bytes > 0 && current.bytes + chunkBytes > RECORDING_SEGMENT_BYTES) {
      current.index += 1;
      current.bytes = 0;
    }
    current.bytes += chunkBytes;
    this.segments.set(rawPath, current);
    return segmentPath(rawPath, current.index);
  }

  private async listSegments(rawPath: string): Promise<string[]> {
    const directory = dirname(rawPath);
    const prefix = `${basename(rawPath)}.part-`;
    const entries = await fs.readdir(directory).catch(() => []);
    const paths = entries
      .filter((entry) => entry.startsWith(prefix))
      .sort()
      .map((entry) => join(directory, entry));

    if (paths.length > 0) {
      return paths;
    }

    const legacyExists = await fs
      .stat(rawPath)
      .then(() => true)
      .catch(() => false);
    return legacyExists ? [rawPath] : [];
  }
}

function segmentPath(rawPath: string, index: number): string {
  return `${rawPath}.part-${String(index).padStart(6, "0")}`;
}

function createMulawDecodeTransform() {
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      const pcm = Buffer.allocUnsafe(chunk.length * 2);
      for (let index = 0; index < chunk.length; index += 1) {
        pcm.writeInt16LE(decodeMulaw(chunk[index] ?? 0), index * 2);
      }
      callback(null, pcm);
    },
  });
}

function createPcmWavHeader(dataLength: number): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = RECORDING_SAMPLE_RATE * RECORDING_CHANNELS * 2;
  const blockAlign = RECORDING_CHANNELS * 2;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(RECORDING_CHANNELS, 22);
  header.writeUInt32LE(RECORDING_SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

function decodeMulaw(value: number): number {
  const muLaw = ~value & 0xff;
  const sign = muLaw & 0x80;
  const exponent = (muLaw >> 4) & 0x07;
  const mantissa = muLaw & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  return sign ? -sample : sample;
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
