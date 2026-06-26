import { BadRequestException, Injectable } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import net from "node:net";

@Injectable()
export class UrlSafetyService {
  async validatePublicHttpUrl(input: string): Promise<string> {
    let url: URL;

    try {
      url = new URL(input.trim());
    } catch {
      throw new BadRequestException("Enter a valid URL.");
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new BadRequestException("Only HTTP and HTTPS URLs are supported.");
    }

    if (url.username || url.password) {
      throw new BadRequestException("URLs with embedded credentials are not supported.");
    }

    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      throw new BadRequestException("Localhost URLs are not allowed.");
    }

    const directIpVersion = net.isIP(hostname);
    if (directIpVersion && isPrivateAddress(hostname)) {
      throw new BadRequestException("Private or internal network URLs are not allowed.");
    }

    const addresses = await lookup(hostname, { all: true }).catch(() => {
      throw new BadRequestException("URL host could not be resolved.");
    });

    if (addresses.length === 0) {
      throw new BadRequestException("URL host could not be resolved.");
    }

    if (addresses.some((address) => isPrivateAddress(address.address))) {
      throw new BadRequestException("Private or internal network URLs are not allowed.");
    }

    url.hash = "";
    return url.toString();
  }
}

function isPrivateAddress(address: string): boolean {
  if (address === "::1" || address === "0:0:0:0:0:0:0:1") {
    return true;
  }

  if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) {
    return true;
  }

  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}
