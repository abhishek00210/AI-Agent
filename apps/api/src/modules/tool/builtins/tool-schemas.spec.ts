import { bookAppointmentSchema } from "./tool-schemas";

describe("built-in tool schemas", () => {
  it("requires complete local scheduling details for book_appointment", () => {
    const result = bookAppointmentSchema.safeParse({
      customerName: "Jane Customer",
      phone: "+14155551234",
      email: "jane@example.com",
      preferredDate: "2026-07-01",
      preferredTime: "14:00",
      timezone: "America/Toronto",
      notes: "Roofing estimate.",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing timezone and malformed local time", () => {
    const result = bookAppointmentSchema.safeParse({
      customerName: "Jane Customer",
      phone: "+14155551234",
      email: "jane@example.com",
      preferredDate: "2026-07-01",
      preferredTime: "2pm",
    });

    expect(result.success).toBe(false);
  });
});
