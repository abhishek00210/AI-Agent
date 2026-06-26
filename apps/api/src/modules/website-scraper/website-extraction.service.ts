import { BadRequestException, Injectable } from "@nestjs/common";
import { load } from "cheerio";
import { UrlSafetyService } from "./url-safety.service";
import type { ExtractedWebsiteContent } from "./repositories/website-source.repository";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_SCRIPT_BYTES = 1024 * 1024;
const MAX_TOTAL_SCRIPT_BYTES = 2 * 1024 * 1024;
const MAX_SCRIPT_FILES = 5;
const FETCH_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;
const MIN_READABLE_WORDS = 5;

@Injectable()
export class WebsiteExtractionService {
  constructor(private readonly urlSafety: UrlSafetyService) {}

  async extract(url: string): Promise<ExtractedWebsiteContent> {
    const safeUrl = await this.urlSafety.validatePublicHttpUrl(url);
    const html = await this.fetchHtml(safeUrl);
    return this.extractReadableContent(html, safeUrl);
  }

  private async fetchHtml(url: string, redirects = 0): Promise<string> {
    const safeUrl = await this.urlSafety.validatePublicHttpUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(safeUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "AI-Agent-Platform-Scraper/1.0",
          accept: "text/html,application/xhtml+xml",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects >= MAX_REDIRECTS) {
          throw new BadRequestException("Too many redirects while fetching URL.");
        }

        const location = response.headers.get("location");
        if (!location) {
          throw new BadRequestException("Redirect response did not include a destination.");
        }

        return this.fetchHtml(new URL(location, safeUrl).toString(), redirects + 1);
      }

      if (!response.ok) {
        throw new BadRequestException(`URL returned HTTP ${response.status}.`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("text/html")) {
        throw new BadRequestException("URL did not return an HTML page.");
      }

      const contentLength = Number(response.headers.get("content-length") ?? "0");
      if (contentLength > MAX_HTML_BYTES) {
        throw new BadRequestException("HTML response is too large to scrape.");
      }

      const html = await response.text();
      if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
        throw new BadRequestException("HTML response is too large to scrape.");
      }

      return html;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async extractReadableContent(html: string, pageUrl: string): Promise<ExtractedWebsiteContent> {
    const $ = load(html);
    const title = cleanText($("title").first().text()) || null;
    const description =
      cleanText($('meta[name="description"]').attr("content") ?? "") ||
      cleanText($('meta[property="og:description"]').attr("content") ?? "") ||
      null;
    const scriptUrls = this.getSameOriginScriptUrls($, pageUrl);

    $(
      [
        "script",
        "style",
        "noscript",
        "svg",
        "canvas",
        "iframe",
        "nav",
        "header",
        "footer",
        "aside",
        "form",
        "[role='navigation']",
        "[aria-label*='breadcrumb' i]",
        "[class*='cookie' i]",
        "[class*='advert' i]",
        "[class*='ads' i]",
      ].join(","),
    ).remove();

    const container = $("main, article, [role='main']").first();
    const readableRoot = container.length ? container : $("body");
    const htmlContent = readableRoot.html() ?? "";
    let content = cleanText(readableRoot.text());

    if (!content || wordCount(content) < MIN_READABLE_WORDS) {
      const scriptContent = await this.extractScriptFallbackContent(scriptUrls);
      content = cleanText([title, description, scriptContent].filter(Boolean).join(" "));
    }

    if (!content || wordCount(content) < MIN_READABLE_WORDS) {
      throw new BadRequestException("Readable content could not be extracted from this URL.");
    }

    return {
      title,
      description,
      content,
      htmlContent,
      wordCount: wordCount(content),
    };
  }

  private getSameOriginScriptUrls(
    $: ReturnType<typeof load>,
    pageUrl: string,
  ): string[] {
    const pageOrigin = new URL(pageUrl).origin;
    const urls = new Set<string>();

    $("script[src]").each((_, element) => {
      const src = $(element).attr("src");
      if (!src) {
        return;
      }

      try {
        const scriptUrl = new URL(src, pageUrl);
        if (scriptUrl.origin === pageOrigin) {
          urls.add(scriptUrl.toString());
        }
      } catch {
        // Ignore malformed script URLs.
      }
    });

    return [...urls].slice(0, MAX_SCRIPT_FILES);
  }

