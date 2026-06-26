import { BadRequestException } from "@nestjs/common";
import { normalizeLeadPhone } from "./lead-normalization";

describe("lead phone normalization", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["09876543210", "+919876543210"],
  ])("normalizes Indian lead number %s", (input, expected) => {
    expect(normalizeLeadPhone(input, "IN")).toBe(expected);
  });

  it("keeps US/Canada numbers in E.164", () => {
    expect(normalizeLeadPhone("(416) 555-0100", "CA")).toBe("+14165550100");
  });

  it("rejects invalid numbers", () => {
    expect(() => normalizeLeadPhone("123", "IN")).toThrow(BadRequestException);
  });
});
