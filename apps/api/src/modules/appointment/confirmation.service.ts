import { Injectable } from "@nestjs/common";

@Injectable()
export class ConfirmationService {
  generate(now = new Date()): string {
    const year = now.getUTCFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    return `APT-${year}-${random}`;
  }
}