  private async extractScriptFallbackContent(scriptUrls: string[]): Promise<string> {
    const phrases: string[] = [];
    const seen = new Set<string>();
    let totalBytes = 0;

    for (const scriptUrl of scriptUrls) {
      if (totalBytes >= MAX_TOTAL_SCRIPT_BYTES) {
        break;
      }

      const script = await this.fetchTextAsset(scriptUrl, MAX_SCRIPT_BYTES);
      totalBytes += Buffer.byteLength(script, "utf8");
      if (isFrameworkRuntimeBundle(script)) {
        continue;
      }

      for (const phrase of extractReadableJavaScriptPhrases(script)) {
        const normalized = phrase.toLowerCase();
        if (seen.has(normalized)) {
          continue;
        }

        seen.add(normalized);
        phrases.push(phrase);
        if (phrases.length >= 80) {
          return phrases.join(" ");
        }
      }
    }

    return phrases.join(" ");
  }

  private async fetchTextAsset(url: string, maxBytes: number): Promise<string> {
    const safeUrl = await this.urlSafety.validatePublicHttpUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(safeUrl, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": "AI-Agent-Platform-Scraper/1.0",
          accept: "application/javascript,text/javascript,text/plain,*/*",
        },
      });

      if (!response.ok) {
        return "";
      }

      const contentLength = Number(response.headers.get("content-length") ?? "0");
      if (contentLength > maxBytes) {
        await response.body?.cancel();
        return "";
      }

      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > maxBytes) {
        return "";
      }

      return text;
    } catch {
      return "";
    } finally {
      clearTimeout(timeout);
    }
  }
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function extractReadableJavaScriptPhrases(script: string): string[] {
  const phrases: string[] = [];
  let index = 0;

  while (index < script.length) {
    const quote = script[index];
    if (quote !== '"' && quote !== "'" && quote !== "`") {
      index += 1;
      continue;
    }

    let cursor = index + 1;
    let escaped = false;
    let value = "";

    while (cursor < script.length && value.length <= 320) {
      const char = script[cursor];
      if (escaped) {
        value += `\\${char}`;
        escaped = false;
        cursor += 1;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        cursor += 1;
        continue;
      }

      if (char === quote) {
        break;
      }

      value += char;
      cursor += 1;
    }

    if (cursor >= script.length || script[cursor] !== quote || value.length > 320) {
      index += 1;
      continue;
    }

    const phrase = cleanText(decodeJavaScriptString(value));
    if (isReadablePhrase(phrase)) {
      phrases.push(phrase);
    }

    index = cursor + 1;
  }

  return phrases;
}

function isFrameworkRuntimeBundle(script: string): boolean {
  return /Minified React error|__DOM_INTERNALS_DO_NOT_USE|createBrowserRouter|hydrateRoot/.test(
    script.slice(0, 120_000),
  );
}

function decodeJavaScriptString(value: string): string {
  return value
    .replace(/\\n|\\r|\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\`/g, "`")
    .replace(/\\\\/g, "\\");
}

function isReadablePhrase(value: string): boolean {
  if (wordCount(value) < 3 || value.length < 18) {
    return false;
  }

  if (
    !/[a-z]{3,}/i.test(value) ||
    /https?:|react|undefined|anonymous|function|attribute|dispatch|typeof|stack|warning|environment|props|children|classname|runtime|hydration|removeattribute|setattribute|full message|generating stack|object with keys|mousedown|mouseup|keydown|keyup|focusin|focusout|selectionchange|composition|canplay|durationchange|loadedmetadata|timeupdate|beforetoggle|scrollend|pointer|touchstart|touchend|dragend|resize|encrypted|stalled|suspend|volumechange/i.test(
      value,
    )
  ) {
    return false;
  }

  if (
    /(?:^|[\s:])(?:mt|mb|ml|mr|mx|my|px|py|pt|pb|pl|pr|text|bg|border|font|leading|tracking|rounded|shadow|grid|flex|items|justify|gap|zinc|slate|white|black)-/i.test(
      value,
    )
  ) {
    return false;
  }

  const symbolCount = (value.match(/[{}[\]<>=$_*|]/g) ?? []).length;
  return symbolCount / value.length < 0.08;
}
