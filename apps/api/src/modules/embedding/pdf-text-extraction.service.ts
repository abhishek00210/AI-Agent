import { BadRequestException, Injectable } from "@nestjs/common";
import { PDFParse } from "pdf-parse";

@Injectable()
export class PdfTextExtractionService {
  async extract(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText().catch((error: unknown) => {
      throw new BadRequestException(
        error instanceof Error ? error.message : "PDF text extraction failed.",
      );
    });
    await parser.destroy();

    const text = parsed.text?.trim();
    if (!text) {
      throw new BadRequestException("No readable text could be extracted from this PDF.");
    }

    return text;
  }
}
