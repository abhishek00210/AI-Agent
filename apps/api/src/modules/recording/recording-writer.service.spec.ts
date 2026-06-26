import { promises as fs } from "node:fs";
import { basename, dirname } from "node:path";
import { RECORDING_SEGMENT_BYTES } from "./recording.types";
import { RecordingWriterService } from "./recording-writer.service";

describe("RecordingWriterService", () => {
  const createdPaths: string[] = [];
  let writer: RecordingWriterService;

  beforeEach(() => {
    writer = new RecordingWriterService();
  });

  afterEach(async () => {
    await writer.onModuleDestroy();
    await writer.cleanup(createdPaths.splice(0));
  });

  it("rotates raw recording segments without retaining the full call in memory", async () => {
    const rawPath = await writer.createRawPath("rotation-test");
    createdPaths.push(rawPath);

    await writer.append(rawPath, Buffer.alloc(RECORDING_SEGMENT_BYTES));
    await writer.append(rawPath, Buffer.from([1]));
    await writer.waitForPending(rawPath);

    const entries = await fs.readdir(dirname(rawPath));
    const segmentNames = entries
      .filter((entry) => entry.startsWith(`${basename(rawPath)}.part-`))
      .sort();
    createdPaths.push(...segmentNames.map((entry) => `${dirname(rawPath)}/${entry}`));

    expect(segmentNames).toHaveLength(2);
  });

  it("streams mu-law segments into a PCM WAV with the expected size", async () => {
    const rawPath = await writer.createRawPath("wav-test");
    const wavPath = rawPath.replace(/\.ulaw$/, ".wav");
    createdPaths.push(rawPath, wavPath);

    await writer.append(rawPath, Buffer.from([0xff, 0x7f, 0x00, 0x80]));
    const result = await writer.finalizeMulawToWav(rawPath, wavPath);
    createdPaths.push(...result.segmentPaths);

    const header = await fs.readFile(wavPath);
    expect(header.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(header.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(result.rawBytes).toBe(4);
    expect(result.fileSizeBytes).toBe(52);
  });
});
